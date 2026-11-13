// SPEC-FIRST-CITY-LEDGER-ATOMICITY-001: per-barrier effect txn rollback; disposable PG17 only.
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
func exec(p *pgxpool.Pool, sql string, args ...any) { _, err := p.Exec(ctx, sql, args...); must(err) }
func apply(p *pgxpool.Pool)                          { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_at_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 4
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "5s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-atomicity-specs-")
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
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('at_u','at_h',1)`)
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name)
 VALUES (1,42,(SELECT account_id FROM account LIMIT 1),'at_p')`)
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

func assertRollbackObserver(p *pgxpool.Pool) {
	assert(durableState(p) == 1, "observer: PENDING durable_state=1")
	assert(bizSum(p) == 0, "observer: zero committed business rows")
}

func lockEffectRow(tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm); err != nil {
		return err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil {
		return err
	}
	if head == nil || *head != cmdID {
		return fmt.Errorf("head mismatch")
	}
	var st int
	return tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid FOR UPDATE`, realm, cmdID).Scan(&st)
}

func walletStep(tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold)
 VALUES (1,42,1000,1000,1000,1000,100) ON CONFLICT DO NOTHING`); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `SELECT 1 FROM player_wallet WHERE server_id=1 AND player_id=42 FOR UPDATE`)
	return err
}

func worldStep(tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1,1)`, cityLock); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 AND terrain=4 FOR UPDATE`, mapX, mapY); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `INSERT INTO player_city
 (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
 VALUES (1,$1,42,'at-city',$2,$3,true,1,100)`, fixCity, mapX, mapY)
	return err
}

func milStep(tx pgx.Tx) error {
	rest := []string{
		`INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at)
 VALUES (1,$1,42,decode(repeat('01',16),'hex'),1,date_trunc('milliseconds',now() AT TIME ZONE 'UTC'))`,
		`INSERT INTO city_troop (server_id,city_id,unit_cfg_id,count) VALUES (1,$1,1,0)`,
	}
	for _, sql := range rest {
		if _, err := tx.Exec(ctx, sql, fixCity); err != nil {
			return err
		}
	}
	return nil
}

func domStep(tx pgx.Tx) error {
	rest := []string{
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

func receiptStep(tx pgx.Tx) error {
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command
 SET durable_state=2,terminal_at=now(),success_city_id=$3,success_server_id=1,success_player_id=42,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`,
		realm, cmdID, fixCity)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("receipt not applied")
	}
	return nil
}

func rollbackTxn(pool *pgxpool.Pool, label string, fn func(pgx.Tx) error) {
	c, err := pool.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	must(lockEffectRow(tx))
	must(fn(tx))
	must(tx.Rollback(ctx))
	assertRollbackObserver(pool)
	fmt.Println("PASS atomicity:", label)
}

func scenarioWallet(pool *pgxpool.Pool) {
	rollbackTxn(pool, "wallet barrier before WORLD", func(tx pgx.Tx) error { return walletStep(tx) })
}

func scenarioWorld(pool *pgxpool.Pool) {
	rollbackTxn(pool, "WORLD INSERT before MIL", func(tx pgx.Tx) error {
		if err := walletStep(tx); err != nil {
			return err
		}
		return worldStep(tx)
	})
}

func scenarioMIL(pool *pgxpool.Pool) {
	rollbackTxn(pool, "MIL incomplete before DOM", func(tx pgx.Tx) error {
		if err := walletStep(tx); err != nil {
			return err
		}
		if err := worldStep(tx); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at)
 VALUES (1,$1,42,decode(repeat('01',16),'hex'),1,date_trunc('milliseconds',now() AT TIME ZONE 'UTC'))`, fixCity)
		return err
	})
}

func scenarioDOM(pool *pgxpool.Pool) {
	rollbackTxn(pool, "DOM incomplete before receipt", func(tx pgx.Tx) error {
		if err := walletStep(tx); err != nil {
			return err
		}
		if err := worldStep(tx); err != nil {
			return err
		}
		if err := milStep(tx); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO city_production_checkpoint (server_id,city_id,player_id,settled_at)
 VALUES (1,$1,42,date_trunc('microseconds',now()))`, fixCity)
		return err
	})
}

func scenarioReceipt(pool *pgxpool.Pool) {
	rollbackTxn(pool, "receipt staged then ROLLBACK before COMMIT", func(tx pgx.Tx) error {
		if err := walletStep(tx); err != nil {
			return err
		}
		if err := worldStep(tx); err != nil {
			return err
		}
		if err := milStep(tx); err != nil {
			return err
		}
		if err := domStep(tx); err != nil {
			return err
		}
		return receiptStep(tx)
	})
}

func scenarioNoRejectCommit(pool *pgxpool.Pool) {
	c, err := pool.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	must(lockEffectRow(tx))
	must(walletStep(tx))
	must(worldStep(tx))
	_, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`, realm, cmdID)
	must(err)
	must(tx.Rollback(ctx))
	assertRollbackObserver(pool)
	fmt.Println("PASS atomicity: forbidden rejection append ends in ROLLBACK not COMMIT")
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
	run(scenarioWallet)
	run(scenarioWorld)
	run(scenarioMIL)
	run(scenarioDOM)
	run(scenarioReceipt)
	run(scenarioNoRejectCommit)
	fmt.Println("MODE: PG17 per-barrier atomicity (fixture city_id=88001; player_city_id_seq not activated)")
}
