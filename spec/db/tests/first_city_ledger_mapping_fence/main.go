// SPEC-FIRST-CITY-LEDGER-MAPPING-FENCE-001: §9/§11 mapping+fence fail-closed on disposable PG17.
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

const realm = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11"

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
	baseDir, err = os.MkdirTemp("", "fc-mapping-specs-")
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

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_mapping_%x_%d", serial, serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	harnessSchema = schema
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func installFixture(p *pgxpool.Pool) {
	exec(p, `CREATE TABLE harness_mapping_fence_realm (realm_id uuid PRIMARY KEY,ledger_namespace text,cluster_id text,
 database_name text,schema_name text,shard_actor_domain text,city_queue_allocator text,account_binding_authority text,
 writer_authority text,mapping_row_valid bool NOT NULL DEFAULT true,continuous_fence_ok bool NOT NULL DEFAULT true)`)
	exec(p, `CREATE TABLE harness_mapping_proposal (command_id uuid PRIMARY KEY,city_name text NOT NULL,map_x int,map_y int)`)
}

func seed(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('map_u','map_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'map_p')`, acct)
	return acct
}

func bindingAuthority(acct int64) string {
	return fmt.Sprintf("server:1:player:42:account:%d", acct)
}

func writeMapping(p *pgxpool.Pool, ns, cluster, dbName, schema, shard, alloc, bind, writer *string, mapValid, fenceOK bool) {
	exec(p, `INSERT INTO harness_mapping_fence_realm (realm_id,ledger_namespace,cluster_id,database_name,schema_name,
 shard_actor_domain,city_queue_allocator,account_binding_authority,writer_authority,mapping_row_valid,continuous_fence_ok)
 VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
 ON CONFLICT (realm_id) DO UPDATE SET
 ledger_namespace=EXCLUDED.ledger_namespace,cluster_id=EXCLUDED.cluster_id,database_name=EXCLUDED.database_name,
 schema_name=EXCLUDED.schema_name,shard_actor_domain=EXCLUDED.shard_actor_domain,
 city_queue_allocator=EXCLUDED.city_queue_allocator,account_binding_authority=EXCLUDED.account_binding_authority,
 writer_authority=EXCLUDED.writer_authority,mapping_row_valid=EXCLUDED.mapping_row_valid,
 continuous_fence_ok=EXCLUDED.continuous_fence_ok`, realm, ns, cluster, dbName, schema, shard, alloc, bind, writer, mapValid, fenceOK)
}

func fullMapping(p *pgxpool.Pool, acct int64) {
	var dbName string
	must(p.QueryRow(ctx, `SELECT current_database()`).Scan(&dbName))
	ns, c, sch := "harness-ledger-ns", "harness-cluster-1", harnessSchema
	sh, alloc, w := "shard:1:actor:42", "harness-city-queue-alloc", "harness-writer-v1"
	bind := bindingAuthority(acct)
	writeMapping(p, &ns, &c, &dbName, &sch, &sh, &alloc, &bind, &w, true, true)
}

func termSucc(p *pgxpool.Pool, cmd string) {
	tag, err := p.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=88001,success_server_id=1,success_player_id=42,success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE command_id=$1::uuid AND durable_state=1`, cmd)
	must(err)
	assert(tag.RowsAffected() == 1, "term success")
}

func mappingFenceOK(tx pgx.Tx, acct int64) (bool, error) {
	var ns, cluster, dbName, schema, shard, alloc, bind, writer *string
	var mapValid, fenceOK bool
	err := tx.QueryRow(ctx, `SELECT ledger_namespace,cluster_id,database_name,schema_name,shard_actor_domain,
 city_queue_allocator,account_binding_authority,writer_authority,mapping_row_valid,continuous_fence_ok
 FROM harness_mapping_fence_realm WHERE realm_id=$1::uuid`, realm).Scan(
		&ns, &cluster, &dbName, &schema, &shard, &alloc, &bind, &writer, &mapValid, &fenceOK)
	if err != nil {
		return false, nil // missing row → fail closed
	}
	if !mapValid || !fenceOK {
		return false, nil
	}
	req := []*string{cluster, dbName, schema, shard, alloc, bind, writer}
	for _, p := range req {
		if p == nil || *p == "" {
			return false, nil
		}
	}
	var curDB, curSchema string
	if err = tx.QueryRow(ctx, `SELECT current_database(), current_schema()`).Scan(&curDB, &curSchema); err != nil {
		return false, err
	}
	if *dbName != curDB || *schema != curSchema {
		return false, nil
	}
	if *bind != bindingAuthority(acct) {
		return false, nil
	}
	_ = ns // namespace alone never sufficient
	return true, nil
}

func lineageN(tx pgx.Tx) (int, error) {
	var n int
	err := tx.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&n)
	return n, err
}

func intakeMapping(tx pgx.Tx, acct int64, cmdID string, pred *string, name string, x, y int) (bool, error) {
	_, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`, realm, acct)
	if err != nil {
		return false, err
	}
	var head *string
	err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head)
	if err != nil {
		return false, err
	}
	if pred == nil {
		if head != nil {
			return false, tx.Rollback(ctx)
		}
		n, err := lineageN(tx)
		if err != nil || n > 0 {
			return false, tx.Rollback(ctx)
		}
		ok, err := mappingFenceOK(tx, acct)
		if err != nil || !ok {
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
	if _, err = tx.Exec(ctx, `INSERT INTO harness_mapping_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
		return false, tx.Rollback(ctx)
	}
	var upd pgconn.CommandTag
	if pred == nil {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmdID)
	} else {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id=$3::uuid`, realm, cmdID, *pred)
	}
	if err != nil || upd.RowsAffected() != 1 {
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

func observe(pool *pgxpool.Pool, cmd string) (head string, st int16, name string, cmdN, propN int) {
	obs, err := pool.Acquire(ctx)
	must(err)
	defer obs.Release()
	_ = obs.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head)
	if cmd != "" {
		err := obs.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st)
		if err == nil {
			_ = obs.QueryRow(ctx, `SELECT city_name FROM harness_mapping_proposal WHERE command_id=$1::uuid`, cmd).Scan(&name)
		}
	}
	must(obs.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&cmdN))
	must(obs.QueryRow(ctx, `SELECT count(*) FROM harness_mapping_proposal`).Scan(&propN))
	return
}

func sMissingMapping(pool *pgxpool.Pool, acct int64) {
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, "a1111111-1111-4111-8111-111111111111", nil, "无映射", 1, 2)
	}), "no mapping row blocks EMPTY")
	_, _, _, cmdN, propN := observe(pool, "")
	assert(cmdN == 0 && propN == 0, "observer: no new first command")
	fmt.Println("PASS mapping_fence: missing_physical_mapping_no_empty_initial")
}

func sNamespaceOnly(pool *pgxpool.Pool, acct int64) {
	ns := "label-only-realm-ns"
	writeMapping(pool, &ns, nil, nil, nil, nil, nil, nil, nil, true, true)
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, "a2222222-2222-4222-8222-222222222222", nil, "仅标签", 3, 4)
	}), "namespace label not isolation")
	_, _, _, cmdN, propN := observe(pool, "")
	assert(cmdN == 0 && propN == 0, "no intake under label-only")
	fmt.Println("PASS mapping_fence: namespace_label_only_fail_closed")
}

func sBrokenMapping(pool *pgxpool.Pool, acct int64) {
	var dbName string
	must(pool.QueryRow(ctx, `SELECT current_database()`).Scan(&dbName))
	ns, c, sch := "harness-ledger-ns", "harness-cluster-1", harnessSchema
	sh, alloc, bind, w := "shard:1:actor:42", "harness-city-queue-alloc", bindingAuthority(acct), "harness-writer-v1"
	writeMapping(pool, &ns, &c, &dbName, &sch, nil, &alloc, &bind, &w, true, true)
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, "a4444444-4444-4444-8444-444444444444", nil, "缺段", 12, 13)
	}), "incomplete mapping blocks EMPTY on empty slot")
	bad := "server:1:player:99:account:0"
	writeMapping(pool, &ns, &c, &dbName, &sch, &sh, &alloc, &bad, &w, true, true)
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, "a5555555-5555-4555-8555-555555555555", nil, "矛盾", 14, 15)
	}), "contradictory binding blocks EMPTY on empty slot")
	cmd := "a3333333-3333-4333-8333-333333333333"
	c1b, fct1, sha := c1("保留城", 10, 11)
	fullMapping(pool, acct)
	exec(pool, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,
 success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,2,'t','r','c',1,$5,$6,now(),now(),88001,1,42,true,1,100)`, realm, cmd, acct, c1b, fct1, sha)
	exec(pool, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmd)
	exec(pool, `INSERT INTO harness_mapping_proposal VALUES ($1::uuid,'保留城',10,11)`, cmd)
	writeMapping(pool, &ns, &c, &dbName, &sch, &sh, &alloc, &bad, &w, true, true)
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, "a6666666-6666-4666-8666-666666666666", nil, "旧未知", 16, 17)
	}), "bad mapping blocks even if head nonempty")
	head, st, name, n, _ := observe(pool, cmd)
	assert(head == cmd && st == 2 && name == "保留城" && n == 1, "retained lineage under bad mapping")
	fmt.Println("PASS mapping_fence: broken_or_stale_mapping_no_empty_no_autofill")
}

func sFenceInvalidAfterGood(pool *pgxpool.Pool, acct int64) {
	fullMapping(pool, acct)
	cmd := "a6666666-6666-4666-8666-666666666666"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, cmd, nil, "合法 intake", 20, 21)
	}), "intake under good mapping")
	termSucc(pool, cmd)
	head, st, name, n, _ := observe(pool, cmd)
	assert(head == cmd && st == 2 && name == "合法 intake" && n == 1, "retained row before invalidation")
	exec(pool, `UPDATE harness_mapping_fence_realm SET mapping_row_valid=false WHERE realm_id=$1::uuid`, realm)
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, "a7777777-7777-4777-8777-777777777777", nil, "映射失效", 22, 23)
	}), "invalid mapping blocks new EMPTY")
	exec(pool, `UPDATE harness_mapping_fence_realm SET mapping_row_valid=true,continuous_fence_ok=false WHERE realm_id=$1::uuid`, realm)
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, "a8888888-8888-4888-8888-888888888888", nil, "fence失效", 24, 25)
	}), "fence loss blocks new EMPTY")
	head, st, name, n, _ = observe(pool, cmd)
	assert(head == cmd && st == 2 && name == "合法 intake" && n == 1, "original retention survives")
	fmt.Println("PASS mapping_fence: mapping_or_fence_invalidation_blocks_empty")
}

func sLawfulMultiCity(pool *pgxpool.Pool, acct int64) {
	fullMapping(pool, acct)
	cmd := "a9999999-9999-4999-8999-999999999999"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeMapping(tx, acct, cmd, nil, "首城", 30, 31)
	}), "first intake")
	termSucc(pool, cmd)
	exec(pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'首城',30,31,true)`)
	exec(pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88020,42,'分城',40,41,false)`)
	var cities int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&cities))
	assert(cities == 2, "lawful multi-city under good mapping+fence")
	head, st, _, _, _ := observe(pool, cmd)
	assert(head == cmd && st == 2, "slot head unchanged")
	fmt.Println("PASS mapping_fence: lawful_multi_city_not_blocked")
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
	for _, fn := range []func(*pgxpool.Pool, int64){sMissingMapping, sNamespaceOnly, sBrokenMapping, sFenceInvalidAfterGood, sLawfulMultiCity} {
		run(fn)
	}
	fmt.Println("MODE: isolated PG17 mapping/fence fail-closed; not production fence/realm enroll")
}
