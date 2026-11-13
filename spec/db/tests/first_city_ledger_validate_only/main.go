// SPEC-FIRST-CITY-LEDGER-VALIDATE-ONLY-001: disposable PG17 validate_only GUC contract.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	migration = "m4_013_first_city_ledger_validate_only.sql"
	gucName   = "sanguo.first_city_ledger_validate_only"
	realm     = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380dcc"
	seedFCT1  = `\x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`
	seedSHA32 = `\xabababababababababababababababababababababababababababababababab`
)

var (
	ctx    = context.Background()
	body   string
	baseDir string
	dsn    string
	admin  *pgxpool.Pool
	serial int
)

func must(err error)               { if err != nil { panic(err) } }
func assert(ok bool, msg string)   { if !ok { panic(msg) } }
func exec(p *pgxpool.Pool, sql string, a ...any) { _, e := p.Exec(ctx, sql, a...); must(e) }
func apply(p *pgxpool.Pool)       { must(db.ApplySpecs(ctx, p, baseDir)) }

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-validate-only-specs-")
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
	schema := fmt.Sprintf("fc_vo_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
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

func observerSnapshot(p *pgxpool.Pool) string {
	var b strings.Builder
	var n int
	must(p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid`, realm).Scan(&n))
	b.WriteString(fmt.Sprintf("cmd=%d;", n))
	var head string
	must(p.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head))
	b.WriteString("head=" + head + ";")
	for _, rel := range []string{"player_city", "player_wallet"} {
		must(p.QueryRow(ctx, fmt.Sprintf("SELECT count(*) FROM %s", rel)).Scan(&n))
		b.WriteString(rel + "=" + fmt.Sprint(n) + ";")
	}
	var seq string
	err := p.QueryRow(ctx, `SELECT last_value::text||':'||is_called FROM player_city_id_seq`).Scan(&seq)
	if err == nil {
		b.WriteString("player_city_id_seq=" + seq)
	} else {
		b.WriteString("player_city_id_seq=absent")
	}
	return b.String()
}

func catalogFP(p *pgxpool.Pool) string {
	return value(p, `SELECT jsonb_build_object(
  'cmd_trg',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname='world_first_city_command' AND NOT t.tgisinternal),
  'idx',(SELECT count(*) FROM pg_class WHERE relname='idx_world_first_city_command_one_pending_per_slot')
)::text`)
}

func value(p *pgxpool.Pool, sql string) string {
	var s string
	must(p.QueryRow(ctx, sql).Scan(&s))
	return s
}

func seedRow(p *pgxpool.Pool) {
	cmd := "41000000-0000-4000-8000-000000000001"
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('vo_u','vo_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'vo_p')`, acct)
	exec(p, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,'\x01',1,'t','r','c',1,$5,$4,now())`,
		realm, cmd, acct, seedSHA32, seedFCT1)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmd)
}

func runValidateTx(p *pgxpool.Pool, wantErr string) (gucDuring string) {
	tx, err := p.Begin(ctx)
	must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, "SET TRANSACTION READ ONLY; SET LOCAL "+gucName+"='true'")
	must(err)
	must(tx.QueryRow(ctx, "SELECT current_setting('"+gucName+"', true)").Scan(&gucDuring))
	_, err = tx.Exec(ctx, body)
	if wantErr == "" {
		must(err)
	} else {
		assert(err != nil && strings.Contains(err.Error(), wantErr), fmt.Sprintf("wanted %q got %v", wantErr, err))
	}
	must(tx.Rollback(ctx))
	return gucDuring
}

func is42501(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "42501"
}

func scenarioDefaultOff(p *pgxpool.Pool) {
	var guc string
	must(p.QueryRow(ctx, "SELECT current_setting('"+gucName+"', true)").Scan(&guc))
	assert(guc == "" || guc == "false", "default GUC must be off; got "+guc)
	runValidateTx(p, "requires READ ONLY")
	_, err := p.Exec(ctx, `UPDATE world_first_city_command SET durable_state=1
 WHERE realm_id=$1::uuid AND player_id=42`, realm)
	must(err)
	fmt.Println("PASS validate_only: default_guc_off_intake_writable")
}

func scenarioNoDurableWrite(p *pgxpool.Pool) {
	beforeObs, beforeCat := observerSnapshot(p), catalogFP(p)
	guc := runValidateTx(p, "")
	var afterGuc string
	must(p.QueryRow(ctx, "SELECT current_setting('"+gucName+"', true)").Scan(&afterGuc))
	assert(guc == "true" && (afterGuc == "" || afterGuc == "false"), "GUC local only; after tx off")
	assert(observerSnapshot(p) == beforeObs, "observer rows unchanged after validate ROLLBACK")
	assert(catalogFP(p) == beforeCat, "catalog fingerprint unchanged")
	fmt.Println("PASS validate_only: set_local_validate_no_durable_write guc_during="+guc)
}

func scenarioMissingRelations() {
	pool, done := fresh()
	defer done()
	// Only base schema files — no m4_010 ledger tables.
	partial, err := os.MkdirTemp("", "fc-vo-partial-")
	must(err)
	defer func() { _ = os.RemoveAll(partial) }()
	for _, pat := range []string{"00*.sql", "m3_*.sql"} {
		m, err := filepath.Glob("spec/db/" + pat)
		must(err)
		for _, path := range m {
			data, err := os.ReadFile(path)
			must(err)
			must(os.WriteFile(filepath.Join(partial, filepath.Base(path)), data, 0o600))
		}
	}
	must(db.ApplySpecs(ctx, pool, partial))
	before := value(pool, "SELECT count(*)::text FROM information_schema.tables WHERE table_schema=current_schema()")
	runValidateTx(pool, "missing")
	assert(value(pool, "SELECT count(*)::text FROM information_schema.tables WHERE table_schema=current_schema()") == before,
		"failed validate left catalog unchanged")
	fmt.Println("PASS validate_only: missing_relations_fail_closed_no_durable_write")
}

func scenarioNotBypassACL(p *pgxpool.Pool) {
	tag := fmt.Sprintf("%x", time.Now().UnixNano())
	role := "harness_fc_vo_disc_" + tag
	defer func() { _, _ = admin.Exec(ctx, "DROP ROLE IF EXISTS "+role) }()
	_, err := admin.Exec(ctx, "CREATE ROLE "+role+" NOLOGIN NOSUPERUSER INHERIT")
	must(err)
	_, err = admin.Exec(ctx, "GRANT "+role+" TO CURRENT_USER")
	must(err)
	schema := value(p, "SELECT current_schema()")
	exec(admin, "GRANT USAGE ON SCHEMA "+schema+" TO "+role)
	exec(admin, `GRANT SELECT ON TABLE `+schema+`.world_first_city_command, `+schema+`.world_first_city_actor_slot TO `+role)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 2
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	defer pool.Close()
	_, err = pool.Exec(ctx, "SET ROLE "+role)
	must(err)
	before := observerSnapshot(p)
	tx, err := pool.Begin(ctx)
	must(err)
	_, _ = tx.Exec(ctx, "SET TRANSACTION READ ONLY; SET LOCAL "+gucName+"='true'")
	_, err = tx.Exec(ctx, body)
	must(err)
	must(tx.Rollback(ctx))
	_, err = pool.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,99,'41000000-0000-4000-8000-0000000000ee',1,'\x02',1,'t','r','c',1,$3,$2,now())`,
		realm, seedSHA32, seedFCT1)
	assert(err != nil && is42501(err), "validate_only must not bypass ACL INSERT")
	assert(observerSnapshot(p) == before, "observer unchanged after ACL-denied INSERT")
	fmt.Println("PASS validate_only: guc_does_not_bypass_acl_42501")
}

func scenarioReadWriteTxnRejected(p *pgxpool.Pool) {
	tx, err := p.Begin(ctx)
	must(err)
	_, err = tx.Exec(ctx, "SET LOCAL "+gucName+"='true'")
	must(err)
	_, err = tx.Exec(ctx, body)
	assert(err != nil && strings.Contains(err.Error(), "READ ONLY"), "read/write txn rejected")
	must(tx.Rollback(ctx))
	fmt.Println("PASS validate_only: fail_closed_without_read_only_txn")
}

func main() {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" {
		fmt.Println("SKIP: ALLOW_OWNED_PG17_TEST=1 not set")
		return
	}
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	if dsn == "" {
		fmt.Println("SKIP: FIRST_CITY_LEDGER_TEST_DSN not set")
		return
	}
	data, err := os.ReadFile("spec/db/" + migration)
	must(err)
	body = string(data)
	stageSpecDir()
	defer func() { _ = os.RemoveAll(baseDir) }()
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	var ver, major string
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	must(admin.QueryRow(ctx, "SELECT (current_setting('server_version_num')::integer/10000)::text").Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)

	pool, done := fresh()
	defer done()
	apply(pool)
	seedRow(pool)

	scenarioDefaultOff(pool)
	scenarioNoDurableWrite(pool)
	scenarioMissingRelations()
	scenarioNotBypassACL(pool)
	scenarioReadWriteTxnRejected(pool)

	fmt.Println("MODE: PG17 validate_only; not realm-enrolled; player_city_id_seq not activated")
}
