// SPEC-FIRST-CITY-LEDGER-FINALIZER-COMMIT-UNCERTAIN-POISON-001: §7.10 finalizer commit-uncertain poison; disposable PG17.
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
	realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	cmdID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"
	mapX  = 10
	mapY  = 20
)

var ctx = context.Background()
var baseDir, dsn string
var admin *pgxpool.Pool
var serial int

type cmdSnap struct {
	state               int16
	terminalAt          bool
	hasRejection        bool
	contentSHA          string
}

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
	schema := fmt.Sprintf("fc_fcup_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-fcup-specs-")
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
 drain text NOT NULL DEFAULT 'pending' CHECK (drain IN ('pending','unresolved','drained')), cleanup_attempts int NOT NULL DEFAULT 0)`)
	exec(p, `CREATE TABLE harness_lease (lease_id uuid PRIMARY KEY, realm_id uuid NOT NULL REFERENCES harness_source_gate(realm_id),
 generation bigint NOT NULL, status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','ended')),
 phase text CHECK (phase IS NULL OR phase IN ('effect_begin','finalizer_begin')), ended_at timestamptz)`)
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
	_, err = tx.Exec(ctx, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1::uuid,$2::uuid,$3,'held')`, leaseID, realm, gen)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func applyPoison(tx pgx.Tx) (bool, error) {
	if _, err := tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm); err != nil {
		return false, err
	}
	_, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='poisoned', drain='unresolved' WHERE realm_id=$1::uuid`, realm)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func tryRecordBegin(tx pgx.Tx, leaseID, phase string) (bool, error) {
	adm, err := gateRow(tx)
	if err != nil || adm == "poisoned" {
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

func readGate(p *pgxpool.Pool) (adm, drain string) {
	must(p.QueryRow(ctx, `SELECT admission,drain FROM harness_source_gate WHERE realm_id=$1::uuid`, realm).Scan(&adm, &drain))
	return
}

func seedAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('fcup_u','fcup_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'fcup_p')`, acct)
	return acct
}

func seedPending(p *pgxpool.Pool, acct int64) string {
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,1)`, mapX, mapY)
	exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdID, acct, c1, fct1, sha)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmdID)
	return strings.Repeat("ab", 32)
}

func readSnap(p *pgxpool.Pool) cmdSnap {
	var s cmdSnap
	var term *time.Time
	var rej *int16
	must(p.QueryRow(ctx, `SELECT durable_state,terminal_at,rejection_reason,encode(content_sha256,'hex')
 FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).
		Scan(&s.state, &term, &rej, &s.contentSHA))
	s.terminalAt = term != nil
	s.hasRejection = rej != nil
	return s
}

func assertPending(s cmdSnap, wantSHA string) {
	assert(s.state == 1 && !s.terminalAt && !s.hasRejection, "PENDING without terminal columns")
	assert(s.contentSHA == wantSHA, "original content identity")
}

func bizRows(p *pgxpool.Pool) int {
	var n int
	must(p.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+
 (SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42)`).Scan(&n))
	return n
}

// finalizerTerminalUpdate performs companion-style locks + terminal UPDATE inside tx; caller decides Commit vs Rollback.
func finalizerTerminalUpdate(tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return err
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil || head == nil || *head != cmdID {
		return fmt.Errorf("head mismatch")
	}
	var st int16
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE command_id=$1::uuid FOR UPDATE`, cmdID).Scan(&st); err != nil || st != 1 {
		return fmt.Errorf("not pending")
	}
	var terrain int16
	if err = tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&terrain); err != nil {
		return err
	}
	if terrain == 4 {
		return fmt.Errorf("buildable")
	}
	_, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE command_id=$1::uuid AND durable_state=1`, cmdID)
	return err
}

func uncertainFinalizerCommit(p *pgxpool.Pool, leaseID string) {
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, leaseID, "finalizer_begin") }), "finalizer_begin")
	c, err := p.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	must(finalizerTerminalUpdate(tx))
	// Uncertain commit ending: rollback simulates lost ACK — writer must poison, not guess committed reject.
	must(tx.Rollback(ctx))
	assert(withTx(p, applyPoison), "poison after uncertain finalizer commit")
}

func trySecondFinalizerGuess(p *pgxpool.Pool, leaseID string) bool {
	c, err := p.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	ok, err := tryRecordBegin(tx, leaseID, "finalizer_begin")
	must(err)
	if ok {
		must(finalizerTerminalUpdate(tx))
		must(tx.Commit(ctx))
		return true
	}
	_ = tx.Rollback(ctx)
	return false
}

func scenarioUncertainPoisonPending(p *pgxpool.Pool) {
	lease := "c1111111-1111-4111-8111-111111111111"
	sha := seedPending(p, seedAcct(p))
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "lease")
	uncertainFinalizerCommit(p, lease)
	adm, drain := readGate(p)
	assert(adm == "poisoned" && drain == "unresolved", "poison unresolved")
	assertPending(readSnap(p), sha)
	assert(bizRows(p) == 0, "no business rows")
	fmt.Println("PASS finalizer_commit_uncertain: terminal_update_uncertain_rollback_poison_stays_pending")
}

func scenarioNoSecondGuess(p *pgxpool.Pool) {
	lease := "c2222222-2222-4222-8222-222222222222"
	sha := seedPending(p, seedAcct(p))
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "lease")
	uncertainFinalizerCommit(p, lease)
	assert(!trySecondFinalizerGuess(p, lease), "second finalizer blocked at gate")
	assertPending(readSnap(p), sha)
	fmt.Println("PASS finalizer_commit_uncertain: poison_blocks_second_guess_rejection")
}

func scenarioPendingReadNoBypass(p *pgxpool.Pool) {
	lease := "c3333333-3333-4333-8333-333333333333"
	sha := seedPending(p, seedAcct(p))
	assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "lease")
	uncertainFinalizerCommit(p, lease)
	obs := readSnap(p)
	assertPending(obs, sha)
	assert(!withTx(p, func(tx pgx.Tx) (bool, error) {
		return tryAcquireAdmission(tx, "c4444444-4444-4444-8444-444444444444", 1)
	}), "new admission rejected under poison")
	adm, _ := readGate(p)
	assert(adm == "poisoned", "still poisoned after PENDING read")
	fmt.Println("PASS finalizer_commit_uncertain: pending_readback_no_poison_bypass")
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
	run(scenarioUncertainPoisonPending)
	run(scenarioNoSecondGuess)
	run(scenarioPendingReadNoBypass)

	fmt.Println("MODE: isolated PG17 finalizer commit-uncertain poison (player_city_id_seq not activated)")
}
