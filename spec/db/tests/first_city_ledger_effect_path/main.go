// SPEC-FIRST-CITY-LEDGER-EFFECT-PATH-001: PG17 full effect-path business race; disposable only.
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
	realm    = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	cmdID    = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
	fixCity  = 88001
	mapX     = 10
	mapY     = 20
	cityLock = 1128879193
)

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
func exec(p *pgxpool.Pool, sql string) { _, err := p.Exec(ctx, sql); must(err) }
func apply(p *pgxpool.Pool)           { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_fx_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "5s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-effect-specs-")
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

func installMilOrigin(p *pgxpool.Pool) {
	exec(p, `CREATE TABLE mil_city_origin (
 server_id int NOT NULL CHECK (server_id>0), city_id bigint NOT NULL CHECK (city_id>0),
 owner_player_id bigint NOT NULL CHECK (owner_player_id>0),
 cohort_id bytea NOT NULL CHECK (octet_length(cohort_id)=16 AND cohort_id<>decode(repeat('00',16),'hex')),
 format_version smallint NOT NULL CHECK (format_version=1), created_at timestamptz NOT NULL,
 PRIMARY KEY (server_id,city_id))`)
}

func seedPending(p *pgxpool.Pool) {
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('fx_u','fx_h',1)`)
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name)
 VALUES (1,42,(SELECT account_id FROM account LIMIT 1),'fx_p')`)
	exec(p, fmt.Sprintf(`INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,%d,%d,4)`, mapX, mapY))
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 SELECT '%s'::uuid,1,42,'%s'::uuid,account_id,'%s',1,'t','r','c',1,'%s','%s',now() FROM account`, realm, cmdID, c1, fct1, sha))
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 SELECT '%s'::uuid,1,42,account_id,'%s'::uuid FROM account`, realm, cmdID))
}

func bizSum(p *pgxpool.Pool) int {
	var n int
	q := `SELECT
(SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+
(SELECT count(*) FROM player_city WHERE server_id=1 AND city_id=$1)+
(SELECT count(*) FROM city_troop WHERE server_id=1 AND city_id=$1)+
(SELECT count(*) FROM mil_city_origin WHERE server_id=1 AND city_id=$1)+
(SELECT count(*) FROM city_production_checkpoint WHERE server_id=1 AND city_id=$1)+
(SELECT count(*) FROM city_building WHERE server_id=1 AND city_id=$1)`
	must(p.QueryRow(ctx, q, fixCity).Scan(&n))
	return n
}

func durableState(p *pgxpool.Pool) int {
	var s int
	must(p.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`, realm, cmdID).Scan(&s))
	return s
}

func assertFullEffect(p *pgxpool.Pool) {
	assert(durableState(p) == 2, "durable_state=2")
	var sid int64
	must(p.QueryRow(ctx, `SELECT success_city_id FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`, realm, cmdID).Scan(&sid))
	assert(sid == fixCity && bizSum(p) == 6, "success receipt + six business rows")
}

func effectBusiness(tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold)
 VALUES (1,42,1000,1000,1000,1000,100) ON CONFLICT DO NOTHING`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM player_wallet WHERE server_id=1 AND player_id=42 FOR UPDATE`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1,1)`, cityLock); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 AND terrain=4 FOR UPDATE`, mapX, mapY); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO player_city
 (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
 VALUES (1,$1,42,'fx-city',$2,$3,true,1,100)`, fixCity, mapX, mapY); err != nil {
		return err
	}
	rest := []string{
		`INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at)
 VALUES (1,$1,42,decode(repeat('01',16),'hex'),1,date_trunc('milliseconds',now() AT TIME ZONE 'UTC'))`,
		`INSERT INTO city_troop (server_id,city_id,unit_cfg_id,count) VALUES (1,$1,1,0)`,
		`INSERT INTO city_production_checkpoint (server_id,city_id,player_id,settled_at)
 VALUES (1,$1,42,date_trunc('microseconds',now()))`,
		`INSERT INTO city_building (server_id,city_id,slot_key,building_cfg_id,level) VALUES (1,$1,'town_hall',1,1)`,
	}
	for _, sql := range rest {
		if _, err := tx.Exec(ctx, sql, fixCity); err != nil {
			return err
		}
	}
	return nil
}

func effectTerminal(tx pgx.Tx) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command
 SET durable_state=2,terminal_at=now(),success_city_id=$3,success_server_id=1,success_player_id=42,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`,
		realm, cmdID, fixCity)
	return tag.RowsAffected() == 1, err
}

func lockPending(tx pgx.Tx) (st int, err error) {
	if _, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm); err != nil {
		return 0, err
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil {
		return 0, err
	}
	if head == nil || *head != cmdID {
		return 0, tx.Rollback(ctx)
	}
	err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid FOR UPDATE`, realm, cmdID).Scan(&st)
	return st, err
}

func effectParticipant(tx pgx.Tx) (bool, error) {
	st, err := lockPending(tx)
	if err != nil || st != 1 {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	if err := effectBusiness(tx); err != nil {
		return false, err
	}
	ok, err := effectTerminal(tx)
	if err != nil || !ok {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func finalizerParticipant(tx pgx.Tx) (bool, error) {
	st, err := lockPending(tx)
	if err != nil || st != 1 {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	if err := tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(new(int)); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`, realm, cmdID)
	if err != nil || tag.RowsAffected() != 1 {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	return true, tx.Commit(ctx)
}

func conn(pool *pgxpool.Pool) *pgxpool.Conn {
	c, err := pool.Acquire(ctx)
	must(err)
	return c
}

func racePrimary(pool *pgxpool.Pool, primary string, wantState int, label string) {
	type run func(pgx.Tx) (bool, error)
	var primaryFn, loserFn run
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
	assert(committed, "primary COMMIT")
	time.Sleep(50 * time.Millisecond)
	assert(durableState(pool) == wantState, "terminal evidence")
	if wantState == 2 {
		assertFullEffect(pool)
	} else {
		assert(bizSum(pool) == 0, "no business on reject")
	}
	assert(!loserCommitted, "loser rolled back")
	fmt.Println("PASS effect-path race:", label)
}

func scenarioOpenTxn(pool *pgxpool.Pool) {
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
	st, err := lockPending(tx)
	must(err)
	assert(st == 1, "effect holds PENDING")
	must(effectBusiness(tx))
	close(startFin)
	time.Sleep(80 * time.Millisecond)
	assert(durableState(pool) == 1 && bizSum(pool) == 0, "spy: open txn")
	ok, err := effectTerminal(tx)
	must(err)
	assert(ok, "terminal in open txn")
	must(tx.Commit(ctx))
	assertFullEffect(pool)
	fmt.Println("PASS effect-path: no committed business or terminal while opponent open")
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
		installMilOrigin(pool)
		seedPending(pool)
		fn(pool)
	}
	run(func(p *pgxpool.Pool) { racePrimary(p, "effect", 2, "effect business + receipt before finalizer") })
	run(func(p *pgxpool.Pool) { racePrimary(p, "finalizer", 3, "finalizer before effect business path") })
	run(scenarioOpenTxn)
	fmt.Println("MODE: PG17 full effect-path (fixture city_id=88001; player_city_id_seq not activated)")
}
