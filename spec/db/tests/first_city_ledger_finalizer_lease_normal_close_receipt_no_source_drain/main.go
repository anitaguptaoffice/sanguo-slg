// SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-RECEIPT-NO-SOURCE-DRAIN-001 (#2927 / #2924 stack); disposable PG17.
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
	realm       = "d9eebc99-9c0b-4ef8-bb6d-6bb9bd380d91"
	cmdHead     = "e9eebc99-9c0b-4ef8-bb6d-6bb9bd380e41"
	cmdSibling  = "f9eebc99-9c0b-4ef8-bb6d-6bb9bd380f51"
	cmdCompetOK = "a9eebc99-9c0b-4ef8-bb6d-6bb9bd380a61"
	mapX, mapY  = 10, 20
)

var ctx = context.Background()
var baseDir, dsn string
var admin *pgxpool.Pool

func must(err error)             { if err != nil { panic(err) } }
func assert(ok bool, msg string) { if !ok { panic(msg) } }
func exec(p *pgxpool.Pool, sql string, args ...any) { _, e := p.Exec(ctx, sql, args...); must(e) }
func apply(p *pgxpool.Pool)                       { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	schema := fmt.Sprintf("fc_lfnc_rnsd_%x", time.Now().UnixNano())
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 4
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-lfnc-rnsd-specs-")
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
	for _, s := range []string{
		`CREATE TABLE harness_source_gate (realm_id uuid PRIMARY KEY, generation bigint NOT NULL DEFAULT 1, admission text NOT NULL DEFAULT 'open' CHECK (admission IN ('open','closed','poisoned')), drain text NOT NULL DEFAULT 'pending' CHECK (drain IN ('pending','unresolved','drained')), cleanup_attempts int NOT NULL DEFAULT 0)`,
		`CREATE TABLE harness_lease (lease_id uuid PRIMARY KEY, realm_id uuid NOT NULL, generation bigint NOT NULL, status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','ended')), phase text CHECK (phase IS NULL OR phase IN ('effect_begin','finalizer_begin')), effect_rollback_at timestamptz, ended_at timestamptz)`,
		`CREATE TABLE harness_effect_txn (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL, txn_open bool NOT NULL DEFAULT true, effect_ending text NOT NULL DEFAULT 'pending' CHECK (effect_ending IN ('pending','unknown','known_rollback')))`,
		`CREATE TABLE harness_finalizer_ending (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL, finalizer_ending text NOT NULL DEFAULT 'pending' CHECK (finalizer_ending IN ('pending','unknown','known_terminal')))`,
		`CREATE TABLE harness_command (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL, ending text NOT NULL DEFAULT 'pending' CHECK (ending IN ('pending','unknown','known_success','known_reject')))`,
	} {
		exec(p, s)
	}
	exec(p, `INSERT INTO harness_source_gate (realm_id) VALUES ($1::uuid)`, realm)
	exec(p, `INSERT INTO harness_effect_txn (command_id,realm_id,txn_open,effect_ending) VALUES ($1::uuid,$2::uuid,true,'pending')`, cmdHead, realm)
	exec(p, `INSERT INTO harness_finalizer_ending (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmdHead, realm)
	exec(p, `INSERT INTO harness_command (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmdHead, realm)
}

func seedPendingHead(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,1)`, mapX, mapY)
	c1, fct1, sha := `\x01`, `\x`+strings.Repeat("00", 52), `\x`+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('lfncrnsd_u','lfncrnsd_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'lfncrnsd')`, acct)
	exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdHead, acct, c1, fct1, sha)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmdHead)
	return acct
}

func gateAdm(tx pgx.Tx, allowClosed bool) (bool, error) {
	var adm string
	if err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm).Scan(&adm); err != nil {
		return false, err
	}
	return adm == "open" || (allowClosed && adm == "closed"), nil
}

func normalClose(tx pgx.Tx) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='closed',drain='unresolved' WHERE realm_id=$1::uuid AND admission='open'`, realm)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func tryAcquireAdmission(tx pgx.Tx, leaseID string, gen int64) (bool, error) {
	ok, err := gateAdm(tx, false)
	if err != nil || !ok {
		return false, tx.Rollback(ctx)
	}
	_, err = tx.Exec(ctx, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1::uuid,$2::uuid,$3,'held')`, leaseID, realm, gen)
	return err == nil, tx.Commit(ctx)
}

func tryRecordBegin(tx pgx.Tx, leaseID, phase string) (bool, error) {
	ok, err := gateAdm(tx, false)
	if err != nil || !ok {
		return false, tx.Rollback(ctx)
	}
	var st string
	var ph *string
	if err = tx.QueryRow(ctx, `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).Scan(&st, &ph); err != nil || st != "held" || ph != nil {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase=$2 WHERE lease_id=$1::uuid AND status='held' AND phase IS NULL`, leaseID, phase)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func effectOf(tx pgx.Tx, cmd string) (open bool, end string, err error) {
	err = tx.QueryRow(ctx, `SELECT txn_open,effect_ending FROM harness_effect_txn WHERE command_id=$1::uuid FOR UPDATE`, cmd).Scan(&open, &end)
	return
}

func recordEffectRollback(tx pgx.Tx, leaseID, cmd string) (bool, error) {
	open, end, err := effectOf(tx, cmd)
	ok, gerr := gateAdm(tx, false)
	if err != nil || gerr != nil || !ok || open || end != "known_rollback" {
		return false, tx.Rollback(ctx)
	}
	var st, ph string
	if err = tx.QueryRow(ctx, `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).Scan(&st, &ph); err != nil || st != "held" || ph != "effect_begin" {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase=NULL,effect_rollback_at=now() WHERE lease_id=$1::uuid AND status='held' AND phase='effect_begin'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func tryFinalizerBegin(tx pgx.Tx, leaseID, cmd string) (bool, error) {
	open, end, err := effectOf(tx, cmd)
	ok, gerr := gateAdm(tx, false)
	if err != nil || gerr != nil || !ok || open || end != "known_rollback" {
		return false, tx.Rollback(ctx)
	}
	var st string
	var ph *string
	var rb *time.Time
	if err = tx.QueryRow(ctx, `SELECT status,phase,effect_rollback_at FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).Scan(&st, &ph, &rb); err != nil || st != "held" || ph != nil || rb == nil {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase='finalizer_begin' WHERE lease_id=$1::uuid AND status='held' AND phase IS NULL AND effect_rollback_at IS NOT NULL`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func finishFinalizer(tx pgx.Tx, leaseID, cmd string) (bool, error) {
	var fe string
	if err := tx.QueryRow(ctx, `SELECT finalizer_ending FROM harness_finalizer_ending WHERE command_id=$1::uuid FOR UPDATE`, cmd).Scan(&fe); err != nil || fe == "known_terminal" {
		return false, tx.Rollback(ctx)
	}
	var st string
	var php *string
	if err := tx.QueryRow(ctx, `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).Scan(&st, &php); err != nil || st != "held" || php == nil || *php != "finalizer_begin" {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_finalizer_ending SET finalizer_ending='known_terminal' WHERE command_id=$1::uuid`, cmd)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	tag, err = tx.Exec(ctx, `UPDATE harness_lease SET phase=NULL WHERE lease_id=$1::uuid AND status='held' AND phase='finalizer_begin'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func endLease(tx pgx.Tx, leaseID, cmd string) (bool, error) {
	open, end, err := effectOf(tx, cmd)
	if err != nil || open || end != "known_rollback" {
		return false, tx.Rollback(ctx)
	}
	var fe string
	if err = tx.QueryRow(ctx, `SELECT finalizer_ending FROM harness_finalizer_ending WHERE command_id=$1::uuid FOR UPDATE`, cmd).Scan(&fe); err != nil || fe != "known_terminal" {
		return false, tx.Rollback(ctx)
	}
	if _, err = tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm); err != nil {
		return false, err
	}
	var st string
	var ph *string
	var rb *time.Time
	if err = tx.QueryRow(ctx, `SELECT status,phase,effect_rollback_at FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).Scan(&st, &ph, &rb); err != nil || st != "held" || ph != nil || rb == nil {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended',ended_at=now() WHERE lease_id=$1::uuid AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func bumpCleanup(tx pgx.Tx) (bool, error) {
	_, err := tx.Exec(ctx, `UPDATE harness_source_gate SET cleanup_attempts=cleanup_attempts+1 WHERE realm_id=$1::uuid`, realm)
	return err == nil, tx.Commit(ctx)
}

func markEnding(tx pgx.Tx, cmd, ending string) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE harness_command SET ending=$2 WHERE command_id=$1::uuid`, cmd, ending)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func tryDeclareDrained(tx pgx.Tx) (bool, error) {
	var adm string
	var gen int64
	if err := tx.QueryRow(ctx, `SELECT admission,generation FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm).Scan(&adm, &gen); err != nil || adm != "closed" {
		return false, tx.Rollback(ctx)
	}
	var n int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_lease WHERE realm_id=$1::uuid AND generation=$2 AND status='held'`, realm, gen).Scan(&n); err != nil || n > 0 {
		return false, tx.Rollback(ctx)
	}
	for _, sql := range []string{
		`SELECT count(*) FROM harness_effect_txn WHERE realm_id=$1::uuid AND (txn_open OR effect_ending IN ('pending','unknown'))`,
		`SELECT count(*) FROM harness_finalizer_ending WHERE realm_id=$1::uuid AND finalizer_ending IN ('pending','unknown')`,
		`SELECT count(*) FROM harness_command WHERE realm_id=$1::uuid AND ending IN ('pending','unknown')`,
	} {
		if err := tx.QueryRow(ctx, sql, realm).Scan(&n); err != nil || n > 0 {
			return false, tx.Rollback(ctx)
		}
	}
	_, err := tx.Exec(ctx, `UPDATE harness_source_gate SET generation=generation+1,admission='open',drain='pending' WHERE realm_id=$1::uuid`, realm)
	return err == nil, tx.Commit(ctx)
}

func prepHeadStrict(p *pgxpool.Pool, lease string) {
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "admit")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, lease, "effect_begin") }), "effect")
	exec(p, `UPDATE harness_effect_txn SET txn_open=false,effect_ending='known_rollback' WHERE command_id=$1::uuid`, cmdHead)
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return recordEffectRollback(tx, lease, cmdHead) }), "rollback")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryFinalizerBegin(tx, lease, cmdHead) }), "finalizer")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return finishFinalizer(tx, lease, cmdHead) }), "terminal")
	assert(withTx(p, normalClose), "close")
	assert(withTx(p, bumpCleanup), "cleanup")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return endLease(tx, lease, cmdHead) }), "classify")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markEnding(tx, cmdHead, "known_reject") }), "head ending")
}

func finalizerRejectCommit(p *pgxpool.Pool) bool {
	c, err := p.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm); err != nil {
		return false
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil || head == nil || *head != cmdHead {
		return false
	}
	var st int16
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`, cmdHead).Scan(&st); err != nil || st != 1 {
		return false
	}
	var terrain int16
	if err = tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&terrain); err != nil || terrain == 4 {
		return false
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1 WHERE command_id=$1::uuid AND durable_state=1`, cmdHead)
	return err == nil && tag.RowsAffected() == 1 && tx.Commit(ctx) == nil
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
	var ver, major string
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	must(admin.QueryRow(ctx, "SELECT (current_setting('server_version_num')::integer/10000)::text").Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)
	run := func(fn func(*pgxpool.Pool)) {
		pool, done := fresh()
		defer done()
		apply(pool)
		installFixture(pool)
		seedPendingHead(pool)
		fn(pool)
	}
	run(func(p *pgxpool.Pool) {
		lease := "9f111111-1111-4111-8111-111111111111"
		exec(p, `INSERT INTO harness_command (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmdSibling, realm)
		prepHeadStrict(p, lease)
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markEnding(tx, cmdSibling, "unknown") }), "sib unknown")
		assert(finalizerRejectCommit(p), "commit")
		assert(!withTx(p, tryDeclareDrained), "block")
		fmt.Println("PASS finalizer_lease_normal_close_receipt_no_source_drain: close_terminal_receipt_sibling_unknown_blocks_declare_drained")
	})
	run(func(p *pgxpool.Pool) {
		lease := "9f222222-2222-4222-8222-222222222222"
		var acct int64
		must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
		c1, fct1, sha := `\x02`, `\x`+strings.Repeat("11", 52), `\x`+strings.Repeat("cd", 32)
		exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,2,'t','r','c',1,$5,$6,now(),now(),88001,1,42,true,1,100)`, realm, cmdCompetOK, acct, c1, fct1, sha)
		exec(p, `INSERT INTO harness_command (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmdCompetOK, realm)
		prepHeadStrict(p, lease)
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markEnding(tx, cmdCompetOK, "unknown") }), "comp unknown")
		assert(finalizerRejectCommit(p), "commit")
		assert(withTx(p, bumpCleanup), "cleanup")
		assert(withTx(p, bumpCleanup), "cleanup")
		assert(!withTx(p, tryDeclareDrained), "no false drain")
		fmt.Println("PASS finalizer_lease_normal_close_receipt_no_source_drain: close_competitor_pg_success_harness_unknown_no_drain")
	})
	run(func(p *pgxpool.Pool) {
		lease := "9f333333-3333-4333-8333-333333333333"
		exec(p, `INSERT INTO harness_command (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmdSibling, realm)
		prepHeadStrict(p, lease)
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markEnding(tx, cmdSibling, "unknown") }), "sib unknown")
		assert(finalizerRejectCommit(p), "commit")
		assert(!withTx(p, tryDeclareDrained), "block")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markEnding(tx, cmdSibling, "known_reject") }), "resolved")
		assert(withTx(p, tryDeclareDrained), "drain")
		var adm string
		var gen int64
		must(p.QueryRow(ctx, `SELECT admission,generation FROM harness_source_gate WHERE realm_id=$1::uuid`, realm).Scan(&adm, &gen))
		assert(adm == "open" && gen == 2, "generation")
		fmt.Println("PASS finalizer_lease_normal_close_receipt_no_source_drain: close_sibling_unknown_resolved_allows_declare_drained")
	})
	fmt.Println("MODE: isolated PG17 normal-close receipt≠source drain; player_city_id_seq not activated")
}