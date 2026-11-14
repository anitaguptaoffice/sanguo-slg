// SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-001: §7.4 lease classify after effect txn; disposable PG17.
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
	realm   = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22"
	cmdHead = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33"
)

var ctx = context.Background()
var baseDir, dsn string
var admin *pgxpool.Pool
var serial int

func must(err error)             { if err != nil { panic(err) } }
func assert(ok bool, msg string) { if !ok { panic(msg) } }
func exec(p *pgxpool.Pool, sql string, args ...any) { _, e := p.Exec(ctx, sql, args...); must(e) }
func apply(p *pgxpool.Pool)                       { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_ltb_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-ltb-specs-")
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
 admission text NOT NULL DEFAULT 'open' CHECK (admission IN ('open','closed','poisoned')),
 drain text NOT NULL DEFAULT 'pending' CHECK (drain IN ('pending','unresolved','drained')),
 cleanup_attempts int NOT NULL DEFAULT 0)`)
	exec(p, `CREATE TABLE harness_lease (lease_id uuid PRIMARY KEY, realm_id uuid NOT NULL,
 generation bigint NOT NULL, status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','ended')),
 phase text CHECK (phase IS NULL OR phase IN ('effect_begin','finalizer_begin')),
 effect_rollback_at timestamptz, ended_at timestamptz)`)
	exec(p, `CREATE TABLE harness_effect_txn (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL,
 txn_open bool NOT NULL DEFAULT true,
 effect_ending text NOT NULL DEFAULT 'pending' CHECK (effect_ending IN ('pending','unknown','known_rollback')))`)
	exec(p, `INSERT INTO harness_source_gate (realm_id) VALUES ($1::uuid)`, realm)
	exec(p, `INSERT INTO harness_effect_txn (command_id,realm_id,txn_open,effect_ending) VALUES ($1::uuid,$2::uuid,true,'pending')`, cmdHead, realm)
}

func seedPending(p *pgxpool.Pool) {
	c1, fct1, sha := `\x01`, `\x`+strings.Repeat("00", 52), `\x`+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('ltb_u','ltb_h',1)`)
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name)
 VALUES (1,7,(SELECT account_id FROM account LIMIT 1),'ltb')`)
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 SELECT '%s'::uuid,1,7,'%s'::uuid,account_id,'%s',1,'t','r','c',1,'%s','%s',now() FROM account`, realm, cmdHead, c1, fct1, sha))
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 SELECT '%s'::uuid,1,7,account_id,'%s'::uuid FROM account`, realm, cmdHead))
}

func gateRow(tx pgx.Tx) (string, error) {
	var adm string
	return adm, tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm).Scan(&adm)
}

func effectOpen(tx pgx.Tx) (bool, string, error) {
	var open bool
	var end string
	err := tx.QueryRow(ctx, `SELECT txn_open,effect_ending FROM harness_effect_txn WHERE command_id=$1::uuid FOR UPDATE`, cmdHead).Scan(&open, &end)
	return open, end, err
}

func tryAcquireAdmission(tx pgx.Tx, leaseID string, gen int64) (bool, error) {
	adm, err := gateRow(tx)
	if err != nil || adm != "open" {
		return false, tx.Rollback(ctx)
	}
	_, err = tx.Exec(ctx, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1::uuid,$2::uuid,$3,'held')`,
		leaseID, realm, gen)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func tryRecordBegin(tx pgx.Tx, leaseID, phase string) (bool, error) {
	adm, err := gateRow(tx)
	if err != nil || adm != "open" {
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

func recordEffectRollback(tx pgx.Tx, leaseID string) (bool, error) {
	open, end, err := effectOpen(tx)
	if err != nil || open || end != "known_rollback" {
		return false, tx.Rollback(ctx)
	}
	adm, err := gateRow(tx)
	if err != nil || adm != "open" {
		return false, tx.Rollback(ctx)
	}
	var st, ph string
	if err = tx.QueryRow(ctx, `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).
		Scan(&st, &ph); err != nil || st != "held" || ph != "effect_begin" {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase=NULL, effect_rollback_at=now()
 WHERE lease_id=$1::uuid AND status='held' AND phase='effect_begin'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func tryFinalizerBeginAfterRollback(tx pgx.Tx, leaseID string) (bool, error) {
	open, end, err := effectOpen(tx)
	if err != nil || open || end != "known_rollback" {
		return false, tx.Rollback(ctx)
	}
	adm, err := gateRow(tx)
	if err != nil || adm != "open" {
		return false, tx.Rollback(ctx)
	}
	var st string
	var ph *string
	var rb *time.Time
	if err = tx.QueryRow(ctx, `SELECT status,phase,effect_rollback_at FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).
		Scan(&st, &ph, &rb); err != nil || st != "held" || ph != nil || rb == nil {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase='finalizer_begin' WHERE lease_id=$1::uuid AND status='held' AND phase IS NULL AND effect_rollback_at IS NOT NULL`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func bumpCleanup(tx pgx.Tx) (bool, error) {
	if _, err := tx.Exec(ctx, `UPDATE harness_source_gate SET cleanup_attempts=cleanup_attempts+1 WHERE realm_id=$1::uuid`, realm); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func tryClassifyLeaseEnded(tx pgx.Tx, leaseID string) (bool, error) {
	open, end, err := effectOpen(tx)
	if err != nil || open || end == "unknown" || end == "pending" {
		return false, tx.Rollback(ctx)
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended', ended_at=now() WHERE lease_id=$1::uuid AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func tryEndLeaseUnsafe(tx pgx.Tx, leaseID string) (bool, error) {
	open, _, err := effectOpen(tx)
	if err != nil || open {
		return false, tx.Rollback(ctx)
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended', ended_at=now() WHERE lease_id=$1::uuid AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func closeEffectKnownRollback(p *pgxpool.Pool) {
	exec(p, `UPDATE harness_effect_txn SET txn_open=false, effect_ending='known_rollback' WHERE command_id=$1::uuid`, cmdHead)
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

func cmdPending(p *pgxpool.Pool) bool {
	var s int16
	var term *time.Time
	err := p.QueryRow(ctx, `SELECT durable_state, terminal_at FROM world_first_city_command WHERE command_id=$1::uuid`, cmdHead).Scan(&s, &term)
	return err == nil && s == 1 && term == nil
}

func leaseHeld(p *pgxpool.Pool, id string) bool {
	var st string
	must(p.QueryRow(ctx, `SELECT status FROM harness_lease WHERE lease_id=$1::uuid`, id).Scan(&st))
	return st == "held"
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
	ver, major := "", ""
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	must(admin.QueryRow(ctx, "SELECT (current_setting('server_version_num')::integer/10000)::text").Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)

	run := func(fn func(*pgxpool.Pool)) {
		pool, done := fresh()
		defer done()
		apply(pool)
		installFixture(pool)
		seedPending(pool)
		fn(pool)
	}

	run(func(p *pgxpool.Pool) {
		lease := "b1111111-1111-4111-8111-111111111111"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "admit")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, lease, "effect_begin") }), "effect_begin")
		assert(withTx(p, bumpCleanup), "cleanup")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryClassifyLeaseEnded(tx, lease) }), "no classify while open")
		assert(leaseHeld(p, lease) && cmdPending(p), "held pending")
		fmt.Println("PASS finalizer_lease_txn_boundary: open_txn_cleanup_no_lease_classify")
	})

	run(func(p *pgxpool.Pool) {
		lease := "b2222222-2222-4222-8222-222222222222"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "admit")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, lease, "effect_begin") }), "effect_begin")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryEndLeaseUnsafe(tx, lease) }), "reject end while open")
		assert(leaseHeld(p, lease) && cmdPending(p), "still held")
		fmt.Println("PASS finalizer_lease_txn_boundary: open_txn_premature_end_rejected")
	})

	run(func(p *pgxpool.Pool) {
		lease := "b3333333-3333-4333-8333-333333333333"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "admit")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, lease, "effect_begin") }), "effect_begin")
		closeEffectKnownRollback(p)
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return recordEffectRollback(tx, lease) }), "rollback mark")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryFinalizerBeginAfterRollback(tx, lease) }), "finalizer_begin")
		assert(cmdPending(p), "pending until terminal path")
		fmt.Println("PASS finalizer_lease_txn_boundary: known_rollback_boundary_allows_finalizer_begin")
	})

	fmt.Println("MODE: isolated PG17 lease txn boundary; player_city_id_seq not activated")
}
