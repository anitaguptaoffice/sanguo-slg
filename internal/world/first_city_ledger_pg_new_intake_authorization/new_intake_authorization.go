package firstcityledgerpgnewintakeauthorization

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var ErrUnauthorized = errors.New("firstcityledgerpgnewintakeauthorization: route unauthorized (obligations)")

// Controller gates new-ledger route subprocess; default fail-closed without §5/§6 obligation evidence.
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

func bindAuthority(serverID int32, playerID, acct int64) string {
	return fmt.Sprintf("server:%d:player:%d:account:%d", serverID, playerID, acct)
}

// InstallDisposableFixture installs harness_nia_* tables/triggers matching frozen spec harness.
func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool, realmID string) error {
	if pool == nil || realmID == "" {
		return ErrUnauthorized
	}
	block := fmt.Sprintf(`CREATE OR REPLACE FUNCTION harness_block_nia_capital() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF harness_nia_apply_live() AND NEW.is_capital THEN
  IF NOT harness_nia_route_authorized() THEN RAISE EXCEPTION 'new ledger route unauthorized for capital'; END IF;
 END IF; RETURN NEW; END$$`)
	authFn := fmt.Sprintf(`CREATE OR REPLACE FUNCTION harness_nia_route_authorized() RETURNS bool LANGUAGE plpgsql AS $$
DECLARE rid uuid := '%s'::uuid;
BEGIN
 IF NOT coalesce((SELECT profile_complete FROM harness_nia_profile WHERE realm_id=rid), false) THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM harness_nia_inventory WHERE NOT drain_evidence_ok) THEN RETURN false; END IF;
 IF NOT (SELECT through_commit_drain_ok FROM harness_nia_obligations) THEN RETURN false; END IF;
 RETURN true;
END$$`, realmID)
	steps := []string{
		`CREATE TABLE IF NOT EXISTS harness_nia_profile (realm_id uuid PRIMARY KEY,cluster_id text,database_name text,schema_name text,
 shard_actor_domain text,city_queue_allocator text,account_binding_authority text,writer_authority text,profile_complete bool NOT NULL DEFAULT false)`,
		`CREATE TABLE IF NOT EXISTS harness_nia_inventory (path_row int PRIMARY KEY CHECK (path_row BETWEEN 1 AND 11),drain_evidence_ok bool NOT NULL DEFAULT false)`,
		`INSERT INTO harness_nia_inventory SELECT g, false FROM generate_series(1,11) g ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS harness_nia_obligations (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),
 through_commit_drain_ok bool NOT NULL DEFAULT false,local_drain_counter int NOT NULL DEFAULT 0)`,
		`INSERT INTO harness_nia_obligations DEFAULT VALUES ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS harness_nia_allocator_highwater (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),highwater bigint NOT NULL DEFAULT 88150)`,
		`INSERT INTO harness_nia_allocator_highwater DEFAULT VALUES ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS harness_nia_hold (slot int PRIMARY KEY CHECK (slot=1))`,
		`INSERT INTO harness_nia_hold VALUES (1) ON CONFLICT DO NOTHING`,
		authFn,
		`CREATE OR REPLACE FUNCTION harness_nia_apply_live() RETURNS bool LANGUAGE plpgsql AS $$
 BEGIN RETURN coalesce(current_setting('harness.new_ledger_route', true), '') = '1'; END$$`,
		block,
		`DROP TRIGGER IF EXISTS trg_nia_cap ON player_city`,
		`CREATE TRIGGER trg_nia_cap BEFORE INSERT ON player_city FOR EACH ROW EXECUTE FUNCTION harness_block_nia_capital()`,
		`CREATE OR REPLACE FUNCTION harness_prevent_empty_reopen() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF OLD.head_command_id IS NOT NULL AND NEW.head_command_id IS NULL
  AND EXISTS (SELECT 1 FROM world_first_city_command WHERE command_id=OLD.head_command_id AND durable_state IN (2,3)) THEN
  RAISE EXCEPTION 'cannot reopen EMPTY with retained lineage';
 END IF; RETURN NEW; END$$`,
		`DROP TRIGGER IF EXISTS trg_nia_no_empty ON world_first_city_actor_slot`,
		`CREATE TRIGGER trg_nia_no_empty BEFORE UPDATE ON world_first_city_actor_slot FOR EACH ROW EXECUTE FUNCTION harness_prevent_empty_reopen()`,
	}
	for _, sql := range steps {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return err
		}
	}
	return nil
}

// SyncObligationsToDB materializes controller evidence into harness tables (not authorization by itself).
func (c *Controller) SyncObligationsToDB(ctx context.Context, pool *pgxpool.Pool, acct int64, schema string) error {
	if pool == nil {
		return ErrUnauthorized
	}
	var dbName string
	if err := pool.QueryRow(ctx, `SELECT current_database()`).Scan(&dbName); err != nil {
		return err
	}
	_, err := pool.Exec(ctx, `INSERT INTO harness_nia_profile VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9)
 ON CONFLICT (realm_id) DO UPDATE SET profile_complete=EXCLUDED.profile_complete`,
		c.RealmID, "h-cluster", dbName, schema, "shard:1:42", "harness-alloc",
		bindAuthority(c.ServerID, c.PlayerID, acct), "harness-writer-v1", c.Evidence.ProfileComplete)
	if err != nil {
		return err
	}
	for i, ok := range c.Evidence.InventoryDrainEvidence {
		if _, err := pool.Exec(ctx, `UPDATE harness_nia_inventory SET drain_evidence_ok=$2 WHERE path_row=$1`, i+1, ok); err != nil {
			return err
		}
	}
	_, err = pool.Exec(ctx, `UPDATE harness_nia_obligations SET through_commit_drain_ok=$1`, c.Evidence.ThroughCommitDrainOK)
	return err
}

func BumpLocalDrainCounter(ctx context.Context, pool *pgxpool.Pool, n int) error {
	_, err := pool.Exec(ctx, `UPDATE harness_nia_obligations SET local_drain_counter=$1`, n)
	return err
}

func SetInventoryDrainUpTo(ctx context.Context, pool *pgxpool.Pool, maxRow int, ok bool) error {
	_, err := pool.Exec(ctx, `UPDATE harness_nia_inventory SET drain_evidence_ok=$2 WHERE path_row<=$1`, maxRow, ok)
	return err
}

func canonicalPayload(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

// SeedRetention inserts durable_state=2 command, slot head, capital city, allocator highwater (requires full obligations).
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
	_, err = pool.Exec(ctx, `UPDATE harness_nia_allocator_highwater SET highwater=$1 WHERE single_row`, cityID)
	return err
}

type RowCounts struct {
	PlayerCityN int
	CommandN    int
}

func (c *Controller) Counts(ctx context.Context, pool *pgxpool.Pool) (RowCounts, error) {
	var rc RowCounts
	if pool == nil {
		return rc, ErrUnauthorized
	}
	err := pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=$1 AND player_id=$2`, c.ServerID, c.PlayerID).Scan(&rc.PlayerCityN)
	if err != nil {
		return rc, err
	}
	err = pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`,
		c.RealmID, c.ServerID, c.PlayerID).Scan(&rc.CommandN)
	return rc, err
}

func (c *Controller) AllocatorHighwater(ctx context.Context, pool *pgxpool.Pool) (int64, error) {
	var hw int64
	err := pool.QueryRow(ctx, `SELECT highwater FROM harness_nia_allocator_highwater`).Scan(&hw)
	return hw, err
}

func (c *Controller) HeadCommandID(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	var head string
	err := pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&head)
	return head, err
}

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

// TryHoldRowLockObserver acquires FOR UPDATE on harness_nia_hold (substitute fence probe).
func TryHoldRowLockObserver(ctx context.Context, obs *pgx.Conn) (bool, error) {
	var slot int
	err := obs.QueryRow(ctx, `SELECT slot FROM harness_nia_hold WHERE slot=1 FOR UPDATE`).Scan(&slot)
	return err == nil, err
}
