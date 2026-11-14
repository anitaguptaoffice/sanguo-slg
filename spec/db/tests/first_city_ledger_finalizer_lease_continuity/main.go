// SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-CONTINUITY-001: §7.4 continuous command lease; disposable PG17.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

var (
	ctx          = context.Background()
	baseDir, dsn string
	admin        *pgxpool.Pool
	serial       int
)

func must(err error)             { if err != nil { panic(err) } }
func assert(ok bool, msg string) { if !ok { panic(msg) } }
func exec(p *pgxpool.Pool, sql string, args ...any) { _, e := p.Exec(ctx, sql, args...); must(e) }
func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_flc_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-flc-specs-")
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
 admission text NOT NULL DEFAULT 'open' CHECK (admission IN ('open','closing','closed','poisoned')),
 drain text NOT NULL DEFAULT 'pending' CHECK (drain IN ('pending','unresolved','drained')))`)
	exec(p, `CREATE TABLE harness_lease (lease_id uuid PRIMARY KEY, realm_id uuid NOT NULL REFERENCES harness_source_gate(realm_id),
 generation bigint NOT NULL, status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','ended')),
 phase text CHECK (phase IS NULL OR phase IN ('effect_begin','finalizer_begin')),
 effect_rollback_at timestamptz, ended_at timestamptz)`)
	exec(p, `INSERT INTO harness_source_gate (realm_id) VALUES ($1::uuid)`, realm)
}

func gateRow(tx pgx.Tx) (string, error) {
	var adm string
	return adm, tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm).Scan(&adm)
}

func tryAcquireAdmission(tx pgx.Tx, leaseID string, gen int64) (bool, error) {
	adm, err := gateRow(tx)
	if err != nil || adm != "open" {
		return false, tx.Rollback(ctx)
	}
	var g int64
	if err = tx.QueryRow(ctx, `SELECT generation FROM harness_source_gate WHERE realm_id=$1::uuid`, realm).Scan(&g); err != nil || g != gen {
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

func endLease(tx pgx.Tx, leaseID string) (bool, error) {
	if _, err := tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended', ended_at=now() WHERE lease_id=$1::uuid AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
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

func readLease(p *pgxpool.Pool, id string) (status, phase string, hasRB bool) {
	var ph *string
	var rb *time.Time
	must(p.QueryRow(ctx, `SELECT status,phase,effect_rollback_at FROM harness_lease WHERE lease_id=$1::uuid`, id).Scan(&status, &ph, &rb))
	if ph != nil {
		phase = *ph
	}
	hasRB = rb != nil
	return
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
		fn(pool)
	}

	run(func(p *pgxpool.Pool) {
		lease := "a1111111-1111-4111-8111-111111111111"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "admit")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, lease, "effect_begin") }), "effect_begin")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return recordEffectRollback(tx, lease) }), "effect_rollback")
		st, ph, rb := readLease(p, lease)
		assert(st == "held" && ph == "" && rb, "held after rollback")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryFinalizerBeginAfterRollback(tx, lease) }), "finalizer_begin")
		st, ph, _ = readLease(p, lease)
		assert(st == "held" && ph == "finalizer_begin", "finalizer phase on same lease")
		fmt.Println("PASS finalizer_lease_continuity: continuous_lease_effect_rollback_then_finalizer_begin")
	})

	run(func(p *pgxpool.Pool) {
		lease := "a2222222-2222-4222-8222-222222222222"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "admit")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, lease, "effect_begin") }), "effect_begin")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return recordEffectRollback(tx, lease) }), "effect_rollback")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return endLease(tx, lease) }), "premature end")
		st, _, _ := readLease(p, lease)
		assert(st == "ended", "lease ended")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryFinalizerBeginAfterRollback(tx, lease) }), "no finalizer on ended lease")
		fmt.Println("PASS finalizer_lease_continuity: premature_lease_end_blocks_finalizer_begin")
	})

	run(func(p *pgxpool.Pool) {
		oldL, newL := "a3333333-3333-4333-8333-333333333333", "a4444444-4444-4444-8444-444444444444"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, oldL, 1) }), "admit old")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, oldL, "effect_begin") }), "effect_begin")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return recordEffectRollback(tx, oldL) }), "rollback")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return endLease(tx, oldL) }), "end old")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, newL, 1) }), "readmit")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, newL, "effect_begin") }), "effect on new")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return recordEffectRollback(tx, newL) }), "rollback new")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryFinalizerBeginAfterRollback(tx, newL) }), "finalizer new lease")
		fmt.Println("PASS finalizer_lease_continuity: fresh_admission_after_premature_end_allows_finalizer")
	})

	fmt.Println("MODE: isolated PG17 finalizer lease continuity; player_city_id_seq not activated")
}
