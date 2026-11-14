// SPEC-FIRST-CITY-LEDGER-ABSENCE-001: §11 absence / in-flight lookup on disposable PG17.
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
	"sync"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const realm = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33"

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
	baseDir, err = os.MkdirTemp("", "fc-absence-specs-")
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
	schema := fmt.Sprintf("fc_absence_%x_%d", time.Now().UnixNano(), serial)
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
	exec(p, `CREATE TABLE harness_absence_proposal (command_id uuid PRIMARY KEY, city_name text NOT NULL, map_x int, map_y int)`)
	exec(p, `CREATE TABLE harness_absence_side (
 command_id uuid PRIMARY KEY, source_ending text NOT NULL DEFAULT 'pending'
 CHECK (source_ending IN ('pending','unknown','known')),
 cleanup_attempts int NOT NULL DEFAULT 0, cancel_flag bool NOT NULL DEFAULT false)`)
}

func seed(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('abs_u','abs_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'abs_p')`, acct)
	return acct
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

// lookupDiscover: observer path without slot locks (may see transient miss under READ COMMITTED).
func lookupDiscover(p *pgxpool.Pool) (slotRows int, head *string, cmdRows int, name string, x, y int, st *int16) {
	_ = p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&slotRows)
	err := p.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head)
	if err != nil {
		head = nil
	}
	_ = p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE server_id=1 AND player_id=42`).Scan(&cmdRows)
	if head == nil {
		return
	}
	err = p.QueryRow(ctx, `SELECT city_name,map_x,map_y FROM harness_absence_proposal WHERE command_id=$1::uuid`, *head).Scan(&name, &x, &y)
	if err != nil {
		name, x, y = "", 0, 0
	}
	var ds int16
	if err = p.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, *head).Scan(&ds); err == nil {
		st = &ds
	}
	return
}

func intake(tx pgx.Tx, acct int64, cmdID string, pred *string, name string, x, y int) (bool, error) {
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
	if _, err = tx.Exec(ctx, `INSERT INTO harness_absence_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
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

// continuationRead: frozen lock boundary then read head + proposal (no new EMPTY, no ID/coord rewrite).
func continuationRead(tx pgx.Tx, expectCmd string) (bool, error) {
	_, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return false, err
	}
	var head *string
	err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head)
	if err != nil || head == nil || *head != expectCmd {
		return false, tx.Rollback(ctx)
	}
	var st int16
	var name string
	var x, y int
	err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, expectCmd).Scan(&st)
	if err != nil || st != 1 {
		return false, tx.Rollback(ctx)
	}
	err = tx.QueryRow(ctx, `SELECT city_name,map_x,map_y FROM harness_absence_proposal WHERE command_id=$1::uuid`, expectCmd).Scan(&name, &x, &y)
	if err != nil {
		return false, tx.Rollback(ctx)
	}
	if name == "" {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func sOpenMissNoSubstitute(pool *pgxpool.Pool, acct int64) {
	cmdA, cmdB := "d1111111-1111-4111-8111-111111111111", "d2222222-2222-4222-8222-222222222222"
	hold, done := make(chan struct{}), make(chan struct{})
	go func() {
		c, err := pool.Acquire(ctx)
		must(err)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
		must(err)
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT DO NOTHING`, realm, acct)
		must(err)
		c1b, fct1, sha := c1("成都", 50, 51)
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdA, acct, c1b, fct1, sha)
		must(err)
		_, err = tx.Exec(ctx, `INSERT INTO harness_absence_proposal VALUES ($1::uuid,'成都',50,51)`, cmdA)
		must(err)
		close(hold)
		time.Sleep(60 * time.Millisecond)
		_, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmdA)
		must(err)
		must(tx.Commit(ctx))
		close(done)
	}()
	<-hold
	slots, head, cmds, _, _, _, _ := lookupDiscover(pool)
	_ = slots
	assert(cmds == 0 || head == nil, "transient miss must not certify EMPTY")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmdB, nil, "重庆", 52, 53) }), "no second EMPTY")
	<-done
	slots, head, cmds, name, x, y, st := lookupDiscover(pool)
	assert(slots == 1 && head != nil && *head == cmdA && cmds == 1 && name == "成都" && x == 50 && y == 51, "identity kept")
	assert(st != nil && *st == 1, "PENDING readback")
	fmt.Println("PASS absence: open_txn_lookup_miss_no_empty_substitute")
}

func sOpenPendingVisible(pool *pgxpool.Pool, acct int64) {
	cmd := "d3333333-3333-4333-8333-333333333333"
	hold, done := make(chan struct{}), make(chan struct{})
	go func() {
		c, err := pool.Acquire(ctx)
		must(err)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
		must(err)
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT DO NOTHING`, realm, acct)
		must(err)
		c1b, fct1, sha := c1("荆州", 60, 61)
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmd, acct, c1b, fct1, sha)
		must(err)
		_, err = tx.Exec(ctx, `INSERT INTO harness_absence_proposal VALUES ($1::uuid,'荆州',60,61)`, cmd)
		must(err)
		_, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmd)
		must(err)
		close(hold)
		time.Sleep(70 * time.Millisecond)
		must(tx.Commit(ctx))
		close(done)
	}()
	<-hold
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return continuationRead(tx, cmd) }), "wait pending")
	}()
	wg.Wait()
	<-done
	_, head, _, name, x, y, st := lookupDiscover(pool)
	assert(head != nil && *head == cmd && name == "荆州" && x == 60 && y == 61 && st != nil && *st == 1, "same identity")
	fmt.Println("PASS absence: open_txn_pending_lock_wait_identity")
}

func sContinuationAfterCommit(pool *pgxpool.Pool, acct int64) {
	cmd := "d4444444-4444-4444-8444-444444444444"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmd, nil, "武昌", 70, 71) }), "intake")
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return continuationRead(tx, cmd) }), "continue same")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) {
		return intake(tx, acct, "d5555555-5555-4555-8555-555555555555", nil, "江陵", 72, 73)
	}), "no new city while pending")
	fmt.Println("PASS absence: continuation_same_lock_reads_original")
}

func sUnknownNoLocalClear(pool *pgxpool.Pool, acct int64) {
	cmd := "d6666666-6666-4666-8666-666666666666"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmd, nil, "襄阳", 80, 81) }), "seed pending")
	exec(pool, `INSERT INTO harness_absence_side (command_id,source_ending) VALUES ($1::uuid,'unknown')`, cmd)
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) {
		_, err := tx.Exec(ctx, `UPDATE harness_absence_side SET cleanup_attempts=cleanup_attempts+1,cancel_flag=true WHERE command_id=$1::uuid`, cmd)
		if err != nil {
			return false, err
		}
		return continuationRead(tx, cmd)
	}), "lookup continue under unknown")
	exec(pool, `UPDATE harness_absence_side SET cleanup_attempts=cleanup_attempts+1 WHERE command_id=$1`, cmd)
	var head string
	must(pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head))
	assert(head == cmd, "head not cleared to EMPTY")
	var st int16
	must(pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st))
	assert(st == 1, "still PENDING")
	var ending string
	must(pool.QueryRow(ctx, `SELECT source_ending FROM harness_absence_side WHERE command_id=$1`, cmd).Scan(&ending))
	assert(ending == "unknown", "unknown not locally resolved")
	n, name, x, y := 0, "", 0, 0
	must(pool.QueryRow(ctx, `SELECT count(*),max(city_name),max(map_x),max(map_y) FROM harness_absence_proposal WHERE command_id=$1`, cmd).Scan(&n, &name, &x, &y))
	assert(n == 1 && name == "襄阳" && x == 80 && y == 81, "coords unchanged")
	fmt.Println("PASS absence: unknown_local_cleanup_no_empty_clear")
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
	for _, fn := range []func(*pgxpool.Pool, int64){sOpenMissNoSubstitute, sOpenPendingVisible, sContinuationAfterCommit, sUnknownNoLocalClear} {
		run(fn)
	}
	fmt.Println("MODE: isolated PG17 absence lookup; not WS/browser/drain matrix; player_city_id_seq not activated")
}
