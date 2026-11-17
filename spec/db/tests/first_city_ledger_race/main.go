// SPEC-FIRST-CITY-LEDGER-RACE-001: isolated PG17 effect/finalizer race; no production DSN.
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
	cmdID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
)

var (
	ctx     = context.Background()
	baseDir string
	dsn     string
	admin   *pgxpool.Pool
	serial  int
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
func exec(p *pgxpool.Pool, sql string) { _, err := p.Exec(ctx, sql); must(err) }

func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, string, func()) {
	serial++
	schema := fmt.Sprintf("fc_race_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "5s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, schema, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-race-specs-")
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

func durableState(p *pgxpool.Pool) int {
	var s int
	must(p.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`,
		realm, cmdID).Scan(&s))
	return s
}

func seedPending(p *pgxpool.Pool) {
	c1 := "\\x01"
	fct1 := "\\x" + strings.Repeat("00", 52)
	sha := "\\x" + strings.Repeat("ab", 32)
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('race_u','race_h',1)`)
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name)
 VALUES (1,42,(SELECT account_id FROM account LIMIT 1),'race_p')`)
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,10,20,4)`)
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 SELECT '%s'::uuid,1,42,'%s'::uuid,account_id,'%s',1,'t','r','c',1,'%s','%s',now()
 FROM account LIMIT 1`, realm, cmdID, c1, fct1, sha))
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 SELECT '%s'::uuid,1,42,account_id,'%s'::uuid FROM account LIMIT 1`, realm, cmdID))
}

func effectParticipant(tx pgx.Tx) (committed bool, err error) {
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return false, err
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil {
		return false, err
	}
	if head == nil || *head != cmdID {
		return false, tx.Rollback(ctx)
	}
	var st int
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid
 FOR UPDATE`, realm, cmdID).Scan(&st); err != nil {
		return false, err
	}
	if st != 1 {
		return false, tx.Rollback(ctx)
	}
	ok, err := effectTerminal(tx)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func effectTerminal(tx pgx.Tx) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command
 SET durable_state=2, terminal_at=now(), success_city_id=88001, success_server_id=1,
     success_player_id=42, success_is_capital=true, success_wall_level=1, success_morale=100
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid
 AND durable_state=1`, realm, cmdID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func finalizerParticipant(tx pgx.Tx) (committed bool, err error) {
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return false, err
	}
	if _, err = tx.Exec(ctx, `SELECT 1 FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm); err != nil {
		return false, err
	}
	var st int
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid
 FOR UPDATE`, realm, cmdID).Scan(&st); err != nil {
		return false, err
	}
	if st != 1 {
		return false, tx.Rollback(ctx)
	}
	var terrain int
	if err = tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=10 AND y=20 FOR SHARE`).Scan(&terrain); err != nil {
		return false, err
	}
	ok, err := finalizerTerminal(tx)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func finalizerTerminal(tx pgx.Tx) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command
 SET durable_state=3, terminal_at=now(), rejection_reason=1
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid
 AND durable_state=1`, realm, cmdID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func conn(pool *pgxpool.Pool) *pgxpool.Conn {
	c, err := pool.Acquire(ctx)
	must(err)
	return c
}

func racePrimaryFirst(pool *pgxpool.Pool, primary string, wantState int, label string) {
	type run func(pgx.Tx) (bool, error)
	primaryFn, loserFn := (run)(nil), (run)(nil)
	if primary == "effect" {
		primaryFn, loserFn = effectParticipant, finalizerParticipant
	} else {
		primaryFn, loserFn = finalizerParticipant, effectParticipant
	}
	var gate sync.WaitGroup
	gate.Add(1)
	var loserCommitted bool
	go func() {
		gate.Wait()
		c := conn(pool)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		loserCommitted, err = loserFn(tx)
		must(err)
	}()
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	gate.Done()
	committed, err := primaryFn(tx)
	must(err)
	assert(committed, "primary terminal UPDATE must win when PENDING")
	time.Sleep(50 * time.Millisecond)
	assert(durableState(pool) == wantState, fmt.Sprintf("committed row evidence: durable_state=%d", wantState))
	assert(!loserCommitted, "loser must not COMMIT opposing terminal")
	fmt.Println("PASS race:", label)
}

func scenarioOpponentOpen(pool *pgxpool.Pool) {
	startFin := make(chan struct{})
	go func() {
		<-startFin
		c := conn(pool)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		_, _ = finalizerParticipant(tx)
	}()
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	must(err)
	_, err = tx.Exec(ctx, `SELECT 1 FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm)
	must(err)
	_, err = tx.Exec(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid FOR UPDATE`,
		realm, cmdID)
	must(err)
	close(startFin)
	time.Sleep(80 * time.Millisecond)
	assert(durableState(pool) == 1, "spy: opposing txn open — no conflict terminal committed yet")
	ok, err := effectTerminal(tx)
	must(err)
	assert(ok, "effect completes while finalizer waited on same command PK")
	must(tx.Commit(ctx))
	assert(durableState(pool) == 2, "spy: only success terminal after effect COMMIT")
	fmt.Println("PASS race: no conflict terminal while opponent holds command FOR UPDATE")
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

	run := func(fn func(*pgxpool.Pool)) {
		pool, _, done := fresh()
		defer done()
		apply(pool)
		seedPending(pool)
		fn(pool)
	}
	run(func(p *pgxpool.Pool) {
		racePrimaryFirst(p, "effect", 2, "effect commits success before finalizer")
	})
	run(func(p *pgxpool.Pool) {
		racePrimaryFirst(p, "finalizer", 3, "finalizer commits rejection before effect")
	})
	run(scenarioOpponentOpen)

	fmt.Println("MODE: isolated PG17 concurrent effect/finalizer race (fixture city_id=88001; player_city_id_seq not activated)")
}
