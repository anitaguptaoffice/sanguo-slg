package firstcityledgerpgretentioncutover

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var (
	ErrUnauthorized = errors.New("firstcityledgerpgretentioncutover: route unauthorized (obligations)")
	ErrHeadConflict = errors.New("firstcityledgerpgretentioncutover: head/predecessor conflict")
)

// Controller gates retention intake; default fail-closed without obligation evidence.
type Controller struct {
	Evidence firstcityledgerpgintake.ObligationEvidence
	RealmID  string
	ServerID int32
	PlayerID int64
}

func (c *Controller) authorized() bool {
	if c == nil || c.RealmID == "" || c.ServerID <= 0 || c.PlayerID <= 0 {
		return false
	}
	ev := c.Evidence
	if !ev.ProfileComplete || !ev.ThroughCommitDrainOK {
		return false
	}
	for _, ok := range ev.InventoryDrainEvidence {
		if !ok {
			return false
		}
	}
	return true
}

func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return ErrUnauthorized
	}
	_, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_retention_proposal (
 command_id uuid PRIMARY KEY, city_name text NOT NULL, map_x int, map_y int)`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_retention_integrity (
 single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),
 restore_provenance_ok bool NOT NULL DEFAULT true,
 migration_digest_only bool NOT NULL DEFAULT false,
 template_catalog_ok bool NOT NULL DEFAULT true,
 allocator_highwater bigint NOT NULL DEFAULT 0)`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `INSERT INTO harness_retention_integrity DEFAULT VALUES ON CONFLICT DO NOTHING`)
	return err
}

func canonicalPayload(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

func (c *Controller) lineageN(ctx context.Context, tx pgx.Tx) (int, error) {
	var n int
	err := tx.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&n)
	return n, err
}

func (c *Controller) integrityOK(ctx context.Context, tx pgx.Tx) (bool, error) {
	var rp, digestOnly, tmpl bool
	var hw int64
	err := tx.QueryRow(ctx, `SELECT restore_provenance_ok,migration_digest_only,template_catalog_ok,allocator_highwater
 FROM harness_retention_integrity WHERE single_row`).Scan(&rp, &digestOnly, &tmpl, &hw)
	if err != nil {
		return false, err
	}
	if !rp || digestOnly || !tmpl {
		return false, nil
	}
	var maxCity *int64
	_ = tx.QueryRow(ctx, `SELECT max(city_id) FROM player_city WHERE server_id=$1 AND player_id=$2`, c.ServerID, c.PlayerID).Scan(&maxCity)
	if maxCity != nil && hw < *maxCity {
		return false, nil
	}
	return true, nil
}

func (c *Controller) lockSlot(ctx context.Context, tx pgx.Tx, acct int64) (*string, error) {
	if !c.authorized() {
		return nil, ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return nil, err
	}
	_, err := tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		c.RealmID, c.ServerID, c.PlayerID, acct)
	if err != nil {
		return nil, err
	}
	var head *string
	err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		c.RealmID, c.ServerID, c.PlayerID).Scan(&head)
	return head, err
}

// TryCommitIntake commits PENDING + head CAS when retention obligations allow; pred nil is EMPTY-initial only.
func (c *Controller) TryCommitIntake(ctx context.Context, tx pgx.Tx, acct int64, cmdID string, pred *string, name string, x, y int) (bool, error) {
	head, err := c.lockSlot(ctx, tx, acct)
	if err != nil {
		return false, err
	}
	if pred == nil {
		if head != nil {
			return false, nil
		}
		n, err := c.lineageN(ctx, tx)
		if err != nil || n > 0 {
			return false, err
		}
		ok, err := c.integrityOK(ctx, tx)
		if err != nil || !ok {
			return false, err
		}
	} else if head == nil || *head != *pred {
		return false, nil
	}
	c1b, fct1, sha := canonicalPayload(name, x, y)
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,
 durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1b, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO harness_retention_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
		return false, err
	}
	var upd pgconn.CommandTag
	if pred == nil {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
			c.RealmID, c.ServerID, c.PlayerID, cmdID)
	} else {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id=$5::uuid`,
			c.RealmID, c.ServerID, c.PlayerID, cmdID, *pred)
	}
	if err != nil || upd.RowsAffected() != 1 {
		return false, fmt.Errorf("%w: cas head", ErrHeadConflict)
	}
	return true, nil
}

// ObserverView is an independent observer read of slot head + command lineage (no slot lock).
type ObserverView struct {
	Head         string
	DurableState int16
	CityName     string
	CommandCount int
}

func (c *Controller) Observe(ctx context.Context, pool *pgxpool.Pool, cmdID string) (ObserverView, error) {
	var v ObserverView
	if pool == nil {
		return v, ErrUnauthorized
	}
	_ = pool.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&v.Head)
	_ = pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).Scan(&v.DurableState)
	_ = pool.QueryRow(ctx, `SELECT city_name FROM harness_retention_proposal WHERE command_id=$1::uuid`, cmdID).Scan(&v.CityName)
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&v.CommandCount)
	return v, nil
}

// MarkTerminal sets success (2) or rejection (3) terminal state on a PENDING command.
func (c *Controller) MarkTerminal(ctx context.Context, pool *pgxpool.Pool, cmdID string, st int16) error {
	if pool == nil || !c.authorized() {
		return ErrUnauthorized
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	var tag pgconn.CommandTag
	if st == 3 {
		tag, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1 WHERE command_id=$1::uuid AND durable_state=1`, cmdID)
	} else {
		tag, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),success_city_id=88001,success_server_id=$2,success_player_id=$3,success_is_capital=true,success_wall_level=1,success_morale=100 WHERE command_id=$1::uuid AND durable_state=1`, cmdID, c.ServerID, c.PlayerID)
	}
	if err != nil || tag.RowsAffected() != 1 {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("terminal update failed")
	}
	return tx.Commit(ctx)
}

// SimulateHeadReset clears slot head (TTL/reset drill); must not erase command row or authorize EMPTY.
func (c *Controller) SimulateHeadReset(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return ErrUnauthorized
	}
	_, err := pool.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=NULL
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID)
	return err
}

// SeedOrphanCommand inserts PENDING command + proposal without slot head (partial restore sim).
func (c *Controller) SeedOrphanCommand(ctx context.Context, pool *pgxpool.Pool, acct int64, cmdID, name string, x, y int) error {
	if pool == nil || !c.authorized() {
		return ErrUnauthorized
	}
	c1b, fct1, sha := canonicalPayload(name, x, y)
	_, err := pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,
 durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1b, fct1, sha)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `INSERT INTO harness_retention_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y)
	return err
}

func (c *Controller) CommandState(ctx context.Context, pool *pgxpool.Pool, cmdID string) (int16, error) {
	var st int16
	err := pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).Scan(&st)
	return st, err
}
