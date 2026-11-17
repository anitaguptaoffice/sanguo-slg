// SPEC-FIRST-CITY-LEDGER-FINALIZER-ROLLBACK-001: companion §5 narrow finalizer rollback on disposable PG17.
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
	cmdID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"
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
	schema := fmt.Sprintf("fc_fin_rb_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-fin-rb-specs-")
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

func seedAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('fin_u','fin_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'fin_p')`, acct)
	return acct
}

func seedPending(p *pgxpool.Pool, acct int64, terrain int16) {
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,$3)`, mapX, mapY, terrain)
	exec(p, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`,
		realm, cmdID, acct, c1, fct1, sha)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmdID)
}

func occupierAt(p *pgxpool.Pool) {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('occ_u','occ_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name='occ_u'`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,99,$1,'occ_p')`, acct)
	exec(p, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
 VALUES (1,77001,99,'occ-city',$1,$2,false,1,100)`, mapX, mapY)
}

func readSnap(p *pgxpool.Pool) cmdSnap {
	var s cmdSnap
	var term *time.Time
	var rej *int16
	must(p.QueryRow(ctx, `SELECT durable_state,terminal_at,rejection_reason FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`, realm, cmdID).
		Scan(&s.state, &term, &rej))
	s.terminalAt = term != nil
	if rej != nil {
		s.rejectionReasonOK = true
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

func finalizerTx(pool *pgxpool.Pool, reason int16, stopBeforeUpdate bool, wrongCmd string) (committed bool) {
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
	var occ *int64
	err = tx.QueryRow(ctx, `SELECT city_id FROM player_city WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&occ)
	hasOcc := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		must(err)
	}
	ok := false
	switch reason {
	case 1:
		ok = !buildable(terrain)
	case 2:
		ok = hasOcc
	}
	if !ok {
		return false
	}
	if stopBeforeUpdate {
		return false
	}
	target := cmdID
	if wrongCmd != "" {
		target = wrongCmd
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=$3
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`,
		realm, target, reason)
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

func run(pool *pgxpool.Pool, acct int64, terrain int16, withOcc bool, reason int16, label string,
	stopBefore bool, wrongCmd string, wantReject bool, wantReason int16) {
	if withOcc {
		occupierAt(pool)
	}
	seedPending(pool, acct, terrain)
	before := readSnap(pool)
	assert(bizRows(pool) == 0, "baseline no business")
	committed := finalizerTx(pool, reason, stopBefore, wrongCmd)
	after := readSnap(pool)
	if wantReject {
		assert(committed, label+": must COMMIT terminal reject")
		assert(after.state == 3 && after.terminalAt && after.rejectionReason == wantReason, label+": receipt")
		assert(bizRows(pool) == 0, label+": no business writes")
		assert(before.state == 1, label+": was PENDING before")
		fmt.Println("PASS finalizer_rollback:", label, "COMMIT reason", wantReason, "no business")
		return
	}
	assert(!committed, label+": must not COMMIT")
	assertPending(after)
	assert(sameSnap(before, after), label+": no mutation on rollback")
	assert(bizRows(pool) == 0, label+": still no business")
	fmt.Println("PASS finalizer_rollback:", label, "ROLLBACK stays PENDING")
}

func sameSnap(a, b cmdSnap) bool {
	return a.state == b.state && a.terminalAt == b.terminalAt && a.rejectionReason == b.rejectionReason &&
		a.rejectionReasonOK == b.rejectionReasonOK
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
	ver := ""
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	major := ""
	must(admin.QueryRow(ctx, "SELECT (current_setting('server_version_num')::integer/10000)::text").Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)

	do := func(fn func(*pgxpool.Pool, int64)) {
		pool, done := fresh()
		defer done()
		apply(pool)
		fn(pool, seedAcct(pool))
	}
	do(func(p *pgxpool.Pool, acct int64) {
		run(p, acct, 1, false, 1, "reason1_terrain", false, "", true, 1)
	})
	do(func(p *pgxpool.Pool, acct int64) {
		run(p, acct, 4, true, 2, "reason2_occupied", false, "", true, 2)
	})
	do(func(p *pgxpool.Pool, acct int64) {
		run(p, acct, 4, false, 1, "whitelist_open_cell", false, "", false, 0)
	})
	do(func(p *pgxpool.Pool, acct int64) {
		run(p, acct, 4, false, 1, "evidence_mismatch_buildable_claims_terrain", false, "", false, 0)
	})
	do(func(p *pgxpool.Pool, acct int64) {
		run(p, acct, 1, false, 2, "evidence_mismatch_no_occupier_claims_coord", false, "", false, 0)
	})
	do(func(p *pgxpool.Pool, acct int64) {
		run(p, acct, 1, false, 1, "zero_row_wrong_command_id", false,
			"d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99", false, 0)
	})
	do(func(p *pgxpool.Pool, acct int64) {
		run(p, acct, 1, false, 1, "mid_rollback_before_terminal", true, "", false, 0)
	})

	fmt.Println("MODE: isolated PG17 finalizer rollback; player_city_id_seq not activated")
}
