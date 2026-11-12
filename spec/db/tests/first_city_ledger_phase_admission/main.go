// SPEC-FIRST-CITY-LEDGER-PHASE-ADMISSION-001: phase admission / lease / close-poison linearization on disposable PG17.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	cmdID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"
	mapX, mapY = 10, 20
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
	schema := fmt.Sprintf("fc_phase_adm_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-phase-adm-specs-")
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

func readGate(p *pgxpool.Pool) (adm, drain string, cleanup int) {
	must(p.QueryRow(ctx, `SELECT admission,drain,cleanup_attempts FROM harness_source_gate WHERE realm_id=$1::uuid`, realm).
		Scan(&adm, &drain, &cleanup))
	return
}
func readLease(p *pgxpool.Pool, id string) (status, phase string) {
	var ph *string
	must(p.QueryRow(ctx, `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid`, id).Scan(&status, &ph))
	if ph != nil {
		phase = *ph
	}
	return
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

func requestClose(tx pgx.Tx) (bool, error) {
	adm, err := gateRow(tx)
	if err != nil || adm == "poisoned" {
		return false, tx.Rollback(ctx)
	}
	_, err = tx.Exec(ctx, `UPDATE harness_source_gate SET admission='closed' WHERE realm_id=$1::uuid`, realm)
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

func illegalCheckThenBegin(tx pgx.Tx, leaseID string) (bool, error) {
	var adm string
	if err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid`, realm).Scan(&adm); err != nil || adm != "open" {
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase='finalizer_begin' WHERE lease_id=$1::uuid AND status='held'`, leaseID)
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

func seedAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('pha_u','pha_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'pha_p')`, acct)
	return acct
}

func seedPending(p *pgxpool.Pool, acct int64) {
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,1)`, mapX, mapY)
	exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdID, acct, c1, fct1, sha)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmdID)
}

func cmdState(p *pgxpool.Pool) int16 {
	var s int16
	must(p.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`, realm, cmdID).Scan(&s))
	return s
}

func main() {
	assert(os.Getenv("ALLOW_OWNED_PG17_TEST") == "1", "ALLOW_OWNED_PG17_TEST=1 required")
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	assert(dsn != "", "FIRST_CITY_LEDGER_TEST_DSN must name a disposable database")
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
		fn(pool)
	}

	run(func(p *pgxpool.Pool) {
		held, newL := "f1111111-1111-4111-8111-111111111111", "f2222222-2222-4222-8222-222222222222"
		exec(p, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1::uuid,$2::uuid,1,'held')`, held, realm)
		assert(withTx(p, requestClose), "close")
		adm, drain, _ := readGate(p)
		assert(adm == "closed" && drain == "pending", "gate closed")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, newL, 1) }), "no new admission")
		var n int
		must(p.QueryRow(ctx, `SELECT count(*) FROM harness_lease WHERE lease_id=$1::uuid`, newL).Scan(&n))
		assert(n == 0, "no new lease row")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, held, "effect_begin") }), "held begin")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return endLease(tx, held) }), "held end")
		st, ph := readLease(p, held)
		assert(st == "ended" && ph == "effect_begin", "held finished under close")
		fmt.Println("PASS phase_admission: close_before_new_admission held_lease_finishes")
	})

	run(func(p *pgxpool.Pool) {
		lease := "f3333333-3333-4333-8333-333333333333"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, lease, 1) }), "lease")
		seedPending(p, seedAcct(p))
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			wg.Wait()
			assert(withTx(p, applyPoison), "poison")
		}()
		c, err := p.Acquire(ctx)
		must(err)
		tx, err := c.Begin(ctx)
		must(err)
		wg.Done()
		time.Sleep(20 * time.Millisecond)
		ok, err := tryRecordBegin(tx, lease, "finalizer_begin")
		must(err)
		if ok {
			must(tx.Commit(ctx))
		} else {
			_ = tx.Rollback(ctx)
		}
		c.Release()
		adm, drain, _ := readGate(p)
		assert(adm == "poisoned" && drain == "unresolved", "poisoned unresolved")
		assert(!ok && cmdState(p) == 1, "no begin / PENDING")
		fmt.Println("PASS phase_admission: poison_before_finalizer_begin PENDING_unchanged")
	})

	run(func(p *pgxpool.Pool) {
		l1, l2 := "f4444444-4444-4444-8444-444444444444", "f5555555-5555-4555-8555-555555555555"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, l1, 1) }), "lease")
		assert(withTx(p, applyPoison), "poison")
		_ = withTx(p, func(tx pgx.Tx) (bool, error) { return illegalCheckThenBegin(tx, l1) })
		adm, drain, _ := readGate(p)
		assert(adm == "poisoned" && !withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, l1, "finalizer_begin") }), "linearized blocked")
		if _, ph := readLease(p, l1); ph != "" {
			assert(drain == "unresolved", "no drain resolve")
		}
		exec(p, `UPDATE harness_source_gate SET admission='open', drain='pending' WHERE realm_id=$1::uuid`, realm)
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, l2, 1) }), "fresh admit")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, l2, "effect_begin") }), "legal begin")
		fmt.Println("PASS phase_admission: check_then_begin_not_contract_legal linearized_path_ok")
	})

	run(func(p *pgxpool.Pool) {
		l := "f6666666-6666-4666-8666-666666666666"
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquireAdmission(tx, l, 1) }), "admit")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return endLease(tx, l) }), "end lease")
		adm, _, _ := readGate(p)
		st, _ := readLease(p, l)
		assert(st == "ended" && adm == "open", "ended lease")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryRecordBegin(tx, l, "effect_begin") }), "no begin")
		fmt.Println("PASS phase_admission: lease_ended_no_begin_without_readmit")
	})

	run(func(p *pgxpool.Pool) {
		assert(withTx(p, applyPoison), "poison")
		exec(p, `UPDATE harness_source_gate SET cleanup_attempts = cleanup_attempts + 1 WHERE realm_id=$1::uuid`, realm)
		adm, drain, cleanup := readGate(p)
		assert(adm == "poisoned" && drain == "unresolved" && cleanup == 1, "cleanup != drained")
		fmt.Println("PASS phase_admission: local_cleanup_does_not_drain")
	})

	fmt.Println("MODE: isolated PG17 phase admission fixture; not production admission controller")
}
