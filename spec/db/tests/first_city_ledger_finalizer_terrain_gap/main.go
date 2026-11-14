// SPEC-FIRST-CITY-LEDGER-FINALIZER-TERRAIN-GAP-001: finalizer inter-gap terrain flip; disposable PG17.
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

// effectBranch simulates §7.8 bound actual-branch evidence (in-process only; not durable columns).
type effectBranch struct {
	reason          int16
	terrainAtBranch int16
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
	schema := fmt.Sprintf("fc_ftg_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-ftg-specs-")
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

func insertAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('ftg_u','h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name='ftg_u'`).Scan(&acct))
	return acct
}

func seedPending(p *pgxpool.Pool, acct int64, terrain int16) {
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'ftg_p')`, acct)
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

func flipBuildable(p *pgxpool.Pool) {
	exec(p, `UPDATE map_cell SET terrain=4 WHERE server_id=1 AND x=$1 AND y=$2`, mapX, mapY)
	var t int16
	must(p.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2`, mapX, mapY).Scan(&t))
	assert(buildable(t), "terrain flipped to buildable")
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

func finalizerTx(pool *pgxpool.Pool, reason int16, branch *effectBranch) (committed bool) {
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
	var st int16
	must(tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid FOR UPDATE`,
		realm, cmdID).Scan(&st))
	if st != 1 {
		return false
	}
	var terrain int16
	must(tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&terrain))
	ok := false
	switch reason {
	case 1:
		if branch != nil && branch.reason == 1 && !buildable(branch.terrainAtBranch) {
			ok = true
		} else {
			ok = !buildable(terrain)
		}
	default:
		return false
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

func effectSuccess(pool *pgxpool.Pool) (committed bool) {
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
	var st int16
	must(tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid FOR UPDATE`,
		realm, cmdID).Scan(&st))
	if st != 1 {
		return false
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command
 SET durable_state=2, terminal_at=now(), success_city_id=88001, success_server_id=1,
     success_player_id=42, success_is_capital=true, success_wall_level=1, success_morale=100
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`,
		realm, cmdID)
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

func scenarioLiveOnlyRollback(pool *pgxpool.Pool) {
	acct := insertAcct(pool)
	seedPending(pool, acct, 1)
	flipBuildable(pool)
	before := readSnap(pool)
	assert(!finalizerTx(pool, 1, nil), "live-only must ROLLBACK after gap flip")
	after := readSnap(pool)
	assertPending(after)
	assert(bizRows(pool) == 0, "no business")
	assert(before.state == 1, "was PENDING")
	fmt.Println("PASS finalizer_terrain_gap: gap_live_only_reason1_rollback_stays_pending")
}

func scenarioBoundBranchCommit(pool *pgxpool.Pool) {
	acct := insertAcct(pool)
	seedPending(pool, acct, 1)
	branch := &effectBranch{reason: 1, terrainAtBranch: 1}
	flipBuildable(pool)
	assert(finalizerTx(pool, 1, branch), "bound branch may COMMIT after gap flip")
	after := readSnap(pool)
	assert(after.state == 3 && after.terminalAt && after.rejectionReason == 1, "terminal reason 1")
	assert(bizRows(pool) == 0, "no business on reject")
	var terrain int16
	must(pool.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2`, mapX, mapY).Scan(&terrain))
	assert(buildable(terrain), "rejection does not claim live unbuildable")
	fmt.Println("PASS finalizer_terrain_gap: gap_bound_branch_commits_reject_live_still_buildable")
}

func scenarioEffectWinsInGap(pool *pgxpool.Pool) {
	acct := insertAcct(pool)
	seedPending(pool, acct, 1)
	flipBuildable(pool)
	assert(effectSuccess(pool), "effect may succeed on buildable terrain")
	assert(!finalizerTx(pool, 1, nil), "finalizer reject blocked after success")
	after := readSnap(pool)
	assert(after.state == 2 && after.terminalAt, "sole success terminal")
	fmt.Println("PASS finalizer_terrain_gap: gap_effect_success_blocks_finalizer_reject")
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
	run(scenarioLiveOnlyRollback)
	run(scenarioBoundBranchCommit)
	run(scenarioEffectWinsInGap)

	fmt.Println("MODE: isolated PG17 finalizer terrain-gap (player_city_id_seq not activated)")
}
