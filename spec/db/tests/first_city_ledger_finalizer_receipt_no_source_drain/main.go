// SPEC-FIRST-CITY-LEDGER-FINALIZER-RECEIPT-NO-SOURCE-DRAIN-001: §7.7 finalizer receipt≠source drain; disposable PG17.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	realm       = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	cmdHead     = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"
	cmdSibling  = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55"
	cmdCompetOK = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66"
	mapX, mapY  = 10, 20
)

var ctx = context.Background()
var baseDir, dsn string
var admin *pgxpool.Pool
var serial int

func must(err error) {
	if err != nil {
		panic(err)
	}
}
func assert(ok bool, msg string) {
	if !ok {
		panic(msg)
	}
}
func exec(p *pgxpool.Pool, sql string, args ...any) { _, err := p.Exec(ctx, sql, args...); must(err) }
func apply(p *pgxpool.Pool)                         { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_frnsd_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 6
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-frnsd-specs-")
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

func installFixture(p *pgxpool.Pool) {
	exec(p, `CREATE TABLE harness_source_gate (realm_id uuid PRIMARY KEY, generation bigint NOT NULL DEFAULT 1,
 admission text NOT NULL DEFAULT 'closed' CHECK (admission IN ('open','closed','poisoned')),
 drain text NOT NULL DEFAULT 'unresolved' CHECK (drain IN ('pending','unresolved','drained')))`)
	exec(p, `CREATE TABLE harness_command (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL,
 ending text NOT NULL DEFAULT 'pending' CHECK (ending IN ('pending','unknown','known_success','known_reject')))`)
	exec(p, `INSERT INTO harness_source_gate (realm_id,admission,drain) VALUES ($1::uuid,'closed','unresolved')`, realm)
}

func gate(p *pgxpool.Pool) (adm, drain string) {
	must(p.QueryRow(ctx, `SELECT admission,drain FROM harness_source_gate WHERE realm_id=$1::uuid`, realm).Scan(&adm, &drain))
	return
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

func markUnknown(tx pgx.Tx, cmd string) (bool, error) {
	_, err := tx.Exec(ctx, `UPDATE harness_command SET ending='unknown' WHERE command_id=$1::uuid`, cmd)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func markKnownReject(tx pgx.Tx, cmd string) (bool, error) {
	_, err := tx.Exec(ctx, `UPDATE harness_command SET ending='known_reject' WHERE command_id=$1::uuid`, cmd)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func tryDeclareDrained(tx pgx.Tx) (bool, error) {
	var adm string
	if err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm).
		Scan(&adm); err != nil || adm != "closed" {
		return false, tx.Rollback(ctx)
	}
	var n int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_command WHERE realm_id=$1::uuid AND ending IN ('pending','unknown')`, realm).
		Scan(&n); err != nil || n > 0 {
		return false, tx.Rollback(ctx)
	}
	_, err := tx.Exec(ctx, `UPDATE harness_source_gate SET drain='drained' WHERE realm_id=$1::uuid`, realm)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func tryAcquire(tx pgx.Tx) (bool, error) {
	var adm, drain string
	if err := tx.QueryRow(ctx, `SELECT admission,drain FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm).
		Scan(&adm, &drain); err != nil || adm != "open" || drain == "drained" {
		return false, tx.Rollback(ctx)
	}
	return false, tx.Rollback(ctx)
}

func seedAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('frnsd_u','frnsd_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'frnsd_p')`, acct)
	return acct
}

func insertHcmd(p *pgxpool.Pool, cmd string) {
	exec(p, `INSERT INTO harness_command (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmd, realm)
}

func seedPendingHead(p *pgxpool.Pool, acct int64) {
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,1)`, mapX, mapY)
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdHead, acct, c1, fct1, sha)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmdHead)
	insertHcmd(p, cmdHead)
}

func seedCompetitorSuccess(p *pgxpool.Pool, acct int64) {
	c1, fct1, sha := "\\x02", "\\x"+strings.Repeat("11", 52), "\\x"+strings.Repeat("cd", 32)
	exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,
 terminal_at,success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,2,'t','r','c',1,$5,$6,now(),now(),88001,1,42,true,1,100)`,
		realm, cmdCompetOK, acct, c1, fct1, sha)
	insertHcmd(p, cmdCompetOK)
}

func finalizerRejectCommit(p *pgxpool.Pool) bool {
	c, err := p.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return false
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil || head == nil || *head != cmdHead {
		return false
	}
	var st int16
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`, cmdHead).
		Scan(&st); err != nil || st != 1 {
		return false
	}
	var terrain int16
	if err = tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&terrain); err != nil {
		return false
	}
	if terrain == 4 {
		return false
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE command_id=$1::uuid AND durable_state=1`, cmdHead)
	if err != nil || tag.RowsAffected() != 1 {
		return false
	}
	if err = tx.Commit(ctx); err != nil {
		return false
	}
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markKnownReject(tx, cmdHead) }), "harness ending")
	return true
}

func headState(p *pgxpool.Pool) int16 {
	var st int16
	must(p.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmdHead).Scan(&st))
	return st
}

func siblingEnding(p *pgxpool.Pool, cmd string) string {
	var e string
	must(p.QueryRow(ctx, `SELECT ending FROM harness_command WHERE command_id=$1::uuid`, cmd).Scan(&e))
	return e
}

func scenarioSiblingUnknown(p *pgxpool.Pool) {
	acct := seedAcct(p)
	seedPendingHead(p, acct)
	insertHcmd(p, cmdSibling)
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markUnknown(tx, cmdSibling) }), "sibling unknown")
	assert(finalizerRejectCommit(p), "finalizer commit")
	assert(headState(p) == 3, "head rejected")
	_, drain := gate(p)
	assert(drain == "unresolved", "drain unresolved")
	assert(!withTx(p, tryDeclareDrained), "declare drained blocked")
	assert(!withTx(p, tryAcquire), "no admission while unresolved")
	fmt.Println("PASS finalizer_receipt_no_drain: sibling_unknown_finalizer_commit_drain_unresolved")
}

func scenarioCompetitorSuccessUncertain(p *pgxpool.Pool) {
	acct := seedAcct(p)
	seedPendingHead(p, acct)
	seedCompetitorSuccess(p, acct)
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markUnknown(tx, cmdCompetOK) }), "competitor harness unknown")
	assert(finalizerRejectCommit(p), "finalizer commit")
	_, drain := gate(p)
	assert(drain == "unresolved", "drain still unresolved")
	var compSt int16
	must(p.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmdCompetOK).Scan(&compSt))
	assert(compSt == 2, "competitor PG success unchanged")
	fmt.Println("PASS finalizer_receipt_no_drain: competitor_pg_success_harness_unknown_no_drain")
}

func scenarioReceiptScope(p *pgxpool.Pool) {
	acct := seedAcct(p)
	seedPendingHead(p, acct)
	insertHcmd(p, cmdSibling)
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markUnknown(tx, cmdSibling) }), "sibling unknown")
	assert(finalizerRejectCommit(p), "finalizer")
	assert(siblingEnding(p, cmdSibling) == "unknown", "sibling still unknown")
	assert(headState(p) == 3, "only head terminal")
	_, drain := gate(p)
	assert(drain == "unresolved", "unresolved")
	fmt.Println("PASS finalizer_receipt_no_drain: terminal_this_command_sibling_unchanged")
}

func main() {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" {
		fmt.Println("SKIP: ALLOW_OWNED_PG17_TEST!=1")
		return
	}
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	if dsn == "" {
		fmt.Println("SKIP: FIRST_CITY_LEDGER_TEST_DSN unset")
		return
	}
	stageSpecDir()
	defer func() { _ = os.RemoveAll(baseDir) }()
	var err error
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	ver := ""
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	major := ""
	must(admin.QueryRow(ctx, "SELECT (current_setting('server_version_num')::integer/10000)::text").Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)

	run := func(fn func(*pgxpool.Pool)) {
		pool, done := fresh()
		defer done()
		apply(pool)
		installFixture(pool)
		fn(pool)
	}
	run(scenarioSiblingUnknown)
	run(scenarioCompetitorSuccessUncertain)
	run(scenarioReceiptScope)

	fmt.Println("MODE: isolated PG17 finalizer receipt no source drain (player_city_id_seq not activated)")
}
