// Maintenance-role batch import representative (OID §6.3). NOT production cmd/gm.
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ctx = context.Background()

func must(err error) { if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(2) } }
func env(k, d string) string { if v := os.Getenv(k); v != "" { return v }; return d }

func main() {
	dsn, schema, mode := os.Getenv("HARNESS_DSN"), os.Getenv("HARNESS_SCHEMA"), os.Getenv("HARNESS_MODE")
	if dsn == "" || schema == "" || mode == "" || (mode != "hold" && mode != "commit") {
		fmt.Fprintln(os.Stderr, "HARNESS_DSN/SCHEMA/MODE(hold|commit) required"); os.Exit(2)
	}
	x, _ := strconv.Atoi(env("HARNESS_X", "41")); y, _ := strconv.Atoi(env("HARNESS_Y", "42"))
	cityID, _ := strconv.ParseInt(env("HARNESS_CITY_ID", "88002"), 10, 64)
	holdSec, _ := strconv.Atoi(env("HARNESS_HOLD_SEC", "120"))
	capital := env("HARNESS_IS_CAPITAL", "1") == "1"
	cfg, err := pgxpool.ParseConfig(dsn); must(err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg); must(err)
	defer pool.Close()
	fmt.Println("GM_IMPORT_BATCH_ENTRY: spec/db/tests/.../batch_worker (cmd/gm has no city-import subcommand)")
	c, err := pool.Acquire(ctx); must(err)
	defer c.Release()
	tx, err := c.Begin(ctx); must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `SELECT set_config('harness.gm_import_batch','1',true)`); must(err)
	if mode == "hold" {
		_, err = tx.Exec(ctx, `SELECT slot FROM harness_gm_batch_hold WHERE slot=1 FOR UPDATE`); must(err)
		fmt.Println("WORKER_HOLDING")
	}
	name := env("HARNESS_NAME", "import-city")
	_, err = tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold) VALUES (1,42,5000,5000,5000,5000,50) ON CONFLICT (server_id,player_id) DO UPDATE SET food=player_wallet.food+1`)
	must(err)
	if mode == "hold" { _, _ = tx.Exec(ctx, `SAVEPOINT gm_batch_city`) }
	_, err = tx.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (1,$1,42,$2,$3,$4,$5,1,100)`, cityID, name, x, y, capital)
	if err != nil {
		if mode == "hold" { _, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT gm_batch_city`) }
		fmt.Println("GM_IMPORT_BATCH_ERR:", err)
		if mode == "hold" { time.Sleep(time.Duration(holdSec) * time.Second); fmt.Println("GM_IMPORT_HOLD_END") }
		fmt.Println("WORKER_DONE"); return
	}
	if mode == "hold" { _, _ = tx.Exec(ctx, `RELEASE SAVEPOINT gm_batch_city`) }
	cohort := make([]byte, 16); cohort[0] = 0x01
	_, err = tx.Exec(ctx, `INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at) VALUES (1,$1,42,$2,1,now())`, cityID, cohort)
	if err != nil {
		fmt.Println("GM_IMPORT_BATCH_ERR:", err)
		if mode == "hold" { time.Sleep(time.Duration(holdSec) * time.Second); fmt.Println("GM_IMPORT_HOLD_END") }
		fmt.Println("WORKER_DONE"); return
	}
	if mode == "hold" {
		fmt.Printf("STAGED_CITY_ID=%d\n", cityID)
		time.Sleep(time.Duration(holdSec) * time.Second)
		fmt.Println("GM_IMPORT_HOLD_END"); fmt.Println("WORKER_DONE"); return
	}
	must(tx.Commit(ctx))
	fmt.Printf("GM_IMPORT_BATCH_COMMITTED city_id=%d\n", cityID)
	fmt.Println("WORKER_DONE")
}
