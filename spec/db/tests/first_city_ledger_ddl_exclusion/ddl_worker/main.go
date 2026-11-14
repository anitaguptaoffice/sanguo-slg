// DDL representative (OID §6 row 7). NOT production migration controller.
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ctx = context.Background()
const realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e33"

func must(err error)       { if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(2) } }
func env(k, d string) string { if v := os.Getenv(k); v != "" { return v }; return d }

func main() {
	dsn, schema := os.Getenv("HARNESS_DSN"), os.Getenv("HARNESS_SCHEMA")
	entry, mode := os.Getenv("HARNESS_ENTRY"), os.Getenv("HARNESS_MODE")
	if dsn == "" || schema == "" || mode == "" || entry == "" || (entry != "apply_specs" && entry != "manual_migration" && entry != "lazy_store") || (mode != "hold" && mode != "commit") {
		fmt.Fprintln(os.Stderr, "HARNESS_DSN/SCHEMA/ENTRY/MODE required"); os.Exit(2)
	}
	x, _ := strconv.Atoi(env("HARNESS_X", "41")); y, _ := strconv.Atoi(env("HARNESS_Y", "42"))
	cityID, _ := strconv.ParseInt(env("HARNESS_CITY_ID", "88002"), 10, 64)
	holdSec, _ := strconv.Atoi(env("HARNESS_HOLD_SEC", "120"))
	capital := env("HARNESS_IS_CAPITAL", "1") == "1"
	cfg, err := pgxpool.ParseConfig(dsn); must(err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg); must(err)
	defer pool.Close()
	fmt.Println("DDL_ENTRY:", entry, "(harness ddl_worker; not production controller)")
	c, err := pool.Acquire(ctx); must(err)
	defer c.Release()
	tx, err := c.Begin(ctx); must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `SELECT set_config('harness.ddl_role',$1,true)`, entry); must(err)
	if _, err = tx.Exec(ctx, `INSERT INTO harness_ddl_owner_claim(role) VALUES ($1) ON CONFLICT DO NOTHING`, entry); err != nil {
		fmt.Println("DDL_ERR:", err); finishHold(mode, holdSec); return
	}
	switch entry {
	case "apply_specs":
		_, err = tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_ddl_apply_touch (id int PRIMARY KEY); INSERT INTO schema_migrations(name) VALUES ('harness_ddl_apply_touch.sql') ON CONFLICT DO NOTHING`)
	case "manual_migration":
		_, err = tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_ddl_manual_touch (id int PRIMARY KEY); ALTER TABLE harness_ddl_manual_touch ADD COLUMN IF NOT EXISTS bumped int NOT NULL DEFAULT 0`)
	case "lazy_store":
		_, err = tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_ddl_lazy_hero_shadow (server_id int NOT NULL, hero_id bigint NOT NULL, city_id bigint NOT NULL, PRIMARY KEY (server_id, hero_id))`)
	}
	must(err)
	_, err = tx.Exec(ctx, `CREATE SEQUENCE IF NOT EXISTS harness_ddl_seq; SELECT nextval('harness_ddl_seq')`); must(err)
	if mode == "hold" {
		_, err = tx.Exec(ctx, `SELECT slot FROM harness_ddl_hold WHERE slot=1 FOR UPDATE`); must(err)
		fmt.Println("WORKER_HOLDING")
	}
	name := env("HARNESS_NAME", "ddl-city")
	if mode == "hold" { _, _ = tx.Exec(ctx, `SAVEPOINT ddl_bundle`) }
	if capital {
		_, err = tx.Exec(ctx, `UPDATE harness_ddl_allocator_highwater SET highwater = highwater - 1000 WHERE single_row`)
		if err != nil { fail(tx, mode, holdSec, err); return }
		_, err = tx.Exec(ctx, `DELETE FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
		if err != nil { fail(tx, mode, holdSec, err); return }
	}
	_, err = tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold) VALUES (1,42,1,1,1,1,1) ON CONFLICT (server_id,player_id) DO UPDATE SET food=player_wallet.food+1`); must(err)
	_, err = tx.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (1,$1,42,$2,$3,$4,$5,1,100)`, cityID, name, x, y, capital)
	if err != nil { fail(tx, mode, holdSec, err); return }
	if mode == "hold" {
		_, _ = tx.Exec(ctx, `RELEASE SAVEPOINT ddl_bundle`)
		time.Sleep(time.Duration(holdSec) * time.Second)
		fmt.Println("DDL_HOLD_END WORKER_DONE"); return
	}
	must(tx.Commit(ctx))
	fmt.Printf("DDL_COMMITTED city_id=%d entry=%s WORKER_DONE\n", cityID, entry)
}

func fail(tx pgx.Tx, mode string, holdSec int, err error) {
	if mode == "hold" { _, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT ddl_bundle`) }
	fmt.Println("DDL_ERR:", err)
	finishHold(mode, holdSec)
}

func finishHold(mode string, holdSec int) {
	if mode == "hold" { time.Sleep(time.Duration(holdSec) * time.Second) }
	fmt.Println("WORKER_DONE")
}
