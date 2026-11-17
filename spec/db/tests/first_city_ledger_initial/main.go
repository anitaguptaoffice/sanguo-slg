// SPEC-FIRST-CITY-LEDGER-INITIAL-001: PG17 INITIAL intake arbitration; disposable only.
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

const realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

var (
	ctx     = context.Background()
	baseDir string
	dsn     string
	admin   *pgxpool.Pool
	serial  int
)

func must(err error)              { if err != nil { panic(err) } }
func assert(ok bool, m string)    { if !ok { panic(m) } }
func exec(p *pgxpool.Pool, sql string, a ...any) { _, e := p.Exec(ctx, sql, a...); must(e) }
func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }

func c1(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

func bizSum(p *pgxpool.Pool) int {
	var n int
	must(p.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+
(SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42)`).Scan(&n))
	return n
}

func head(p *pgxpool.Pool) string {
	var h string
	must(p.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&h))
	return h
}

func proposal(p *pgxpool.Pool, cmd string) (string, int, int) {
	var n string
	var x, y int
	must(p.QueryRow(ctx, `SELECT city_name,map_x,map_y FROM harness_initial_proposal WHERE command_id=$1::uuid`, cmd).Scan(&n, &x, &y))
	return n, x, y
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-initial-specs-")
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
	schema := fmt.Sprintf("fc_initial_%x_%d", time.Now().UnixNano(), serial)
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

func seed(p *pgxpool.Pool) int64 {
	exec(p, `CREATE TABLE harness_initial_proposal (command_id uuid PRIMARY KEY, city_name text NOT NULL, map_x int, map_y int)`)
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('ini_u','ini_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'ini_p')`, acct)
	return acct
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
	sql := `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`
	tag, err := tx.Exec(ctx, sql, realm, cmdID, acct, c1b, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO harness_initial_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
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

func withTx(pool *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) bool {
	c, err := pool.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	ok, err := fn(tx)
	must(err)
	return ok
}

func conn(pool *pgxpool.Pool) *pgxpool.Conn {
	c, err := pool.Acquire(ctx)
	must(err)
	return c
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
		return tag.RowsAffected() == 1, err
	}), "term")
}

func sAckLoss(pool *pgxpool.Pool, acct int64) {
	cmd := "b1111111-1111-4111-8111-111111111111"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmd, nil, "洛阳", 12, 34) }), "ok")
	n, x, y := proposal(pool, cmd)
	assert(n == "洛阳" && x == 12 && y == 34 && bizSum(pool) == 0, "readback")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, "b2222222-2222-4222-8222-222222222222", nil, "许昌", 1, 2) }), "no2")
	fmt.Println("PASS initial: old_intake_ack_loss_readback_reject_empty")
}

func sNewWinsLateOld(pool *pgxpool.Pool, acct int64) {
	newID, oldID := "b3333333-3333-4333-8333-333333333333", "b4444444-4444-4444-8444-444444444444"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, newID, nil, "建业", 40, 41) }), "new")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, oldID, nil, "庐江", 2, 3) }), "old")
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, oldID).Scan(&n))
	assert(n == 0 && head(pool) == newID && bizSum(pool) == 0, "canonical")
	fmt.Println("PASS initial: new_first_late_old_no_regress")
}

func sOpenCommit(pool *pgxpool.Pool, acct int64) {
	cmdA, cmdB := "b5555555-5555-4555-8555-555555555555", "b6666666-6666-4666-8666-666666666666"
	hold := make(chan struct{})
	go func() {
		c := conn(pool)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
		must(err)
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT DO NOTHING`, realm, acct)
		must(err)
		var h *string
		must(tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&h))
		c1b, fct1, sha := c1("武昌", 7, 8)
		sql := `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`
		_, err = tx.Exec(ctx, sql, realm, cmdA, acct, c1b, fct1, sha)
		must(err)
		_, err = tx.Exec(ctx, `INSERT INTO harness_initial_proposal VALUES ($1::uuid,'武昌',7,8)`, cmdA)
		must(err)
		close(hold)
		time.Sleep(80 * time.Millisecond)
		_, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmdA)
		must(err)
		must(tx.Commit(ctx))
	}()
	<-hold
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmdB, nil, "江陵", 9, 10) }), "wait")
	assert(head(pool) == cmdA, "one")
	fmt.Println("PASS initial: open_intake_commit_single_winner")
}

func sOpenRollback(pool *pgxpool.Pool, acct int64) {
	cmd := "b7777777-7777-4777-8777-777777777777"
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	must(err)
	_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT DO NOTHING`, realm, acct)
	must(err)
	c1b, fct1, sha := c1("襄阳", 11, 12)
	sql := `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`
	_, err = tx.Exec(ctx, sql, realm, cmd, acct, c1b, fct1, sha)
	must(err)
	must(tx.Rollback(ctx))
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&n))
	assert(n == 0 && withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmd, nil, "襄阳", 11, 12) }), "retry EMPTY")
	fmt.Println("PASS initial: open_intake_rollback_fresh_empty")
}

func sRejectSuccessor(pool *pgxpool.Pool, acct int64) {
	cmdA, cmdB := "b8888888-8888-4888-8888-888888888888", "b9999999-9999-4999-8999-999999999999"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmdA, nil, "汉中", 3, 4) }), "A")
	term(pool, cmdA, 3)
	assert(head(pool) == cmdA, "retain")
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmdB, &cmdA, "益州", 5, 6) }), "B")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, "baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", nil, "幽州", 1, 1) }), "EMPTY")
	bad := "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, "bccccccc-cccc-4ccc-8ccc-cccccccccccc", &bad, "并州", 2, 2) }), "stale")
	assert(head(pool) == cmdB, "succ")
	fmt.Println("PASS initial: reject_successor_exact_pred")
}

func sEmptyAllowed(pool *pgxpool.Pool, acct int64) {
	cmd := "bddddddd-dddd-4ddd-8ddd-dddddddddddd"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmd, nil, "空城提案", 20, 21) }), "once")
	var st int16
	must(pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st))
	assert(st == 1 && bizSum(pool) == 0, "pending")
	fmt.Println("PASS initial: no_lineage_empty_once")
}

func sDualProposal(pool *pgxpool.Pool, acct int64) {
	cmdA, cmdB := "beeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "bfffffff-ffff-4fff-8fff-ffffffffffff"
	begin := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	okA, okB := false, false
	go func() { defer wg.Done(); <-begin; okA = withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmdA, nil, "甲城", 30, 31) }) }()
	go func() { defer wg.Done(); <-begin; okB = withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, cmdB, nil, "乙城", 32, 33) }) }()
	close(begin)
	wg.Wait()
	assert((okA != okB) && bizSum(pool) == 0, "one winner")
	win, lose := cmdA, cmdB
	if okB {
		win, lose = cmdB, cmdA
	}
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, lose).Scan(&n))
	assert(n == 0 && head(pool) == win, "loser")
	name, x, y := proposal(pool, win)
	assert(name != "" && x > 0 && y > 0, "own coords")
	var pend int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE durable_state=1`).Scan(&pend))
	assert(pend == 1, "no auto effect")
	fmt.Println("PASS initial: dual_proposal_canonical_winner")
}

func sLineageEmpty(pool *pgxpool.Pool, acct int64) {
	p := "c1111111-1111-4111-8111-111111111111"
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, p, nil, "p", 1, 2) }), "p")
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, "c2222222-2222-4222-8222-222222222222", nil, "x", 3, 4) }), "pend")
	fmt.Println("PASS initial: pending_rejects_empty")
	pool2, done := fresh()
	defer done()
	apply(pool2)
	acct = seed(pool2)
	s := "c3333333-3333-4333-8333-333333333333"
	assert(withTx(pool2, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, s, nil, "s", 5, 6) }), "s")
	term(pool2, s, 2)
	assert(!withTx(pool2, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, "c4444444-4444-4444-8444-444444444444", nil, "y", 7, 8) }), "succ")
	fmt.Println("PASS initial: succeeded_rejects_empty")
	pool3, done3 := fresh()
	defer done3()
	apply(pool3)
	acct = seed(pool3)
	r := "c5555555-5555-4555-8555-555555555555"
	assert(withTx(pool3, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, r, nil, "r", 9, 10) }), "r")
	term(pool3, r, 3)
	assert(!withTx(pool3, func(tx pgx.Tx) (bool, error) { return intake(tx, acct, "c6666666-6666-4666-8666-666666666666", nil, "z", 11, 12) }), "rej")
	assert(head(pool3) == r, "slot kept")
	fmt.Println("PASS initial: rejection_rejects_empty")
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
		fn(pool, seed(pool))
	}
	for _, s := range []func(*pgxpool.Pool, int64){
		sAckLoss, sNewWinsLateOld, sOpenCommit, sOpenRollback, sRejectSuccessor, sEmptyAllowed, sDualProposal,
	} {
		run(s)
	}
	run(sLineageEmpty)
	fmt.Println("MODE: isolated PG17 INITIAL arbitration; not WS/browser; player_city_id_seq not activated")
}
