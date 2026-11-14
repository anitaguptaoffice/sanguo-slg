package firstcityledgerpgonlineexclusion

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

var ErrUnauthorized = errors.New("firstcityledgerpgonlineexclusion: route unauthorized (obligations)")

// Controller gates online-exclusion intake; default fail-closed without obligation evidence.
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

func BindingAuthority(serverID int32, playerID, accountID int64) string {
	return fmt.Sprintf("server:%d:player:%d:account:%d", serverID, playerID, accountID)
}

func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return ErrUnauthorized
	}
	steps := []string{
		`CREATE TABLE IF NOT EXISTS harness_mapping_fence_realm (realm_id uuid PRIMARY KEY,cluster_id text,database_name text,schema_name text,
 shard_actor_domain text,city_queue_allocator text,account_binding_authority text,writer_authority text,
 mapping_row_valid bool NOT NULL DEFAULT true,continuous_fence_ok bool NOT NULL DEFAULT true)`,
		`CREATE TABLE IF NOT EXISTS harness_online_exclusion_state (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),
 exclusion_active bool NOT NULL DEFAULT false,local_drain_counter int NOT NULL DEFAULT 0)`,
		`INSERT INTO harness_online_exclusion_state DEFAULT VALUES ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS harness_legacy_hold (slot int PRIMARY KEY CHECK (slot=1))`,
		`INSERT INTO harness_legacy_hold VALUES (1) ON CONFLICT DO NOTHING`,
		`CREATE SEQUENCE IF NOT EXISTS harness_city_queue_alloc_seq START 88000`,
		`CREATE TABLE IF NOT EXISTS harness_mapping_proposal (command_id uuid PRIMARY KEY,city_name text NOT NULL,map_x int,map_y int)`,
		`CREATE OR REPLACE FUNCTION harness_city_alloc(v bigint DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql AS $$
 BEGIN IF (SELECT exclusion_active FROM harness_online_exclusion_state) THEN
  RAISE EXCEPTION 'exclusion blocks allocator progress'; END IF;
 IF v IS NULL THEN RETURN nextval('harness_city_queue_alloc_seq'); END IF;
 PERFORM setval('harness_city_queue_alloc_seq', v, true); RETURN v; END$$`,
		`CREATE OR REPLACE FUNCTION harness_block_bypass_first_city() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF (SELECT exclusion_active FROM harness_online_exclusion_state)
  AND coalesce(current_setting('harness.ledger_intake', true), '') <> '1' THEN
  RAISE EXCEPTION 'exclusion blocks bypass intake'; END IF; RETURN NEW; END$$`,
		`DROP TRIGGER IF EXISTS trg_harness_bypass ON world_first_city_command`,
		`CREATE TRIGGER trg_harness_bypass BEFORE INSERT ON world_first_city_command
 FOR EACH ROW EXECUTE FUNCTION harness_block_bypass_first_city()`,
	}
	for _, sql := range steps {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return err
		}
	}
	return nil
}

func (c *Controller) WriteFullMapping(ctx context.Context, pool *pgxpool.Pool, acct int64, schema string) error {
	if pool == nil || !c.authorized() {
		return ErrUnauthorized
	}
	var dbName string
	if err := pool.QueryRow(ctx, `SELECT current_database()`).Scan(&dbName); err != nil {
		return err
	}
	cluster, sh, alloc, w := "harness-cluster-1", "shard:1:actor:42", "harness-city-queue-alloc", "harness-writer-v1"
	bind := BindingAuthority(c.ServerID, c.PlayerID, acct)
	_, err := pool.Exec(ctx, `INSERT INTO harness_mapping_fence_realm VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,true,true)`,
		c.RealmID, cluster, dbName, schema, sh, alloc, bind, w)
	return err
}

func SetExclusion(ctx context.Context, pool *pgxpool.Pool, on bool) error {
	_, err := pool.Exec(ctx, `UPDATE harness_online_exclusion_state SET exclusion_active=$1`, on)
	return err
}

func BumpLocalDrainCounter(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `UPDATE harness_online_exclusion_state SET local_drain_counter=local_drain_counter+1`)
	return err
}

func canonicalPayload(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

func (c *Controller) SeedRetention(ctx context.Context, pool *pgxpool.Pool, acct int64, cmdID, name string, x, y int) error {
	if pool == nil || !c.authorized() {
		return ErrUnauthorized
	}
	c1b, fct1, sha := canonicalPayload(name, x, y)
	_, err := pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,
 success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,2,'t','r','c',1,$7,$8,now(),now(),88001,$2,$3,true,1,100)`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1b, fct1, sha)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `INSERT INTO world_first_city_actor_slot VALUES ($1::uuid,$2,$3,$4,$5::uuid)`,
		c.RealmID, c.ServerID, c.PlayerID, acct, cmdID)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `INSERT INTO harness_mapping_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y)
	return err
}

func (c *Controller) mappingFenceOK(ctx context.Context, tx pgx.Tx, acct int64) (bool, error) {
	var cluster, dbName, schema, shard, alloc, bind, writer *string
	var mapValid, fenceOK bool
	err := tx.QueryRow(ctx, `SELECT cluster_id,database_name,schema_name,shard_actor_domain,city_queue_allocator,
 account_binding_authority,writer_authority,mapping_row_valid,continuous_fence_ok
 FROM harness_mapping_fence_realm WHERE realm_id=$1::uuid`, c.RealmID).Scan(
		&cluster, &dbName, &schema, &shard, &alloc, &bind, &writer, &mapValid, &fenceOK)
	if err != nil || !mapValid || !fenceOK {
		return false, err
	}
	for _, q := range []*string{cluster, dbName, schema, shard, alloc, bind, writer} {
		if q == nil || *q == "" {
			return false, nil
		}
	}
	var curDB, curSchema string
	if err = tx.QueryRow(ctx, `SELECT current_database(), current_schema()`).Scan(&curDB, &curSchema); err != nil {
		return false, err
	}
	return *dbName == curDB && *schema == curSchema && *bind == BindingAuthority(c.ServerID, c.PlayerID, acct), nil
}

// OpenHarnessConn opens a second TCP connection with disposable schema search_path (observer / legacy hold).
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

// LegacyDrainOpen reports whether an independent observer still sees the legacy hold lock (last active txn).
func LegacyDrainOpen(ctx context.Context, obs *pgx.Conn) bool {
	var one int
	return obs.QueryRow(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&one) != nil
}

// RowCounts is observer-visible command and proposal counts for the actor.
type RowCounts struct {
	CommandN  int
	ProposalN int
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
	err = pool.QueryRow(ctx, `SELECT count(*) FROM harness_mapping_proposal`).Scan(&rc.ProposalN)
	return rc, err
}

// TryCommitIntake runs lawful intake under mapping/fence and online-exclusion rules (pred nil = EMPTY-initial).
func (c *Controller) TryCommitIntake(ctx context.Context, tx pgx.Tx, acct int64, cmdID string, pred *string, name string, x, y int) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	ok, err := c.mappingFenceOK(ctx, tx, acct)
	if err != nil || !ok {
		return false, err
	}
	var active bool
	if err = tx.QueryRow(ctx, `SELECT exclusion_active FROM harness_online_exclusion_state`).Scan(&active); err != nil {
		return false, err
	}
	if active {
		var held int
		if err = tx.QueryRow(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&held); err != nil {
			return false, nil
		}
	}
	if _, err = tx.Exec(ctx, `SELECT set_config('harness.ledger_intake','1',true)`); err != nil {
		return false, err
	}
	if _, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return false, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		c.RealmID, c.ServerID, c.PlayerID, acct); err != nil {
		return false, err
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, c.RealmID, c.ServerID, c.PlayerID).Scan(&head); err != nil {
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
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1b, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	updSQL := `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`
	args := []any{c.RealmID, c.ServerID, c.PlayerID, cmdID}
	if pred != nil {
		updSQL = `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id=$5::uuid`
		args = append(args, *pred)
	}
	var upd pgconn.CommandTag
	if upd, err = tx.Exec(ctx, updSQL, args...); err != nil || upd.RowsAffected() != 1 {
		return false, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO harness_mapping_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
		return false, err
	}
	return true, nil
}
