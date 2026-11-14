package firstcityledgerpginitial

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
	ErrUnauthorized = errors.New("firstcityledgerpginitial: route unauthorized (obligations)")
	ErrHeadConflict = errors.New("firstcityledgerpginitial: head/predecessor conflict")
)

// Controller gates INITIAL arbitration writers; default path is fail-closed without evidence.
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

// InstallDisposableFixture creates harness_initial_proposal in the test schema only.
func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return ErrUnauthorized
	}
	_, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_initial_proposal (
 command_id uuid PRIMARY KEY, city_name text NOT NULL, map_x int, map_y int)`)
	return err
}

func canonicalPayload(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
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

// TryCommitIntake performs PENDING intake + head CAS; caller commits tx on true.
func (c *Controller) TryCommitIntake(ctx context.Context, tx pgx.Tx, acct int64, cmdID string, pred *string, name string, x, y int) (bool, error) {
	head, err := c.lockSlot(ctx, tx, acct)
	if err != nil {
		return false, err
	}
	if pred == nil {
		if head != nil {
			return false, nil
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
	if _, err = tx.Exec(ctx, `INSERT INTO harness_initial_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
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

// StageCommandOnly inserts PENDING row + proposal without advancing head (open txn / rollback drills).
func (c *Controller) StageCommandOnly(ctx context.Context, tx pgx.Tx, acct int64, cmdID, name string, x, y int) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	if _, err := c.lockSlot(ctx, tx, acct); err != nil {
		return err
	}
	c1b, fct1, sha := canonicalPayload(name, x, y)
	_, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,
 durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1b, fct1, sha)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO harness_initial_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y)
	return err
}

// AdvanceHeadEmptyCAS sets head when still NULL (complete staged open intake).
func (c *Controller) AdvanceHeadEmptyCAS(ctx context.Context, tx pgx.Tx, cmdID string) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID)
	if err != nil || tag.RowsAffected() != 1 {
		return ErrHeadConflict
	}
	return nil
}

// TerminatePending sets durable_state terminal (2=succeeded, 3=rejection); does not run effect path.
func (c *Controller) TerminatePending(ctx context.Context, tx pgx.Tx, cmdID string, durableState int16) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	var tag pgconn.CommandTag
	var err error
	if durableState == 3 {
		tag, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE command_id=$1::uuid AND durable_state=1`, cmdID)
	} else if durableState == 2 {
		tag, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=88001,success_server_id=$2,success_player_id=$3,success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE command_id=$1::uuid AND durable_state=1`, cmdID, c.ServerID, c.PlayerID)
	} else {
		return false, ErrUnauthorized
	}
	return tag.RowsAffected() == 1, err
}

type Proposal struct {
	CityName string
	MapX     int
	MapY     int
}

func (c *Controller) Head(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	if pool == nil {
		return "", ErrUnauthorized
	}
	var h string
	err := pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&h)
	return h, err
}

func (c *Controller) ReadProposal(ctx context.Context, pool *pgxpool.Pool, cmdID string) (Proposal, error) {
	var p Proposal
	if pool == nil {
		return p, ErrUnauthorized
	}
	err := pool.QueryRow(ctx, `SELECT city_name,map_x,map_y FROM harness_initial_proposal WHERE command_id=$1::uuid`, cmdID).
		Scan(&p.CityName, &p.MapX, &p.MapY)
	return p, err
}

// BizSum counts player_wallet + player_city rows (harness observer alignment).
func (c *Controller) BizSum(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	if pool == nil {
		return 0, ErrUnauthorized
	}
	var n int
	err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=$1 AND player_id=$2)+
 (SELECT count(*) FROM player_city WHERE server_id=$1 AND player_id=$2)`, c.ServerID, c.PlayerID).Scan(&n)
	return n, err
}

func (c *Controller) CommandCount(ctx context.Context, pool *pgxpool.Pool, cmdID string) (int, error) {
	if pool == nil {
		return 0, ErrUnauthorized
	}
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).Scan(&n)
	return n, err
}

func (c *Controller) DurableState(ctx context.Context, pool *pgxpool.Pool, cmdID string) (int16, error) {
	if pool == nil {
		return 0, ErrUnauthorized
	}
	var st int16
	err := pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).Scan(&st)
	return st, err
}

func (c *Controller) PendingCount(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	if pool == nil {
		return 0, ErrUnauthorized
	}
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE durable_state=1`).Scan(&n)
	return n, err
}
