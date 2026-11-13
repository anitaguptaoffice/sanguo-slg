// SPEC-FIRST-CITY-LEDGER-ONLINE-EXCLUSION-001: §9/§11 leftover conn / direct SQL / drain PG17.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const realm = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55"

var ctx = context.Background()
var baseDir, dsn, harnessSchema string
var admin *pgxpool.Pool
var serial int

func must(err error)           { if err != nil { panic(err) } }
func assert(ok bool, m string) { if !ok { panic(m) } }
func exec(p *pgxpool.Pool, sql string, a ...any) { _, e := p.Exec(ctx, sql, a...); must(e) }
func apply(p *pgxpool.Pool)                      { must(db.ApplySpecs(ctx, p, baseDir)) }

func c1(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-online-specs-")
	must(err)
	var paths []string
	for _, pat := range []string{"00*.sql", "m3_*.sql", "m4_*.sql"} {
		m, err := filepath.Glob("spec/db/" + pat)
		must(err)
		paths = append(paths, m...)
	}
	sort.Strings(paths)
	for _, path := range paths {
		data, err := os.ReadFile(path)
		must(err)
		must(os.WriteFile(filepath.Join(baseDir, filepath.Base(path)), data, 0o600))
	}
}

func connectHarness() *pgx.Conn {
	c, err := pgx.Connect(ctx, dsn)
	must(err)
	_, err = c.Exec(ctx, "SET search_path TO "+harnessSchema)
	must(err)
	return c
}

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_online_%x_%d", serial, serial)
	exec(admin, "CREATE SCHEMA "+schema)
	harnessSchema = schema
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func installFixture(p *pgxpool.Pool) {
	exec(p, `CREATE TABLE harness_mapping_fence_realm (realm_id uuid PRIMARY KEY,cluster_id text,database_name text,schema_name text,
 shard_actor_domain text,city_queue_allocator text,account_binding_authority text,writer_authority text,
 mapping_row_valid bool NOT NULL DEFAULT true,continuous_fence_ok bool NOT NULL DEFAULT true)`)
	exec(p, `CREATE TABLE harness_online_exclusion_state (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),
 exclusion_active bool NOT NULL DEFAULT false,local_drain_counter int NOT NULL DEFAULT 0); INSERT INTO harness_online_exclusion_state DEFAULT VALUES`)
	exec(p, `CREATE TABLE harness_legacy_hold (slot int PRIMARY KEY CHECK (slot=1)); INSERT INTO harness_legacy_hold VALUES (1)`)
	exec(p, `CREATE SEQUENCE harness_city_queue_alloc_seq START 88000`)
	exec(p, `CREATE TABLE harness_mapping_proposal (command_id uuid PRIMARY KEY,city_name text NOT NULL,map_x int,map_y int)`)
	exec(p, `CREATE OR REPLACE FUNCTION harness_city_alloc(v bigint DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql AS $$
 BEGIN IF (SELECT exclusion_active FROM harness_online_exclusion_state) THEN
  RAISE EXCEPTION 'exclusion blocks allocator progress'; END IF;
 IF v IS NULL THEN RETURN nextval('harness_city_queue_alloc_seq'); END IF;
 PERFORM setval('harness_city_queue_alloc_seq', v, true); RETURN v; END$$`)
	exec(p, `CREATE OR REPLACE FUNCTION harness_block_bypass_first_city() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF (SELECT exclusion_active FROM harness_online_exclusion_state)
  AND coalesce(current_setting('harness.ledger_intake', true), '') <> '1' THEN
  RAISE EXCEPTION 'exclusion blocks bypass intake'; END IF; RETURN NEW; END$$`)
	exec(p, `CREATE TRIGGER trg_harness_bypass BEFORE INSERT ON world_first_city_command
 FOR EACH ROW EXECUTE FUNCTION harness_block_bypass_first_city()`)
}

func seed(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('on_u','on_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'on_p')`, acct)
	return acct
}

func bindAuthority(acct int64) string { return fmt.Sprintf("server:1:player:42:account:%d", acct) }

func writeMapping(p *pgxpool.Pool, acct int64) {
	var dbName string
	must(p.QueryRow(ctx, `SELECT current_database()`).Scan(&dbName))
	exec(p, `INSERT INTO harness_mapping_fence_realm VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,true,true)`,
		realm, "harness-cluster-1", dbName, harnessSchema, "shard:1:actor:42", "harness-city-queue-alloc", bindAuthority(acct), "harness-writer-v1")
}

func setExclusion(p *pgxpool.Pool, on bool) { exec(p, `UPDATE harness_online_exclusion_state SET exclusion_active=$1`, on) }

func seedRetention(p *pgxpool.Pool, acct int64) {
	cmd := "b1111111-1111-4111-8111-111111111111"
	c1b, fct1, sha := c1("保留城", 5, 6)
	exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,
 success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,2,'t','r','c',1,$5,$6,now(),now(),88001,1,42,true,1,100)`, realm, cmd, acct, c1b, fct1, sha)
	exec(p, `INSERT INTO world_first_city_actor_slot VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmd)
	exec(p, `INSERT INTO harness_mapping_proposal VALUES ($1::uuid,'保留城',5,6)`, cmd)
}

func mappingFenceOK(tx pgx.Tx, acct int64) (bool, error) {
	var cluster, dbName, schema, shard, alloc, bind, writer *string
	var mapValid, fenceOK bool
	err := tx.QueryRow(ctx, `SELECT cluster_id,database_name,schema_name,shard_actor_domain,city_queue_allocator,
 account_binding_authority,writer_authority,mapping_row_valid,continuous_fence_ok
 FROM harness_mapping_fence_realm WHERE realm_id=$1::uuid`, realm).Scan(
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
	return *dbName == curDB && *schema == curSchema && *bind == bindAuthority(acct), nil
}

func legacyDrainOpen(obs *pgx.Conn) bool {
	var one int
	return obs.QueryRow(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&one) != nil
}

func counts(pool *pgxpool.Pool) (cmdN, propN int) {
	c, err := pool.Acquire(ctx)
	must(err)
	defer c.Release()
	must(c.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&cmdN))
	must(c.QueryRow(ctx, `SELECT count(*) FROM harness_mapping_proposal`).Scan(&propN))
	return
}

func intakeOnline(tx pgx.Tx, acct int64, cmdID string, pred *string, name string, x, y int) (bool, error) {
	if ok, _ := mappingFenceOK(tx, acct); !ok {
		return false, tx.Rollback(ctx)
	}
	var active bool
	_ = tx.QueryRow(ctx, `SELECT exclusion_active FROM harness_online_exclusion_state`).Scan(&active)
	if active {
		var held int
		if err := tx.QueryRow(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&held); err != nil {
			return false, tx.Rollback(ctx)
		}
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('harness.ledger_intake','1',true)`); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`, realm, acct); err != nil {
		return false, err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil {
		return false, err
	}
	if pred == nil {
		if head != nil {
			return false, tx.Rollback(ctx)
		}
	} else if head == nil || *head != *pred {
		return false, tx.Rollback(ctx)
	}
	c1b, fct1, sha := c1(name, x, y)
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdID, acct, c1b, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	updSQL := `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`
	args := []any{realm, cmdID}
	if pred != nil {
		updSQL = `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id=$3::uuid`
		args = append(args, *pred)
	}
	var upd pgconn.CommandTag
	if upd, err = tx.Exec(ctx, updSQL, args...); err != nil || upd.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO harness_mapping_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func withTx(p *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) bool {
	c, err := p.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	ok, err := fn(tx)
	must(err)
	return ok
}

func sOldConnUncommitted(pool *pgxpool.Pool, acct int64) {
	writeMapping(pool, acct)
	seedRetention(pool, acct)
	setExclusion(pool, true)
	legacy := connectHarness()
	defer func() { _ = legacy.Close(ctx) }()
	tx, err := legacy.Begin(ctx)
	must(err)
	_, err = tx.Exec(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE`)
	must(err)
	c1b, fct1, sha := c1("旧连接城", 7, 8)
	_, bypassErr := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,'b2222222-2222-4222-8222-222222222222'::uuid,$2,$3,1,'t','r','c',1,$4,$5,now())`, realm, acct, c1b, fct1, sha)
	assert(bypassErr != nil, "bypass blocked under exclusion")
	cmdN, propN := counts(pool)
	assert(cmdN == 1 && propN == 1, "retention unchanged while legacy holds")
	must(tx.Rollback(ctx))
	cmdN, propN = counts(pool)
	assert(cmdN == 1 && propN == 1, "rollback leaves retention")
	fmt.Println("PASS online_exclusion: old_connection_uncommitted_txn_blocked")
}

func sDirectSQLBypass(pool *pgxpool.Pool, acct int64) {
	writeMapping(pool, acct)
	seedRetention(pool, acct)
	setExclusion(pool, true)
	c1b, fct1, sha := c1("伪造", 1, 1)
	_, err := pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,
 success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,1,42,'b4444444-4444-4444-8444-444444444444'::uuid,$2,$3,2,'t','r','c',1,$4,$5,now(),now(),88002,1,42,true,1,100)`, realm, acct, c1b, fct1, sha)
	assert(err != nil, "direct SQL bypass rejected")
	cmdN, propN := counts(pool)
	assert(cmdN == 1 && propN == 1, "no forged first-city row")
	fmt.Println("PASS online_exclusion: direct_sql_bypass_intake_fail_closed")
}

func sNextvalSetval(pool *pgxpool.Pool, acct int64) {
	writeMapping(pool, acct)
	seedRetention(pool, acct)
	setExclusion(pool, true)
	_, err := pool.Exec(ctx, `SELECT harness_city_alloc()`)
	assert(err != nil, "nextval blocked")
	_, err = pool.Exec(ctx, `SELECT harness_city_alloc(88100)`)
	assert(err != nil, "setval blocked under exclusion")
	var seq int64
	must(pool.QueryRow(ctx, `SELECT last_value FROM harness_city_queue_alloc_seq`).Scan(&seq))
	assert(seq == 88000, "allocator progress unchanged")
	cmdN, propN := counts(pool)
	assert(cmdN == 1 && propN == 1, "no new first command after allocator attack")
	fmt.Println("PASS online_exclusion: independent_nextval_setval_fail_closed")
}

func sLastTxnFalseDrain(pool *pgxpool.Pool, acct int64) {
	writeMapping(pool, acct)
	setExclusion(pool, true)
	legacy := connectHarness()
	defer func() { _ = legacy.Close(ctx) }()
	tx, err := legacy.Begin(ctx)
	must(err)
	_, err = tx.Exec(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE`)
	must(err)
	exec(pool, `UPDATE harness_online_exclusion_state SET local_drain_counter=local_drain_counter+1`)
	obs := connectHarness()
	defer func() { _ = obs.Close(ctx) }()
	assert(legacyDrainOpen(obs), "observer sees last active legacy txn")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeOnline(tx, acct, "b5555555-5555-4555-8555-555555555555", nil, "假排空", 11, 12)
	}), "local drain counter does not unlock EMPTY")
	must(tx.Commit(ctx))
	assert(!legacyDrainOpen(obs), "legacy ended")
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeOnline(tx, acct, "b6666666-6666-4666-8666-666666666666", nil, "排空后续", 13, 14)
	}), "after real drain, lawful EMPTY on empty slot")
	cmdN, propN := counts(pool)
	assert(cmdN == 1 && propN == 1, "post-drain intake visible")
	fmt.Println("PASS online_exclusion: last_active_txn_no_false_drain")
}

func sLawfulMultiCity(pool *pgxpool.Pool, acct int64) {
	writeMapping(pool, acct)
	cmd := "b7777777-7777-4777-8777-777777777777"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intakeOnline(tx, acct, cmd, nil, "首城", 20, 21) }), "first intake")
	exec(pool, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),success_city_id=88001,
 success_server_id=1,success_player_id=42,success_is_capital=true,success_wall_level=1,success_morale=100 WHERE command_id=$1::uuid`, cmd)
	exec(pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'首城',20,21,true)`)
	exec(pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88020,42,'分城',30,31,false)`)
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&n))
	assert(n == 2, "lawful multi-city not blocked by online exclusion card")
	fmt.Println("PASS online_exclusion: lawful_multi_city_not_blocked")
}

func main() {
	assert(os.Getenv("ALLOW_OWNED_PG17_TEST") == "1", "ALLOW_OWNED_PG17_TEST=1 required")
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	assert(dsn != "", "FIRST_CITY_LEDGER_TEST_DSN required")
	stageSpecDir()
	defer func() { _ = os.RemoveAll(baseDir) }()
	var err error
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	var ver, major string
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	must(admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)
	run := func(fn func(*pgxpool.Pool, int64)) {
		pool, done := fresh()
		defer done()
		apply(pool)
		installFixture(pool)
		fn(pool, seed(pool))
	}
	for _, fn := range []func(*pgxpool.Pool, int64){sOldConnUncommitted, sDirectSQLBypass, sNextvalSetval, sLastTxnFalseDrain, sLawfulMultiCity} {
		run(fn)
	}
	fmt.Println("MODE: isolated PG17 online exclusion; not production old-writer/realm fence/controller")
}
