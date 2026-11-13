package firstcityledgerpggmimportexclusion

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

var ErrUnauthorized = errors.New("firstcityledgerpggmimportexclusion: route unauthorized (obligations)")

// Controller gates GM/import batch exclusion paths; default fail-closed without obligation evidence.
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

// InstallDisposableFixture installs harness tables/triggers for isolated PG17 GM/import batch exclusion proofs.
func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool, realmID string, serverID int32, playerID int64) error {
	if pool == nil || realmID == "" {
		return ErrUnauthorized
	}
	blockGm := fmt.Sprintf(`CREATE OR REPLACE FUNCTION harness_block_gm_batch_first_city() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF (SELECT exclusion_active FROM harness_gm_import_state)
  AND coalesce(current_setting('harness.gm_import_batch', true), '') = '1' THEN
  IF NOT EXISTS (SELECT 1 FROM world_first_city_command WHERE realm_id='%s'::uuid AND server_id=%d AND player_id=%d AND durable_state=2) THEN
   RAISE EXCEPTION 'gm import exclusion blocks first-city batch insert';
  END IF;
  IF NEW.is_capital THEN
   RAISE EXCEPTION 'gm import exclusion blocks capital batch insert';
  END IF;
 END IF; RETURN NEW; END$$`, realmID, serverID, playerID)
	steps := []string{
		`CREATE TABLE IF NOT EXISTS mil_city_origin (server_id int NOT NULL CHECK (server_id>0),city_id bigint NOT NULL CHECK (city_id>0),
 owner_player_id bigint NOT NULL CHECK (owner_player_id>0),cohort_id bytea NOT NULL CHECK (octet_length(cohort_id)=16),
 format_version smallint NOT NULL CHECK (format_version=1),created_at timestamptz NOT NULL,PRIMARY KEY (server_id,city_id))`,
		`CREATE TABLE IF NOT EXISTS harness_gm_import_state (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),
 exclusion_active bool NOT NULL DEFAULT false,profile_generation int NOT NULL DEFAULT 0,local_drain_counter int NOT NULL DEFAULT 0)`,
		`INSERT INTO harness_gm_import_state DEFAULT VALUES ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS harness_gm_batch_hold (slot int PRIMARY KEY CHECK (slot=1))`,
		`INSERT INTO harness_gm_batch_hold VALUES (1) ON CONFLICT DO NOTHING`,
		blockGm,
		`DROP TRIGGER IF EXISTS trg_harness_gm_pc ON player_city`,
		`CREATE TRIGGER trg_harness_gm_pc BEFORE INSERT ON player_city
 FOR EACH ROW EXECUTE FUNCTION harness_block_gm_batch_first_city()`,
		`CREATE OR REPLACE FUNCTION harness_prevent_empty_reopen() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF OLD.head_command_id IS NOT NULL AND NEW.head_command_id IS NULL
  AND EXISTS (SELECT 1 FROM world_first_city_command WHERE command_id=OLD.head_command_id AND durable_state IN (2,3)) THEN
  RAISE EXCEPTION 'cannot reopen EMPTY with retained lineage';
 END IF; RETURN NEW; END$$`,
		`DROP TRIGGER IF EXISTS trg_harness_no_empty ON world_first_city_actor_slot`,
		`CREATE TRIGGER trg_harness_no_empty BEFORE UPDATE ON world_first_city_actor_slot
 FOR EACH ROW EXECUTE FUNCTION harness_prevent_empty_reopen()`,
	}
	for _, sql := range steps {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return err
		}
	}
	return nil
}

func canonicalPayload(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

func SetExclusion(ctx context.Context, pool *pgxpool.Pool, on bool) error {
	_, err := pool.Exec(ctx, `UPDATE harness_gm_import_state SET exclusion_active=$1`, on)
	return err
}

func BumpProfileDrain(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `UPDATE harness_gm_import_state SET profile_generation=profile_generation+1,local_drain_counter=local_drain_counter+1`)
	return err
}

// SeedRetention inserts durable_state=2 command, actor slot head, and retained capital player_city row.
func (c *Controller) SeedRetention(ctx context.Context, pool *pgxpool.Pool, acct int64, cmdID, name string, x, y int, cityID int64) error {
	if pool == nil || !c.authorized() {
		return ErrUnauthorized
	}
	c1b, fct1, sha := canonicalPayload(name, x, y)
	_, err := pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,
 success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,2,'t','r','c',1,$7,$8,now(),now(),$9,$2,$3,true,1,100)`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1b, fct1, sha, cityID)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `INSERT INTO world_first_city_actor_slot VALUES ($1::uuid,$2,$3,$4,$5::uuid)`,
		c.RealmID, c.ServerID, c.PlayerID, acct, cmdID)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES ($1,$2,$3,$4,$5,$6,true)`,
		c.ServerID, cityID, c.PlayerID, name, x, y)
	return err
}

// RowCounts observer-visible command and player_city rows for the actor.
type RowCounts struct {
	CommandN    int
	PlayerCityN int
}

func (c *Controller) Counts(ctx context.Context, pool *pgxpool.Pool) (RowCounts, error) {
	var rc RowCounts
	if pool == nil {
		return rc, ErrUnauthorized
	}
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&rc.CommandN)
	if err != nil {
		return rc, err
	}
	err = pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=$1 AND player_id=$2`, c.ServerID, c.PlayerID).Scan(&rc.PlayerCityN)
	return rc, err
}

func (c *Controller) HeadCommandID(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	var head string
	err := pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&head)
	return head, err
}

// OpenHarnessConn opens a second TCP connection with disposable schema search_path (observer / batch hold).
func OpenHarnessConn(ctx context.Context, dsn, schema string) (*pgx.Conn, error) {
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if _, err = conn.Exec(ctx, "SET search_path TO "+schema); err != nil {
		_ = conn.Close(ctx)
		return nil, err
	}
	return conn, nil
}

// GmBatchHoldOpen reports whether an independent observer still sees the GM batch hold lock.
func GmBatchHoldOpen(ctx context.Context, obs *pgx.Conn) bool {
	var one int
	return obs.QueryRow(ctx, `SELECT slot FROM harness_gm_batch_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&one) != nil
}

// TryLedgerCommandRowLockObserver acquires NOWAIT lock on retained ledger command row (table/row lock only).
func TryLedgerCommandRowLockObserver(ctx context.Context, obs *pgx.Conn, realmID string, serverID int32, playerID int64) (cmdID string, ok bool) {
	err := obs.QueryRow(ctx, `SELECT command_id::text FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE NOWAIT`, realmID, serverID, playerID).Scan(&cmdID)
	return cmdID, err == nil
}

// TryCommitEmptyIntake attempts lawful EMPTY intake under GM/import exclusion (batch hold must be drained).
func (c *Controller) TryCommitEmptyIntake(ctx context.Context, tx pgx.Tx, acct int64, cmdID, name string, x, y int) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	var active bool
	if err := tx.QueryRow(ctx, `SELECT exclusion_active FROM harness_gm_import_state`).Scan(&active); err != nil {
		return false, err
	}
	if active {
		var held int
		if err := tx.QueryRow(ctx, `SELECT slot FROM harness_gm_batch_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&held); err != nil {
			return false, nil
		}
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('harness.ledger_intake','1',true)`); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		c.RealmID, c.ServerID, c.PlayerID, acct); err != nil {
		return false, err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, c.RealmID, c.ServerID, c.PlayerID).Scan(&head); err != nil {
		return false, err
	}
	if head != nil {
		return false, nil
	}
	c1b, fct1, sha := canonicalPayload(name, x, y)
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1b, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	var upd pgconn.CommandTag
	if upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID); err != nil || upd.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}
