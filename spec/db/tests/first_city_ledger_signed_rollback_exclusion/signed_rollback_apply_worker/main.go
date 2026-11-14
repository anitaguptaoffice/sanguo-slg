// Artifact-level apply representative (OID §6 row 11). NOT production signed rollback; NOT CreateCityInTx in-process.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

var ctx = context.Background()
const realm = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55"

func must(err error) { if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(2) } }
func env(k, d string) string { if v := os.Getenv(k); v != "" { return v }; return d }

type manifest struct {
	Kind                string `json:"kind"`
	NotProductionSigned bool   `json:"not_production_signed"`
}

func main() {
	dsn, schema, mode := os.Getenv("HARNESS_DSN"), os.Getenv("HARNESS_SCHEMA"), os.Getenv("HARNESS_MODE")
	artPath := os.Getenv("HARNESS_ARTIFACT_PATH")
	if dsn == "" || schema == "" || mode == "" || artPath == "" || (mode != "hold" && mode != "commit") {
		fmt.Fprintln(os.Stderr, "HARNESS_DSN/SCHEMA/MODE/ARTIFACT_PATH required"); os.Exit(2)
	}
	raw, err := os.ReadFile(artPath); must(err)
	var mf manifest; must(json.Unmarshal(raw, &mf))
	if mf.Kind != "harness.test.rollback-artifact/v0" || !mf.NotProductionSigned {
		fmt.Fprintln(os.Stderr, "refusing non-harness artifact"); os.Exit(2)
	}
	fmt.Println("ARTIFACT_APPLY_ENTRY:", artPath, "kind=", mf.Kind, "(signed_rollback_apply_worker; not production binary)")

	x, _ := strconv.Atoi(env("HARNESS_X", "41")); y, _ := strconv.Atoi(env("HARNESS_Y", "42"))
	cityID, _ := strconv.ParseInt(env("HARNESS_CITY_ID", "88102"), 10, 64)
	holdSec, _ := strconv.Atoi(env("HARNESS_HOLD_SEC", "120"))
	capital := env("HARNESS_IS_CAPITAL", "1") == "1"
	name := env("HARNESS_NAME", "artifact-city")

	conn, err := pgx.Connect(ctx, dsn); must(err)
	defer func() { must(conn.Close(ctx)) }()
	_, err = conn.Exec(ctx, "SET search_path TO "+schema); must(err)
	tx, err := conn.Begin(ctx); must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `SELECT set_config('harness.signed_rollback_apply','1',true)`); must(err)
	if mode == "hold" {
		_, err = tx.Exec(ctx, `SELECT slot FROM harness_sr_hold WHERE slot=1 FOR UPDATE`); must(err)
		fmt.Println("WORKER_HOLDING")
		_, _ = tx.Exec(ctx, `SAVEPOINT sr_bundle`)
	}
	if capital {
		_, err = tx.Exec(ctx, `UPDATE harness_sr_allocator_highwater SET highwater = highwater - 1000 WHERE single_row`)
		if err != nil { srFail(tx, mode, holdSec, err); return }
		_, err = tx.Exec(ctx, `DELETE FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
		if err != nil { srFail(tx, mode, holdSec, err); return }
	}
	_, err = tx.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (1,$1,42,$2,$3,$4,$5,1,100)`, cityID, name, x, y, capital)
	if err != nil { srFail(tx, mode, holdSec, err); return }
	if mode == "hold" {
		_, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT sr_bundle`)
		time.Sleep(time.Duration(holdSec) * time.Second)
		fmt.Println("SR_HOLD_END WORKER_DONE")
		return
	}
	must(tx.Commit(ctx))
	fmt.Printf("SR_COMMITTED city_id=%d WORKER_DONE\n", cityID)
}

func srFail(tx pgx.Tx, mode string, holdSec int, err error) {
	if mode == "hold" { _, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT sr_bundle`) }
	fmt.Println("SR_ERR:", err)
	if mode == "hold" { time.Sleep(time.Duration(holdSec) * time.Second) }
	fmt.Println("WORKER_DONE")
}
