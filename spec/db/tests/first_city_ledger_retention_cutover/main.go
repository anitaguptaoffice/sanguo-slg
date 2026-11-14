// SPEC-FIRST-CITY-LEDGER-RETENTION-CUTOVER-001: §9/§11 retention fail-closed on disposable PG17.
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

const realm = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e44"

var ctx = context.Background()
var baseDir, dsn string
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
	baseDir, err = os.MkdirTemp("", "fc-retention-specs-")
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
	schema := fmt.Sprintf("fc_retention_%x_%d", serial, serial)
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

func installFixture(p *pgxpool.Pool) {
	exec(p, `CREATE TABLE harness_retention_proposal (command_id uuid PRIMARY KEY, city_name text NOT NULL, map_x int, map_y int)`)
	exec(p, `CREATE TABLE harness_retention_integrity (
 single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),
 restore_provenance_ok bool NOT NULL DEFAULT true,
 migration_digest_only bool NOT NULL DEFAULT false,
 template_catalog_ok bool NOT NULL DEFAULT true,
 allocator_highwater bigint NOT NULL DEFAULT 0)`)
	exec(p, `INSERT INTO harness_retention_integrity DEFAULT VALUES`)
}

func seed(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('ret_u','ret_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'ret_p')`, acct)
	return acct
}

func lineageN(tx pgx.Tx) (int, error) {
	var n int
	err := tx.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&n)
	return n, err
}

func integrityOK(tx pgx.Tx) (bool, error) {
	var rp, digestOnly, tmpl bool
	var hw int64
	err := tx.QueryRow(ctx, `SELECT restore_provenance_ok,migration_digest_only,template_catalog_ok,allocator_highwater
 FROM harness_retention_integrity WHERE single_row`).Scan(&rp, &digestOnly, &tmpl, &hw)
	if err != nil {
		return false, err
	}
	if !rp || digestOnly || !tmpl {
		return false, nil
	}
	var maxCity *int64
	_ = tx.QueryRow(ctx, `SELECT max(city_id) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&maxCity)
	if maxCity != nil && hw < *maxCity {
		return false, nil
	}
	return true, nil
}

func intakeRetention(tx pgx.Tx, acct int64, cmdID string, pred *string, name string, x, y int) (bool, error) {
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
		ok, err := integrityOK(tx)
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
	if _, err = tx.Exec(ctx, `INSERT INTO harness_retention_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
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

func term(pool *pgxpool.Pool, cmd string, st int16) {
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) {
		var tag pgconn.CommandTag
		var err error
		if st == 3 {
			tag, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1 WHERE command_id=$1::uuid AND durable_state=1`, cmd)
		} else {
			tag, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),success_city_id=88001,success_server_id=1,success_player_id=42,success_is_capital=true,success_wall_level=1,success_morale=100 WHERE command_id=$1::uuid AND durable_state=1`, cmd)
		}
		if err != nil || tag.RowsAffected() != 1 {
			return false, tx.Rollback(ctx)
		}
		return true, tx.Commit(ctx)
	}), "term")
}

func observe(p *pgxpool.Pool, cmd string) (head string, st int16, name string, cmdN int) {
	must(p.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head))
	must(p.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st))
	must(p.QueryRow(ctx, `SELECT city_name FROM harness_retention_proposal WHERE command_id=$1::uuid`, cmd).Scan(&name))
	must(p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&cmdN))
	return
}

func sSucceededDeleteTransfer(pool *pgxpool.Pool, acct int64) {
	cmd := "f1111111-1111-4111-8111-111111111111"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intakeRetention(tx, acct, cmd, nil, "长安", 10, 11) }), "intake")
	term(pool, cmd, 2)
	exec(pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'长安',10,11,true)`)
	exec(pool, `DELETE FROM player_city WHERE server_id=1 AND city_id=88001`)
	exec(pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88002,999,'迁出城',99,99,false)`)
	head, st, name, n := observe(pool, cmd)
	assert(head == cmd && st == 2 && name == "长安" && n == 1, "retained success lineage")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeRetention(tx, acct, "f2222222-2222-4222-8222-222222222222", nil, "新城", 12, 13)
	}), "no EMPTY after delete/transfer sim")
	fmt.Println("PASS retention: succeeded_delete_transfer_no_empty_reopen")
}

func sRejectionResetFailClosed(pool *pgxpool.Pool, acct int64) {
	cmd := "f3333333-3333-4333-8333-333333333333"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intakeRetention(tx, acct, cmd, nil, "拒城", 20, 21) }), "intake")
	term(pool, cmd, 3)
	exec(pool, `UPDATE world_first_city_actor_slot SET head_command_id=NULL WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
	head, st, _, n := observe(pool, cmd)
	assert(n == 1 && st == 3, "rejection row retained")
	_ = head
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeRetention(tx, acct, "f4444444-4444-4444-8444-444444444444", nil, "清后新城", 22, 23)
	}), "reset head does not authorize EMPTY")
	must(pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st))
	assert(st == 3, "terminal rejection unchanged")
	fmt.Println("PASS retention: rejection_reset_no_empty_initial")
}

func sAccountRebindFailClosed(pool *pgxpool.Pool, acct int64) {
	cmd := "f5555555-5555-4555-8555-555555555555"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intakeRetention(tx, acct, cmd, nil, "绑城", 30, 31) }), "intake")
	exec(pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('ret_u2','h2',1)`)
	var acct2 int64
	must(pool.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name='ret_u2'`).Scan(&acct2))
	exec(pool, `UPDATE player SET account_id=$1 WHERE server_id=1 AND player_id=42`, acct2)
	head, st, name, n := observe(pool, cmd)
	assert(head == cmd && st == 1 && name == "绑城" && n == 1, "rows kept after rebind")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeRetention(tx, acct2, "f6666666-6666-4666-8666-666666666666", nil, "新绑", 32, 33)
	}), "rebind blocks EMPTY")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeRetention(tx, acct, "f7777777-7777-4777-8777-777777777777", nil, "旧绑", 34, 35)
	}), "old binding also blocked")
	fmt.Println("PASS retention: account_rebind_fail_closed")
}

func sIncompleteRestoreFailClosed(pool *pgxpool.Pool, acct int64) {
	cmd := "f8888888-8888-4888-8888-888888888888"
	c1b, fct1, sha := c1("恢城", 40, 41)
	exec(pool, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmd, acct, c1b, fct1, sha)
	exec(pool, `INSERT INTO harness_retention_proposal VALUES ($1::uuid,'恢城',40,41)`, cmd)
	var cmds int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&cmds))
	assert(cmds == 1, "orphan command without slot (partial restore sim)")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intakeRetention(tx, acct, "f9999999-9999-4999-8999-999999999999", nil, "补写", 42, 43)
	}), "partial restore blocks EMPTY")
	exec(pool, `UPDATE harness_retention_integrity SET restore_provenance_ok=false`)
	pool2, done := fresh()
	defer done()
	apply(pool2)
	installFixture(pool2)
	acct2 := seed(pool2)
	exec(pool2, `UPDATE harness_retention_integrity SET migration_digest_only=true`)
	assert(!withTx(pool2, func(tx pgx.Tx) (bool, error) {
		return intakeRetention(tx, acct2, "faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", nil, "digest", 1, 2)
	}), "digest-only not integrity")
	exec(pool2, `UPDATE harness_retention_integrity SET migration_digest_only=false, template_catalog_ok=false`)
	assert(!withTx(pool2, func(tx pgx.Tx) (bool, error) {
		return intakeRetention(tx, acct2, "fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", nil, "lost tmpl", 3, 4)
	}), "lost template blocks EMPTY")
	exec(pool2, `UPDATE harness_retention_integrity SET template_catalog_ok=true`)
	exec(pool2, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y) VALUES (1,90001,42,'legacy',5,6)`)
	exec(pool2, `UPDATE harness_retention_integrity SET allocator_highwater=100`)
	assert(!withTx(pool2, func(tx pgx.Tx) (bool, error) {
		return intakeRetention(tx, acct2, "fccccccc-cccc-4ccc-8ccc-cccccccccccc", nil, "zero city", 7, 8)
	}), "allocator rollback blocks legacy zero-city EMPTY")
	fmt.Println("PASS retention: incomplete_restore_no_autofill_no_empty")
}

func sLawfulMultiCity(pool *pgxpool.Pool, acct int64) {
	cmd := "fddddddd-dddd-4ddd-8ddd-dddddddddddd"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intakeRetention(tx, acct, cmd, nil, "首城", 50, 51) }), "first slot intake")
	term(pool, cmd, 2)
	exec(pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'首城',50,51,true)`)
	exec(pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88010,42,'分城',60,61,false)`)
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&n))
	assert(n == 2, "lawful multi-city rows")
	head, st, _, _ := observe(pool, cmd)
	assert(head == cmd && st == 2, "first slot head unchanged")
	fmt.Println("PASS retention: lawful_multi_city_not_blocked")
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
	for _, fn := range []func(*pgxpool.Pool, int64){
		sSucceededDeleteTransfer, sRejectionResetFailClosed, sAccountRebindFailClosed,
		sIncompleteRestoreFailClosed, sLawfulMultiCity,
	} {
		run(fn)
	}
	fmt.Println("MODE: isolated PG17 retention/cutover fail-closed; not WS/browser/realm fence; player_city_id_seq not activated")
}
