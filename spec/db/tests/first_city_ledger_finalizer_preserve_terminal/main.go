// SPEC-FIRST-CITY-LEDGER-FINALIZER-PRESERVE-TERMINAL-001: §7.6 terminal immutability; disposable PG17.
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
	realm      = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	cmdID      = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
	fixCityID  = int64(88001)
	mapX, mapY = 10, 20
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
	schema := fmt.Sprintf("fc_fpt_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-fpt-specs-")
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
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('fpt_u','fpt_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	return acct
}

func seedCommon(p *pgxpool.Pool, acct int64) {
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'fpt_p')`, acct)
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,4)`, mapX, mapY)
}

func seedHead(p *pgxpool.Pool, acct int64) {
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ('%s'::uuid,1,42,$1,'%s'::uuid)`, realm, cmdID), acct)
}

func insertPending(p *pgxpool.Pool, acct int64) {
	c1 := "\\x01"
	fct1 := "\\x" + strings.Repeat("00", 52)
	sha := "\\x" + strings.Repeat("ab", 32)
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ('%s'::uuid,1,42,'%s'::uuid,$1,'%s',1,'t','r','c',1,'%s','%s',now())`,
		realm, cmdID, c1, fct1, sha), acct)
}

func insertSuccess(p *pgxpool.Pool, acct int64) {
	c1 := "\\x01"
	fct1 := "\\x" + strings.Repeat("00", 52)
	sha := "\\x" + strings.Repeat("ab", 32)
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,
 received_at,terminal_at,success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ('%s'::uuid,1,42,'%s'::uuid,$1,'%s',2,'t','r','c',1,'%s','%s',now(),now(),$2,1,42,true,1,100)`,
		realm, cmdID, c1, fct1, sha), acct, fixCityID)
}

func insertReject(p *pgxpool.Pool, acct int64, reason int16) {
	c1 := "\\x01"
	fct1 := "\\x" + strings.Repeat("00", 52)
	sha := "\\x" + strings.Repeat("ab", 32)
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,
 received_at,terminal_at,rejection_reason)
 VALUES ('%s'::uuid,1,42,'%s'::uuid,$1,'%s',3,'t','r','c',1,'%s','%s',now(),now(),$2)`,
		realm, cmdID, c1, fct1, sha), acct, reason)
}

func snapSuccess(p *pgxpool.Pool) (state int16, cityID *int64) {
	must(p.QueryRow(ctx, `SELECT durable_state,success_city_id FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).
		Scan(&state, &cityID))
	return state, cityID
}

func snapReject(p *pgxpool.Pool) (state, reason int16) {
	must(p.QueryRow(ctx, `SELECT durable_state,rejection_reason FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).
		Scan(&state, &reason))
	return state, reason
}

// finalizer mirrors companion §5.2: abort unless durable_state=1 before terminal UPDATE.
func tryFinalizer(pool *pgxpool.Pool, reason int16) (committed bool) {
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
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil || head == nil || *head != cmdID {
		return false
	}
	var st int16
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`, cmdID).
		Scan(&st); err != nil || st != 1 {
		return false
	}
	var terrain int16
	if err = tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&terrain); err != nil {
		return false
	}
	if terrain == 4 {
		return false
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=$2
 WHERE command_id=$1::uuid AND durable_state=1`, cmdID, reason)
	if err != nil || tag.RowsAffected() != 1 {
		return false
	}
	return tx.Commit(ctx) == nil
}

func scenarioSuccessPreserved(p *pgxpool.Pool) {
	acct := insertAcct(p)
	seedCommon(p, acct)
	insertSuccess(p, acct)
	seedHead(p, acct)
	st, city := snapSuccess(p)
	assert(st == 2 && city != nil && *city == fixCityID, "seed success")
	assert(!tryFinalizer(p, 1), "must not COMMIT reject over success")
	st, city = snapSuccess(p)
	assert(st == 2 && city != nil && *city == fixCityID, "success unchanged")
	fmt.Println("PASS finalizer_preserve_terminal: success_row_unchanged_after_finalizer_attempt")
}

func scenarioRejectPreserved(p *pgxpool.Pool) {
	acct := insertAcct(p)
	seedCommon(p, acct)
	insertReject(p, acct, 1)
	seedHead(p, acct)
	st, reason := snapReject(p)
	assert(st == 3 && reason == 1, "seed reject")
	assert(!tryFinalizer(p, 2), "must not COMMIT second reject")
	st, reason = snapReject(p)
	assert(st == 3 && reason == 1, "reject unchanged")
	fmt.Println("PASS finalizer_preserve_terminal: rejection_row_unchanged_on_retry")
}

func scenarioControlPending(p *pgxpool.Pool) {
	acct := insertAcct(p)
	seedCommon(p, acct)
	insertPending(p, acct)
	seedHead(p, acct)
	exec(p, `UPDATE map_cell SET terrain=1 WHERE server_id=1 AND x=$1 AND y=$2`, mapX, mapY)
	assert(tryFinalizer(p, 1), "PENDING control may COMMIT")
	st, reason := snapReject(p)
	assert(st == 3 && reason == 1, "lawful reject")
	fmt.Println("PASS finalizer_preserve_terminal: pending_control_commits_reject")
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
	run(scenarioSuccessPreserved)
	run(scenarioRejectPreserved)
	run(scenarioControlPending)

	fmt.Println("MODE: isolated PG17 finalizer terminal preservation (player_city_id_seq not activated)")
}
