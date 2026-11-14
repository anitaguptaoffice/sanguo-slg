package firstcityledgerpgddlexclusion

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

var ErrUnauthorized = errors.New("firstcityledgerpgddlexclusion: route unauthorized (obligations)")

// Controller gates ApplySpecs / manual migration / lazy store DDL exclusion paths; default fail-closed without obligation evidence.
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

// InstallDisposableFixture installs harness tables/triggers for isolated PG17 DDL exclusion proofs.
func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool, realmID string, serverID int32, playerID int64) error {
	if pool == nil || realmID == "" {
		return ErrUnauthorized
	}
	blockPC := fmt.Sprintf(`CREATE OR REPLACE FUNCTION harness_block_ddl_pc() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF harness_ddl_role_live() THEN
  IF NOT EXISTS (SELECT 1 FROM world_first_city_command WHERE realm_id='%s'::uuid AND server_id=%d AND player_id=%d AND durable_state=2) THEN
   RAISE EXCEPTION 'ddl exclusion blocks first-city bundle insert';
  END IF;
  IF NEW.is_capital THEN RAISE EXCEPTION 'ddl exclusion blocks capital bundle insert'; END IF;
 END IF; RETURN NEW; END$$`, realmID, serverID, playerID)
	steps := []string{
		`CREATE TABLE IF NOT EXISTS harness_ddl_allocator_highwater (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),highwater bigint NOT NULL DEFAULT 88050)`,
		`INSERT INTO harness_ddl_allocator_highwater DEFAULT VALUES ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS harness_ddl_state (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),
 exclusion_active bool NOT NULL DEFAULT false,profile_generation int NOT NULL DEFAULT 0,local_drain_counter int NOT NULL DEFAULT 0,
 legacy_writer_stopped bool NOT NULL DEFAULT false,dom_api_stopped bool NOT NULL DEFAULT false,gm_import_stopped bool NOT NULL DEFAULT false,
 snapshot_flush_stopped bool NOT NULL DEFAULT false,restore_job_stopped bool NOT NULL DEFAULT false,
 explicit_apply_specs_stopped bool NOT NULL DEFAULT false,manual_migration_stopped bool NOT NULL DEFAULT false)`,
		`INSERT INTO harness_ddl_state DEFAULT VALUES ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS harness_ddl_hold (slot int PRIMARY KEY CHECK (slot=1))`,
		`INSERT INTO harness_ddl_hold VALUES (1) ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS harness_ddl_owner_claim (role text PRIMARY KEY)`,
		`CREATE OR REPLACE FUNCTION harness_ddl_enforce_single_owner() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF (SELECT count(*) FROM harness_ddl_owner_claim) >= 1 THEN RAISE EXCEPTION 'ddl exclusion rejects second migration owner'; END IF; RETURN NEW; END$$`,
		`DROP TRIGGER IF EXISTS trg_harness_ddl_owner ON harness_ddl_owner_claim`,
		`CREATE TRIGGER trg_harness_ddl_owner BEFORE INSERT ON harness_ddl_owner_claim FOR EACH ROW EXECUTE FUNCTION harness_ddl_enforce_single_owner()`,
		`CREATE OR REPLACE FUNCTION harness_ddl_role_live() RETURNS bool LANGUAGE plpgsql AS $$
 DECLARE r text := coalesce(current_setting('harness.ddl_role', true), ''); s record;
 BEGIN SELECT * INTO s FROM harness_ddl_state LIMIT 1;
  IF NOT s.exclusion_active OR r = '' THEN RETURN false; END IF;
  IF r = 'apply_specs' AND s.explicit_apply_specs_stopped THEN RETURN false; END IF;
  IF r = 'manual_migration' AND s.manual_migration_stopped THEN RETURN false; END IF;
  RETURN true; END$$`,
		`CREATE OR REPLACE FUNCTION harness_block_ddl_lower_allocator() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF harness_ddl_role_live() AND NEW.highwater < OLD.highwater THEN RAISE EXCEPTION 'ddl exclusion blocks allocator rollback'; END IF; RETURN NEW; END$$`,
		`DROP TRIGGER IF EXISTS trg_harness_ddl_hw ON harness_ddl_allocator_highwater`,
		`CREATE TRIGGER trg_harness_ddl_hw BEFORE UPDATE ON harness_ddl_allocator_highwater FOR EACH ROW EXECUTE FUNCTION harness_block_ddl_lower_allocator()`,
		`CREATE OR REPLACE FUNCTION harness_block_ddl_ledger_delete() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF harness_ddl_role_live() THEN RAISE EXCEPTION 'ddl exclusion blocks ledger delete'; END IF; RETURN OLD; END$$`,
		`DROP TRIGGER IF EXISTS trg_harness_ddl_del ON world_first_city_command`,
		`CREATE TRIGGER trg_harness_ddl_del BEFORE DELETE ON world_first_city_command FOR EACH ROW EXECUTE FUNCTION harness_block_ddl_ledger_delete()`,
		blockPC,
		`DROP TRIGGER IF EXISTS trg_harness_ddl_pc ON player_city`,
		`CREATE TRIGGER trg_harness_ddl_pc BEFORE INSERT ON player_city FOR EACH ROW EXECUTE FUNCTION harness_block_ddl_pc()`,
		`CREATE OR REPLACE FUNCTION harness_prevent_empty_reopen() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF OLD.head_command_id IS NOT NULL AND NEW.head_command_id IS NULL
  AND EXISTS (SELECT 1 FROM world_first_city_command WHERE command_id=OLD.head_command_id AND durable_state IN (2,3)) THEN
  RAISE EXCEPTION 'cannot reopen EMPTY with retained lineage';
 END IF; RETURN NEW; END$$`,
		`DROP TRIGGER IF EXISTS trg_harness_no_empty ON world_first_city_actor_slot`,
		`CREATE TRIGGER trg_harness_no_empty BEFORE UPDATE ON world_first_city_actor_slot FOR EACH ROW EXECUTE FUNCTION harness_prevent_empty_reopen()`,
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
	_, err := pool.Exec(ctx, `UPDATE harness_ddl_state SET exclusion_active=$1`, on)
	return err
}

// SetPriorOIDStopFlags marks OID §6.1–6.5 stopped flags without proving §6.7 DDL entry drain.
func SetPriorOIDStopFlags(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `UPDATE harness_ddl_state SET legacy_writer_stopped=true,dom_api_stopped=true,gm_import_stopped=true,snapshot_flush_stopped=true,restore_job_stopped=true`)
	return err
}

// SetExplicitMigrationStopped stops apply_specs and manual_migration paths; lazy_store may remain live.
func SetExplicitMigrationStopped(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `UPDATE harness_ddl_state SET explicit_apply_specs_stopped=true,manual_migration_stopped=true`)
	return err
}

func ClearOwnerClaims(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `DELETE FROM harness_ddl_owner_claim`)
	return err
}

func TryClaimMigrationOwner(ctx context.Context, pool *pgxpool.Pool, role string) error {
	_, err := pool.Exec(ctx, `INSERT INTO harness_ddl_owner_claim(role) VALUES ($1)`, role)
	return err
}

func BumpProfileDrain(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `UPDATE harness_ddl_state SET profile_generation=profile_generation+1,local_drain_counter=local_drain_counter+1`)
	return err
}

// SeedRetention inserts durable_state=2 command, actor slot head, capital player_city, and bumps allocator highwater.
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
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `UPDATE harness_ddl_allocator_highwater SET highwater=$1 WHERE single_row`, cityID)
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

func (c *Controller) AllocatorHighwater(ctx context.Context, pool *pgxpool.Pool) (int64, error) {
	var hw int64
	err := pool.QueryRow(ctx, `SELECT highwater FROM harness_ddl_allocator_highwater`).Scan(&hw)
	return hw, err
}

func (c *Controller) HeadCommandID(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	var head string
	err := pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&head)
	return head, err
}

// OpenHarnessConn opens a second TCP connection with disposable schema search_path (observer / DDL hold).
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

// DDLHoldOpen reports whether an independent observer still sees the DDL hold lock.
func DDLHoldOpen(ctx context.Context, obs *pgx.Conn) bool {
	var one int
	return obs.QueryRow(ctx, `SELECT slot FROM harness_ddl_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&one) != nil
}

// TryLedgerCommandRowLockObserver acquires NOWAIT lock on retained ledger command row (table/row lock only).
func TryLedgerCommandRowLockObserver(ctx context.Context, obs *pgx.Conn, realmID string, serverID int32, playerID int64) (cmdID string, ok bool) {
	err := obs.QueryRow(ctx, `SELECT command_id::text FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE NOWAIT`, realmID, serverID, playerID).Scan(&cmdID)
	return cmdID, err == nil
}

// TryCommitEmptyIntake attempts lawful EMPTY intake under DDL exclusion (DDL hold must be drained).
func (c *Controller) TryCommitEmptyIntake(ctx context.Context, tx pgx.Tx, acct int64, cmdID, name string, x, y int) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	var active bool
	if err := tx.QueryRow(ctx, `SELECT exclusion_active FROM harness_ddl_state`).Scan(&active); err != nil {
		return false, err
	}
	if active {
		var held int
		if err := tx.QueryRow(ctx, `SELECT slot FROM harness_ddl_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&held); err != nil {
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
