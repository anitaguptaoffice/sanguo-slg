// SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-PENDING-DRAIN-001 (#2870 stack); disposable PG17.
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
	realm      = "d8eebc99-9c0b-4ef8-bb6d-6bb9bd380e01"
	cmdHead    = "e8eebc99-9c0b-4ef8-bb6d-6bb9bd380e11"
	cmdSibling = "f8eebc99-9c0b-4ef8-bb6d-6bb9bd380f21"
)

var (
	ctx     = context.Background()
	baseDir string
	dsn     string
	admin   *pgxpool.Pool
)

func must(err error)                          { if err != nil { panic(err) } }
func assert(ok bool, msg string)               { if !ok { panic(msg) } }
func exec(p *pgxpool.Pool, sql string, args ...any) { _, e := p.Exec(ctx, sql, args...); must(e) }
func apply(p *pgxpool.Pool)                    { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	schema := fmt.Sprintf("fc_lfnc_sepd_%x", time.Now().UnixNano())
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
	baseDir, err = os.MkdirTemp("", "fc-lfnc-sepd-specs-")
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
	exec(p, `CREATE TABLE harness_source_gate (realm_id uuid PRIMARY KEY, generation bigint NOT NULL DEFAULT 1, admission text NOT NULL DEFAULT 'open' CHECK (admission IN ('open','closed','poisoned')), drain text NOT NULL DEFAULT 'pending' CHECK (drain IN ('pending','unresolved','drained')), cleanup_attempts int NOT NULL DEFAULT 0)`)
	exec(p, `CREATE TABLE harness_lease (lease_id uuid PRIMARY KEY, realm_id uuid NOT NULL, generation bigint NOT NULL, status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','ended')), phase text CHECK (phase IS NULL OR phase IN ('effect_begin','finalizer_begin')), effect_rollback_at timestamptz, ended_at timestamptz)`)
	exec(p, `CREATE TABLE harness_effect_txn (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL, txn_open bool NOT NULL DEFAULT true, effect_ending text NOT NULL DEFAULT 'pending' CHECK (effect_ending IN ('pending','unknown','known_rollback')))`)
	exec(p, `CREATE TABLE harness_finalizer_ending (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL, finalizer_ending text NOT NULL DEFAULT 'pending' CHECK (finalizer_ending IN ('pending','unknown','known_terminal')))`)
	exec(p, `CREATE TABLE harness_command (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL, ending text NOT NULL DEFAULT 'pending' CHECK (ending IN ('pending','unknown','known_success','known_reject')))`)
	exec(p, `INSERT INTO harness_source_gate (realm_id) VALUES ($1::uuid)`, realm)
	exec(p, `INSERT INTO harness_effect_txn (command_id,realm_id,txn_open,effect_ending) VALUES ($1::uuid,$2::uuid,true,'pending'),($3::uuid,$2::uuid,false,'pending')`, cmdHead, realm, cmdSibling)
	exec(p, `INSERT INTO harness_finalizer_ending (command_id,realm_id,finalizer_ending) VALUES ($1::uuid,$2::uuid,'pending'),($3::uuid,$2::uuid,'known_terminal')`, cmdHead, realm, cmdSibling)
	exec(p, `INSERT INTO harness_command (command_id,realm_id) VALUES ($1::uuid,$2::uuid),($3::uuid,$2::uuid)`, cmdHead, realm, cmdSibling)
}

func seedPending(p *pgxpool.Pool) {
	c1, fct1, sha := `\x01`, `\x`+strings.Repeat("00", 52), `\x`+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('lfncsepd_u','lfncsepd_h',1)`)
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,15,(SELECT account_id FROM account LIMIT 1),'lfncsepd')`)
	cmdQ := `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) SELECT '%s'::uuid,1,12,'%s'::uuid,account_id,'%s',1,'t','r','c',1,'%s','%s',now() FROM account`
	slotQ := `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) SELECT '%s'::uuid,1,12,account_id,'%s'::uuid FROM account`
	exec(p, fmt.Sprintf(cmdQ, realm, cmdHead, c1, fct1, sha))
	exec(p, fmt.Sprintf(slotQ, realm, cmdHead))
}

func normalClose(tx pgx.Tx) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='closed',drain='unresolved' WHERE realm_id=$1::uuid AND admission='open'`, realm)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func effectOf(tx pgx.Tx, cmd string) (bool, string, error) {
	var open bool
	var end string
	err := tx.QueryRow(ctx, `SELECT txn_open,effect_ending FROM harness_effect_txn WHERE command_id=$1::uuid FOR UPDATE`, cmd).Scan(&open, &end)
	return open, end, err
}

func finalizerOf(tx pgx.Tx, cmd string) (string, error) {
	var fe string
	return fe, tx.QueryRow(ctx, `SELECT finalizer_ending FROM harness_finalizer_ending WHERE command_id=$1::uuid FOR UPDATE`, cmd).Scan(&fe)
}

func gateAdm(tx pgx.Tx, allowClosed bool) (bool, error) {
	var adm string
	err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm).Scan(&adm)
	if err != nil {
		return false, err
	}
	if adm == "open" {
		return true, nil
	}
	return allowClosed && adm == "closed", nil
}

func tryAcquireAdmission(tx pgx.Tx, leaseID string, gen int64) (bool, error) {
	ok, err := gateAdm(tx, false)
	if err != nil || !ok {
		return false, tx.Rollback(ctx)
	}
	_, err = tx.Exec(ctx, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1::uuid,$2::uuid,$3,'held')`, leaseID, realm, gen)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
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

func recordEffectRollbackFor(tx pgx.Tx, leaseID, cmd string) (bool, error) {
	open, end, err := effectOf(tx, cmd)
	if err != nil || open || end != "known_rollback" {
		return false, tx.Rollback(ctx)
	}
	ok, err := gateAdm(tx, true)
	if err != nil || !ok {
		return false, tx.Rollback(ctx)
	}
	var st, ph string
	if err = tx.QueryRow(ctx, `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).
		Scan(&st, &ph); err != nil || st != "held" || ph != "effect_begin" {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase=NULL,effect_rollback_at=now() WHERE lease_id=$1::uuid AND status='held' AND phase='effect_begin'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func tryFinalizerBeginFor(tx pgx.Tx, leaseID, cmd string) (bool, error) {
	open, end, err := effectOf(tx, cmd)
	if err != nil || open || end != "known_rollback" {
		return false, tx.Rollback(ctx)
	}
	ok, err := gateAdm(tx, true)
	if err != nil || !ok {
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

func finishFinalizerFor(tx pgx.Tx, leaseID, cmd, ending string) (bool, error) {
	fe, err := finalizerOf(tx, cmd)
	if err != nil || fe == "known_terminal" || ending != "known_terminal" {
		return false, tx.Rollback(ctx)
	}
	var st string
	var php *string
	err = tx.QueryRow(ctx, `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).Scan(&st, &php)
	if err != nil || st != "held" || php == nil || *php != "finalizer_begin" {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_finalizer_ending SET finalizer_ending=$2 WHERE command_id=$1::uuid`, cmd, ending)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	tag, err = tx.Exec(ctx, `UPDATE harness_lease SET phase=NULL WHERE lease_id=$1::uuid AND status='held' AND phase='finalizer_begin'`, leaseID)
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

func endLeaseFor(tx pgx.Tx, leaseID, cmd string) (bool, error) {
	open, end, err := effectOf(tx, cmd)
	if err != nil || open || end != "known_rollback" {
		return false, tx.Rollback(ctx)
	}
	fe, err := finalizerOf(tx, cmd)
	if err != nil || fe != "known_terminal" {
		return false, tx.Rollback(ctx)
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm); err != nil {
		return false, err
	}
	var st string
	var ph *string
	var rb *time.Time
	if err = tx.QueryRow(ctx, `SELECT status,phase,effect_rollback_at FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).
		Scan(&st, &ph, &rb); err != nil || st != "held" || ph != nil || rb == nil {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended',ended_at=now() WHERE lease_id=$1::uuid AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
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
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_effect_txn WHERE realm_id=$1::uuid AND (txn_open OR effect_ending IN ('pending','unknown'))`, realm).Scan(&n); err != nil || n > 0 {
		return false, tx.Rollback(ctx)
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_finalizer_ending WHERE realm_id=$1::uuid AND finalizer_ending IN ('pending','unknown')`, realm).Scan(&n); err != nil || n > 0 {
		return false, tx.Rollback(ctx)
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_command WHERE realm_id=$1::uuid AND ending IN ('pending','unknown')`, realm).Scan(&n); err != nil || n > 0 {
		return false, tx.Rollback(ctx)
	}
	_, err := tx.Exec(ctx, `UPDATE harness_source_gate SET generation=generation+1,admission='open',drain='pending' WHERE realm_id=$1::uuid`, realm)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func closeEffectKnownRollback(p *pgxpool.Pool, cmd string) {
	exec(p, `UPDATE harness_effect_txn SET txn_open=false,effect_ending='known_rollback' WHERE command_id=$1::uuid`, cmd)
}

func prepHeadReady(p *pgxpool.Pool, headLease string) {
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, headLease, 1) }), "admit head")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, headLease, "effect_begin") }), "head effect")
	closeEffectKnownRollback(p, cmdHead)
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return recordEffectRollbackFor(tx, headLease, cmdHead) }), "head rollback")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryFinalizerBeginFor(tx, headLease, cmdHead) }), "head finalizer")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return finishFinalizerFor(tx, headLease, cmdHead, "known_terminal") }), "head terminal")
}

func prepSiblingEffectPending(p *pgxpool.Pool, headLease string) {
	prepHeadReady(p, headLease)
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markEnding(tx, cmdSibling, "known_reject") }), "sibling cmd")
}

func strictCloseHead(p *pgxpool.Pool, headLease string) {
	assert(withTx(p, normalClose), "close")
	assert(withTx(p, bumpCleanup), "cleanup")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return endLeaseFor(tx, headLease, cmdHead) }), "classify head")
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markEnding(tx, cmdHead, "known_reject") }), "head ending")
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
		seedPending(pool)
		fn(pool)
	}

	run(func(p *pgxpool.Pool) {
		head := "9f111111-1111-4111-8111-111111111111"
		prepSiblingEffectPending(p, head)
		strictCloseHead(p, head)
		assert(!withTx(p, tryDeclareDrained), "sibling effect pending blocks")
		var open bool
		var ee string
		must(p.QueryRow(ctx, `SELECT txn_open,effect_ending FROM harness_effect_txn WHERE command_id=$1::uuid`, cmdSibling).Scan(&open, &ee))
		assert(!open && ee == "pending", "sibling effect pending")
		var drain string
		must(p.QueryRow(ctx, `SELECT drain FROM harness_source_gate WHERE realm_id=$1::uuid`, realm).Scan(&drain))
		assert(drain == "unresolved", "unresolved")
		fmt.Println("PASS finalizer_lease_normal_close_sibling_effect_pending_drain: close_sibling_effect_pending_blocks")
	})

	run(func(p *pgxpool.Pool) {
		head := "9f222222-2222-4222-8222-222222222222"
		prepSiblingEffectPending(p, head)
		assert(withTx(p, normalClose), "close")
		assert(withTx(p, bumpCleanup), "cleanup")
		assert(withTx(p, bumpCleanup), "cleanup")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return endLeaseFor(tx, head, cmdHead) }), "classify head")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markEnding(tx, cmdHead, "known_reject") }), "head ending")
		assert(!withTx(p, tryDeclareDrained), "cleanup no drain")
		var ee string
		must(p.QueryRow(ctx, `SELECT effect_ending FROM harness_effect_txn WHERE command_id=$1::uuid`, cmdSibling).Scan(&ee))
		assert(ee == "pending", "still pending")
		fmt.Println("PASS finalizer_lease_normal_close_sibling_effect_pending_drain: close_sibling_effect_pending_cleanup_no_drain")
	})

	run(func(p *pgxpool.Pool) {
		head := "9f333333-3333-4333-8333-333333333333"
		prepSiblingEffectPending(p, head)
		strictCloseHead(p, head)
		assert(!withTx(p, tryDeclareDrained), "blocked while pending")
		exec(p, `UPDATE harness_effect_txn SET effect_ending='known_rollback' WHERE command_id=$1::uuid`, cmdSibling)
		assert(withTx(p, tryDeclareDrained), "drained")
		var adm, drain string
		var gen int64
		must(p.QueryRow(ctx, `SELECT admission,drain,generation FROM harness_source_gate WHERE realm_id=$1::uuid`, realm).Scan(&adm, &drain, &gen))
		assert(adm == "open" && drain == "pending" && gen == 2, "generation")
		fmt.Println("PASS finalizer_lease_normal_close_sibling_effect_pending_drain: close_sibling_effect_pending_resolved_drains")
	})
	fmt.Println("MODE: isolated PG17 sibling-effect-pending normal close drain; player_city_id_seq not activated")
}