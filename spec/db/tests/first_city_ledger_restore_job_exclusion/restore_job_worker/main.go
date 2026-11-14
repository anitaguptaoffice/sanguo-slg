// Backup restore / retention job representative (OID §6.6). NOT production restore controller.
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
const realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e33"

func must(err error)       { if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(2) } }
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
	fmt.Println("RESTORE_RETENTION_JOB_ENTRY: baseline has no cmd/tools production job;",
		"harness restore_job_worker (retention-bundle commit role; not march Hub restore)")
	c, err := pool.Acquire(ctx); must(err)
	defer c.Release()
	tx, err := c.Begin(ctx); must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `SELECT set_config('harness.restore_retention_job','1',true)`); must(err)
	if mode == "hold" {
		_, err = tx.Exec(ctx, `SELECT slot FROM harness_restore_job_hold WHERE slot=1 FOR UPDATE`); must(err)
		fmt.Println("WORKER_HOLDING")
	}
	name := env("HARNESS_NAME", "restore-city")
	if mode == "hold" { _, _ = tx.Exec(ctx, `SAVEPOINT restore_bundle`) }
	if capital {
		_, err = tx.Exec(ctx, `UPDATE harness_restore_allocator_highwater SET highwater = highwater - 1000 WHERE single_row`)
		if err != nil {
			if mode == "hold" { _, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT restore_bundle`) }
			fmt.Println("RESTORE_JOB_ERR:", err); finishHold(mode, holdSec); return
		}
		_, err = tx.Exec(ctx, `DELETE FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
		if err != nil {
			if mode == "hold" { _, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT restore_bundle`) }
			fmt.Println("RESTORE_JOB_ERR:", err); finishHold(mode, holdSec); return
		}
	}
	_, err = tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold) VALUES (1,42,1,1,1,1,1) ON CONFLICT (server_id,player_id) DO UPDATE SET food=player_wallet.food+1`)
	must(err)
	_, err = tx.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (1,$1,42,$2,$3,$4,$5,1,100)`,
		cityID, name, x, y, capital)
	if err != nil {
		if mode == "hold" { _, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT restore_bundle`) }
		fmt.Println("RESTORE_JOB_ERR:", err); finishHold(mode, holdSec); return
	}
	if mode == "hold" {
		_, _ = tx.Exec(ctx, `RELEASE SAVEPOINT restore_bundle`)
		fmt.Printf("STAGED_CITY_ID=%d\n", cityID)
		time.Sleep(time.Duration(holdSec) * time.Second)
		fmt.Println("RESTORE_JOB_HOLD_END"); fmt.Println("WORKER_DONE"); return
	}
	must(tx.Commit(ctx))
	fmt.Printf("RESTORE_JOB_COMMITTED city_id=%d\n", cityID)
	fmt.Println("WORKER_DONE")
}

func finishHold(mode string, holdSec int) {
	if mode == "hold" {
		time.Sleep(time.Duration(holdSec) * time.Second)
		fmt.Println("RESTORE_JOB_HOLD_END")
	}
	fmt.Println("WORKER_DONE")
}
