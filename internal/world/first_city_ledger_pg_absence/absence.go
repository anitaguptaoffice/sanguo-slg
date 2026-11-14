package firstcityledgerpgabsence

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
	ErrUnauthorized = errors.New("firstcityledgerpgabsence: route unauthorized (obligations)")
	ErrHeadConflict = errors.New("firstcityledgerpgabsence: head/predecessor conflict")
)

// LocalFlags records lease/cleanup/timeout signals; lookup/continue must not clear head on these alone.
type LocalFlags struct {
	LeaseReleased bool
	Cleanup       bool
	Timeout       bool
}

// Controller gates absence lookup/intake; default fail-closed without obligation evidence.
type Controller struct {
	Evidence  firstcityledgerpgintake.ObligationEvidence
	Local     LocalFlags
	RealmID   string
	ServerID  int32
	PlayerID  int64
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
	_, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_absence_proposal (
 command_id uuid PRIMARY KEY, city_name text NOT NULL, map_x int, map_y int)`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_absence_side (
 command_id uuid PRIMARY KEY, source_ending text NOT NULL DEFAULT 'pending'
 CHECK (source_ending IN ('pending','unknown','known')),
 cleanup_attempts int NOT NULL DEFAULT 0, cancel_flag bool NOT NULL DEFAULT false)`)
	return err
}

func canonicalPayload(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

// DiscoverView is an observer read without slot locks (may see transient miss).
type DiscoverView struct {
	SlotRows     int
	Head         *string
	CommandRows  int
	CityName     string
	MapX, MapY   int
	DurableState *int16
}

func (c *Controller) LookupDiscover(ctx context.Context, pool *pgxpool.Pool) (DiscoverView, error) {
	var v DiscoverView
	if pool == nil {
		return v, ErrUnauthorized
	}
	_ = c.Local
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&v.SlotRows)
	err := pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&v.Head)
	if err != nil {
		v.Head = nil
	}
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE server_id=$1 AND player_id=$2`,
		c.ServerID, c.PlayerID).Scan(&v.CommandRows)
	if v.Head == nil {
		return v, nil
	}
	err = pool.QueryRow(ctx, `SELECT city_name,map_x,map_y FROM harness_absence_proposal WHERE command_id=$1::uuid`, *v.Head).
		Scan(&v.CityName, &v.MapX, &v.MapY)
	if err != nil {
		v.CityName, v.MapX, v.MapY = "", 0, 0
	}
	var ds int16
	if err = pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, *v.Head).Scan(&ds); err == nil {
		v.DurableState = &ds
	}
	return v, nil
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

// TryCommitIntake commits PENDING command + head CAS; pred nil means EMPTY initial only when head IS NULL.
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
	if _, err = tx.Exec(ctx, `INSERT INTO harness_absence_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
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

// StageOpenCommand inserts slot row + PENDING command + proposal without advancing head (open txn drill).
func (c *Controller) StageOpenCommand(ctx context.Context, tx pgx.Tx, acct int64, cmdID, name string, x, y int) error {
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
	_, err = tx.Exec(ctx, `INSERT INTO harness_absence_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y)
	return err
}

// AdvanceHeadEmptyCAS sets head when still NULL inside the same open transaction.
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

// SetHeadInOpenTxn sets head while holding slot lock (PENDING visible before commit).
func (c *Controller) SetHeadInOpenTxn(ctx context.Context, tx pgx.Tx, cmdID string) error {
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

// ContinuationRead uses frozen lock boundary then reads head + proposal; never clears to EMPTY on local flags.
func (c *Controller) ContinuationRead(ctx context.Context, tx pgx.Tx, expectCmd string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	_ = c.Local
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return false, err
	}
	var head *string
	err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		c.RealmID, c.ServerID, c.PlayerID).Scan(&head)
	if err != nil || head == nil || *head != expectCmd {
		return false, nil
	}
	var st int16
	var name string
	var x, y int
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, expectCmd).Scan(&st); err != nil || st != 1 {
		return false, err
	}
	if err = tx.QueryRow(ctx, `SELECT city_name,map_x,map_y FROM harness_absence_proposal WHERE command_id=$1::uuid`, expectCmd).Scan(&name, &x, &y); err != nil || name == "" {
		return false, err
	}
	return true, nil
}

// MarkUnknownSide tags harness side row; continuation must not locally clear head.
func (c *Controller) MarkUnknownSide(ctx context.Context, pool *pgxpool.Pool, cmdID string) error {
	if pool == nil || !c.authorized() {
		return ErrUnauthorized
	}
	_, err := pool.Exec(ctx, `INSERT INTO harness_absence_side (command_id,source_ending) VALUES ($1::uuid,'unknown')
 ON CONFLICT (command_id) DO UPDATE SET source_ending='unknown'`, cmdID)
	return err
}

// SimulateLocalCleanup updates side flags only; must not NULL head or rewrite command.
func (c *Controller) SimulateLocalCleanup(ctx context.Context, pool *pgxpool.Pool, cmdID string) error {
	if pool == nil {
		return ErrUnauthorized
	}
	c.Local.Cleanup = true
	c.Local.LeaseReleased = true
	_, err := pool.Exec(ctx, `UPDATE harness_absence_side SET cleanup_attempts=cleanup_attempts+1,cancel_flag=true WHERE command_id=$1::uuid`, cmdID)
	return err
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

func (c *Controller) BizSum(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	if pool == nil {
		return 0, ErrUnauthorized
	}
	var n int
	err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=$1 AND player_id=$2)+
 (SELECT count(*) FROM player_city WHERE server_id=$1 AND player_id=$2)`, c.ServerID, c.PlayerID).Scan(&n)
	return n, err
}
