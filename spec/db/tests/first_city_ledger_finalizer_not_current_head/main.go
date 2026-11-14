// SPEC-FIRST-CITY-LEDGER-FINALIZER-NOT-CURRENT-HEAD-001: §7.6 head match; disposable PG17.
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
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	realm    = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	cmdStale = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"
	cmdHead  = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55"
	mapX     = 10
	mapY     = 20
)

var (
	ctx          = context.Background()
	baseDir, dsn string
	admin        *pgxpool.Pool
	serial       int
)

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
	schema := fmt.Sprintf("fc_fnch_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-fnch-specs-")
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

func insertAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('fnch_u','fnch_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	return acct
}

func insertCommand(p *pgxpool.Pool, acct int64, cmdID string, state int16) {
	c1 := "\\x01"
	fct1 := "\\x" + strings.Repeat("00", 52)
	sha := "\\x" + strings.Repeat("ab", 32)
	sql := fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ('%s'::uuid,1,42,'%s'::uuid,$1,'%s',%d,'t','r','c',1,'%s','%s',now())`,
		realm, cmdID, c1, state, fct1, sha)
	if state == 3 {
		sql = fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,rejection_reason)
 VALUES ('%s'::uuid,1,42,'%s'::uuid,$1,'%s',3,'t','r','c',1,'%s','%s',now(),now(),1)`,
			realm, cmdID, c1, fct1, sha)
	}
	exec(p, sql, acct)
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,$3) ON CONFLICT DO NOTHING`, mapX, mapY, 1)
}

func seedActorPendingHead(p *pgxpool.Pool, acct int64, head string) {
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'fnch_p')`, acct)
	insertCommand(p, acct, cmdStale, 1)
	if head == cmdHead {
		insertCommand(p, acct, cmdHead, 3)
	}
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ('%s'::uuid,1,42,$1,'%s'::uuid)`, realm, head), acct)
}

func headOf(p *pgxpool.Pool) string {
	var h *string
	must(p.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&h))
	if h == nil {
		return ""
	}
	return *h
}

func snap(p *pgxpool.Pool, cmdID string) (state int16, terminal bool) {
	var term *time.Time
	must(p.QueryRow(ctx, `SELECT durable_state,terminal_at FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).
		Scan(&state, &term))
	return state, term != nil
}

func bizRows(p *pgxpool.Pool) int {
	var n int
	must(p.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+
 (SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42)`).Scan(&n))
	return n
}

// finalizer mirrors companion §5.2 head check for target command id.
func finalizer(pool *pgxpool.Pool, target string, reason int16) (committed bool) {
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
	if err != nil {
		return false
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil || head == nil || *head != target {
		return false
	}
	var st int16
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`, target).
		Scan(&st); err != nil || st != 1 {
		return false
	}
	var terrain int16
	if err = tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&terrain); err != nil || terrain == 4 {
		return false
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=$2
 WHERE command_id=$1::uuid AND durable_state=1`, target, reason)
	if err != nil || tag.RowsAffected() != 1 {
		return false
	}
	return tx.Commit(ctx) == nil
}

func scenarioStaleNotHead(p *pgxpool.Pool) {
	acct := insertAcct(p)
	seedActorPendingHead(p, acct, cmdHead)
	st, term := snap(p, cmdStale)
	assert(st == 1 && !term, "stale still PENDING")
	assert(headOf(p) == cmdHead, "head is successor")
	assert(!finalizer(p, cmdStale, 1), "non-head finalizer must not COMMIT")
	st, term = snap(p, cmdStale)
	assert(st == 1 && !term, "stale unchanged")
	assert(headOf(p) == cmdHead, "head unchanged")
	assert(bizRows(p) == 0, "no business")
	fmt.Println("PASS finalizer_not_current_head: stale_pending_blocked_when_head_advanced")
}

func scenarioRejectKeepsHead(p *pgxpool.Pool) {
	acct := insertAcct(p)
	seedActorPendingHead(p, acct, cmdStale)
	assert(finalizer(p, cmdStale, 1), "current head may COMMIT reject")
	st, term := snap(p, cmdStale)
	assert(st == 3 && term, "terminal reject")
	assert(headOf(p) == cmdStale, "head not advanced on reject")
	assert(bizRows(p) == 0, "no business")
	fmt.Println("PASS finalizer_not_current_head: reject_keeps_same_head_command_id")
}

func scenarioControl(p *pgxpool.Pool) {
	acct := insertAcct(p)
	seedActorPendingHead(p, acct, cmdStale)
	assert(finalizer(p, cmdStale, 1), "control commit")
	st, _ := snap(p, cmdStale)
	assert(st == 3, "reject committed")
	fmt.Println("PASS finalizer_not_current_head: current_head_control_commits")
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
	run(scenarioStaleNotHead)
	run(scenarioRejectKeepsHead)
	run(scenarioControl)

	fmt.Println("MODE: isolated PG17 finalizer head match (player_city_id_seq not activated)")
}
