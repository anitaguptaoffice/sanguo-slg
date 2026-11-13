// SPEC-FIRST-CITY-LEDGER-FINALIZER-ACCOUNT-BLOCK-001: finalizer account fail-closed; disposable PG17.
package main

import (
	"context"
	"errors"
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
	state                         int16
	terminalAt, rejectionReasonOK bool
	rejectionReason               int16
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
func exec(p *pgxpool.Pool, sql string, args ...any) {
	_, err := p.Exec(ctx, sql, args...)
	must(err)
}
func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_fab_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-fab-specs-")
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

func buildable(terrain int16) bool { return terrain == 4 }

func insertAcct(p *pgxpool.Pool, login string, status int16) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ($1,$2,$3)`, login, login+"_h", status)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name=$1`, login).Scan(&acct))
	return acct
}

func seedPending(p *pgxpool.Pool, acct int64, terrain int16) {
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'fab_p')`, acct)
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,$3)`, mapX, mapY, terrain)
	c1 := "\\x01"
	fct1 := "\\x" + strings.Repeat("00", 52)
	sha := "\\x" + strings.Repeat("ab", 32)
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ('%s'::uuid,1,42,'%s'::uuid,$1,'%s',1,'t','r','c',1,'%s','%s',now())`,
		realm, cmdID, c1, fct1, sha), acct)
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ('%s'::uuid,1,42,$1,'%s'::uuid)`, realm, cmdID), acct)
}

func readSnap(p *pgxpool.Pool) cmdSnap {
	var s cmdSnap
	var rej *int16
	var term *time.Time
	must(p.QueryRow(ctx, `SELECT durable_state,terminal_at,rejection_reason
 FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`,
		realm, cmdID).Scan(&s.state, &term, &rej))
	s.terminalAt = term != nil
	s.rejectionReasonOK = rej != nil
	if rej != nil {
		s.rejectionReason = *rej
	}
	return s
}

func bizRows(p *pgxpool.Pool) int {
	var n int
	must(p.QueryRow(ctx, `SELECT
(SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+
(SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42)`).Scan(&n))
	return n
}

// finalizerTx mirrors companion §5.2 including GLOBAL_PINS §6.1 account binding re-read.
func finalizerTx(pool *pgxpool.Pool, reason int16) (committed bool) {
	c, err := pool.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	must(err)
	var head *string
	must(tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head))
	if head == nil || *head != cmdID {
		return false
	}
	var cmdAcct int64
	var st int16
	must(tx.QueryRow(ctx, `SELECT durable_state,account_id FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid FOR UPDATE`,
		realm, cmdID).Scan(&st, &cmdAcct))
	if st != 1 {
		return false
	}
	var acctStatus int16
	must(tx.QueryRow(ctx, `SELECT status FROM account WHERE account_id=$1 FOR SHARE`, cmdAcct).Scan(&acctStatus))
	if acctStatus != 1 {
		return false
	}
	var bound int64
	must(tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=1 AND player_id=42 FOR SHARE`).Scan(&bound))
	if bound != cmdAcct {
		return false
	}
	var terrain int16
	must(tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&terrain))
	ok := false
	switch reason {
	case 1:
		ok = !buildable(terrain)
	case 2:
		var occ *int64
		err = tx.QueryRow(ctx, `SELECT city_id FROM player_city WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&occ)
		ok = err == nil
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			must(err)
		}
	}
	if !ok {
		return false
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=$3
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`,
		realm, cmdID, reason)
	must(err)
	if tag.RowsAffected() != 1 {
		return false
	}
	must(tx.Commit(ctx))
	return true
}

func assertPending(s cmdSnap) {
	assert(s.state == 1 && !s.terminalAt && !s.rejectionReasonOK, "PENDING without terminal columns")
}

func scenarioBanned(pool *pgxpool.Pool) {
	acct := insertAcct(pool, "fab_ban", 1)
	seedPending(pool, acct, 1)
	exec(pool, `UPDATE account SET status=2 WHERE account_id=$1`, acct)
	before := readSnap(pool)
	assert(!finalizerTx(pool, 1), "banned must not COMMIT")
	after := readSnap(pool)
	assertPending(after)
	assert(bizRows(pool) == 0, "no business")
	assert(before.state == 1, "was PENDING")
	fmt.Println("PASS finalizer_account_block: banned_account_rollback_stays_pending")
}

func scenarioRebind(pool *pgxpool.Pool) {
	old := insertAcct(pool, "fab_old", 1)
	newAcct := insertAcct(pool, "fab_new", 1)
	seedPending(pool, old, 1)
	exec(pool, `UPDATE player SET account_id=$1 WHERE server_id=1 AND player_id=42`, newAcct)
	before := readSnap(pool)
	assert(!finalizerTx(pool, 1), "drift must not COMMIT")
	after := readSnap(pool)
	assertPending(after)
	assert(bizRows(pool) == 0, "no business")
	assert(before.state == 1, "was PENDING")
	fmt.Println("PASS finalizer_account_block: player_account_drift_rollback_stays_pending")
}

func scenarioControlReject(pool *pgxpool.Pool) {
	acct := insertAcct(pool, "fab_ok", 1)
	seedPending(pool, acct, 1)
	assert(finalizerTx(pool, 1), "valid binding may COMMIT whitelist reject")
	after := readSnap(pool)
	assert(after.state == 3 && after.terminalAt && after.rejectionReason == 1, "terminal reason 1")
	assert(bizRows(pool) == 0, "no business on reject")
	fmt.Println("PASS finalizer_account_block: normal_binding_commits_reason1_no_business")
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
		fn(pool)
	}
	run(scenarioBanned)
	run(scenarioRebind)
	run(scenarioControlReject)

	fmt.Println("MODE: isolated PG17 finalizer account-binding fail-closed (player_city_id_seq not activated)")
}
