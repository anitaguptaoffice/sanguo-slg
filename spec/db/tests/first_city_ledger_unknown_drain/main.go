// SPEC-FIRST-CITY-LEDGER-UNKNOWN-DRAIN-001: unknown drain matrix on disposable PG17.
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

const realm = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

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
	schema := fmt.Sprintf("fc_unk_drain_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-unk-drain-specs-")
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
	exec(p, `CREATE TABLE harness_source_gate (
 realm_id uuid PRIMARY KEY, generation bigint NOT NULL DEFAULT 1,
 admission text NOT NULL DEFAULT 'open' CHECK (admission IN ('open','closed','poisoned')),
 drain text NOT NULL DEFAULT 'pending' CHECK (drain IN ('pending','unresolved','drained')),
 cleanup_attempts int NOT NULL DEFAULT 0, cancel_flag bool NOT NULL DEFAULT false)`)
	exec(p, `CREATE TABLE harness_lease (
 lease_id uuid PRIMARY KEY, realm_id uuid NOT NULL REFERENCES harness_source_gate(realm_id),
 generation bigint NOT NULL, status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','ended')),
 ended_at timestamptz)`)
	exec(p, `CREATE TABLE harness_command (
 command_id uuid PRIMARY KEY, realm_id uuid NOT NULL, ending text NOT NULL DEFAULT 'pending'
  CHECK (ending IN ('pending','unknown','known_success','known_reject')))`)
	exec(p, `INSERT INTO harness_source_gate (realm_id) VALUES ($1::uuid)`, realm)
}

func gate(p *pgxpool.Pool) (adm, drain string, gen int64) {
	must(p.QueryRow(ctx, `SELECT admission,drain,generation FROM harness_source_gate WHERE realm_id=$1`, realm).
		Scan(&adm, &drain, &gen))
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

func applyPoison(tx pgx.Tx) (bool, error) {
	if _, err := tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1 FOR UPDATE`, realm); err != nil {
		return false, err
	}
	_, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='poisoned',drain='unresolved' WHERE realm_id=$1`, realm)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func requestClose(tx pgx.Tx) (bool, error) {
	var adm string
	if err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1 FOR UPDATE`, realm).Scan(&adm); err != nil || adm == "poisoned" {
		return false, tx.Rollback(ctx)
	}
	_, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='closed' WHERE realm_id=$1`, realm)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func tryAcquire(tx pgx.Tx, leaseID string, gen int64) (bool, error) {
	var adm string
	if err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1 FOR UPDATE`, realm).Scan(&adm); err != nil || adm != "open" {
		return false, tx.Rollback(ctx)
	}
	var g int64
	if err := tx.QueryRow(ctx, `SELECT generation FROM harness_source_gate WHERE realm_id=$1`, realm).Scan(&g); err != nil || g != gen {
		return false, tx.Rollback(ctx)
	}
	_, err := tx.Exec(ctx, `INSERT INTO harness_lease (lease_id,realm_id,generation) VALUES ($1,$2,$3)`, leaseID, realm, gen)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func writeReceipt(tx pgx.Tx, cmdID string, durable int16, ending string) (bool, error) {
	if _, err := tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1 FOR UPDATE`, realm); err != nil {
		return false, err
	}
	var sql string
	switch durable {
	case 2:
		sql = `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=9001,success_server_id=server_id,success_player_id=player_id,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1 AND command_id=$2::uuid AND durable_state=1`
	case 3:
		sql = `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE realm_id=$1 AND command_id=$2::uuid AND durable_state=1`
	default:
		return false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, sql, realm, cmdID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	_, err = tx.Exec(ctx, `UPDATE harness_command SET ending=$2 WHERE command_id=$1::uuid`, cmdID, ending)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func markUnknown(tx pgx.Tx, cmdID string) (bool, error) {
	_, err := tx.Exec(ctx, `UPDATE harness_command SET ending='unknown' WHERE command_id=$1::uuid`, cmdID)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func tryDeclareDrained(tx pgx.Tx) (bool, error) {
	var adm string
	var gen int64
	if err := tx.QueryRow(ctx, `SELECT admission,generation FROM harness_source_gate WHERE realm_id=$1 FOR UPDATE`, realm).
		Scan(&adm, &gen); err != nil || adm != "closed" {
		return false, tx.Rollback(ctx)
	}
	var n int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_lease WHERE realm_id=$1 AND generation=$2 AND status='held'`, realm, gen).Scan(&n); err != nil || n > 0 {
		return false, tx.Rollback(ctx)
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_command WHERE realm_id=$1 AND ending IN ('pending','unknown')`, realm).Scan(&n); err != nil || n > 0 {
		return false, tx.Rollback(ctx)
	}
	_, err := tx.Exec(ctx, `UPDATE harness_source_gate SET generation=generation+1,admission='open',drain='pending' WHERE realm_id=$1`, realm)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func localReleaseLease(tx pgx.Tx, leaseID string) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended',ended_at=now() WHERE lease_id=$1 AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

var mapY int = 21

func seedCmd(p *pgxpool.Pool, cmdID string, acct int64) {
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	mapY++
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,11,$1,1)`, mapY)
	exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,43,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdID, acct, c1, fct1, sha)
	exec(p, `INSERT INTO harness_command (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmdID, realm)
}

func seedAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('ud_u','ud_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,43,$1,'ud_p')`, acct)
	return acct
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

	run := func(fn func(*pgxpool.Pool)) {
		pool, done := fresh()
		defer done()
		apply(pool)
		installFixture(pool)
		fn(pool)
	}

	run(func(p *pgxpool.Pool) {
		cmd := "c1111111-1111-4111-8111-111111111111"
		acct := seedAcct(p)
		seedCmd(p, cmd, acct)
		assert(withTx(p, applyPoison), "poison")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return writeReceipt(tx, cmd, 3, "known_reject") }), "receipt")
		adm, drain, _ := gate(p)
		assert(adm == "poisoned" && drain == "unresolved", "unresolved after receipt")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquire(tx, "f1111111-1111-4111-8111-111111111111", 1) }), "no admission")
		fmt.Println("PASS unknown_drain: poison_receipt_drain_unresolved_no_admit")
	})

	run(func(p *pgxpool.Pool) {
		cmdA, cmdB := "c2222222-2222-4222-8222-222222222222", "c3333333-3333-4333-8333-333333333333"
		acct := seedAcct(p)
		seedCmd(p, cmdA, acct)
		seedCmd(p, cmdB, acct)
		assert(withTx(p, applyPoison), "poison sibling unknown")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markUnknown(tx, cmdA) }), "unknown A")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return writeReceipt(tx, cmdB, 2, "known_success") }), "receipt B")
		adm, drain, _ := gate(p)
		assert(adm == "poisoned" && drain == "unresolved", "sibling unknown blocks drain")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquire(tx, "f2222222-2222-4222-8222-222222222222", 1) }), "no admit")
		fmt.Println("PASS unknown_drain: sibling_unknown_receipt_no_drain")
	})

	run(func(p *pgxpool.Pool) {
		cmd := "c4444444-4444-4444-8444-444444444444"
		lease := "f4444444-4444-4444-8444-444444444444"
		acct := seedAcct(p)
		seedCmd(p, cmd, acct)
		exec(p, `INSERT INTO harness_lease (lease_id,realm_id,generation) VALUES ($1,$2,1)`, lease, realm)
		assert(withTx(p, applyPoison), "poison")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return markUnknown(tx, cmd) }), "unknown")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return localReleaseLease(tx, lease) }), "lease release")
		exec(p, `UPDATE harness_source_gate SET cleanup_attempts=cleanup_attempts+1,cancel_flag=true WHERE realm_id=$1`, realm)
		_, drain, _ := gate(p)
		assert(drain == "unresolved", "local actions no drain")
		fmt.Println("PASS unknown_drain: local_release_cancel_no_false_drained")
	})

	run(func(p *pgxpool.Pool) {
		cmd, lease := "c5555555-5555-4555-8555-555555555555", "f5555555-5555-4555-8555-555555555555"
		acct := seedAcct(p)
		seedCmd(p, cmd, acct)
		exec(p, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1,$2,1,'held')`, lease, realm)
		assert(withTx(p, requestClose), "close")
		assert(!withTx(p, tryDeclareDrained), "held blocks drain")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) {
			tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended',ended_at=now() WHERE lease_id=$1 AND status='held'`, lease)
			if err != nil || tag.RowsAffected() != 1 {
				return false, tx.Rollback(ctx)
			}
			_, err = tx.Exec(ctx, `UPDATE harness_command SET ending='known_success' WHERE command_id=$1::uuid`, cmd)
			if err != nil {
				return false, err
			}
			return true, tx.Commit(ctx)
		}), "known end")
		assert(withTx(p, tryDeclareDrained), "drained")
		adm, drain, gen := gate(p)
		assert(adm == "open" && drain == "pending" && gen == 2, "new gen open after drain")
		assert(withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquire(tx, "f6666666-6666-4666-8666-666666666666", 2) }), "gen2 admit")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquire(tx, "f7777777-7777-4777-8777-777777777777", 1) }), "gen1 closed")
		fmt.Println("PASS unknown_drain: normal_close_drain_new_generation_continue")
	})

	run(func(p *pgxpool.Pool) {
		assert(withTx(p, applyPoison), "poison path")
		assert(!withTx(p, tryDeclareDrained), "poison no drain")
		_, drain, _ := gate(p)
		assert(drain == "unresolved", "poison stays unresolved")
		assert(!withTx(p, func(tx pgx.Tx) (bool, error) { return tryAcquire(tx, "f8888888-8888-4888-8888-888888888888", 2) }), "no fake new gen")
		fmt.Println("PASS unknown_drain: new_generation_after_drain_poison_blocked")
	})

	fmt.Println("MODE: isolated PG17 unknown drain fixture; not production admission controller")
}
