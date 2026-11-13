// OID §6 row 12 new ledger intake/effect representative. NOT production route; NOT signed_rollback_apply_worker.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ctx = context.Background()

const realm = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e66"

func must(err error) { if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(2) } }
func env(k, d string) string { if v := os.Getenv(k); v != "" { return v }; return d }

func c1(name string, x, y int) (string, string, string) {
	b := append([]byte{0x01}, []byte(name)...)
	b = append(b, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(b)
	return `\x` + hex.EncodeToString(b), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

func main() {
	dsn, schema, mode := os.Getenv("HARNESS_DSN"), os.Getenv("HARNESS_SCHEMA"), os.Getenv("HARNESS_MODE")
	if dsn == "" || schema == "" || mode == "" || (mode != "hold" && mode != "commit") {
		fmt.Fprintln(os.Stderr, "HARNESS_DSN/SCHEMA/MODE required"); os.Exit(2)
	}
	fmt.Println("NEW_LEDGER_ROUTE_ENTRY: new_ledger_route_worker (harness representative; not_production_route=true)")

	x, _ := strconv.Atoi(env("HARNESS_X", "11"))
	y, _ := strconv.Atoi(env("HARNESS_Y", "12"))
	cityID, _ := strconv.ParseInt(env("HARNESS_CITY_ID", "88201"), 10, 64)
	holdSec, _ := strconv.Atoi(env("HARNESS_HOLD_SEC", "120"))
	capital := env("HARNESS_IS_CAPITAL", "1") == "1"
	name := env("HARNESS_NAME", "new-route-city")
	cmdID := env("HARNESS_CMD_ID", "f1111111-1111-4111-8111-111111111111")

	conn, err := pgx.Connect(ctx, dsn); must(err)
	defer func() { must(conn.Close(ctx)) }()
	_, err = conn.Exec(ctx, "SET search_path TO "+schema); must(err)
	tx, err := conn.Begin(ctx); must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `SELECT set_config('harness.new_ledger_route','1',true)`); must(err)

	var ok bool
	must(tx.QueryRow(ctx, `SELECT harness_nia_route_authorized()`).Scan(&ok))
	if !ok {
		fmt.Println("NIA_ERR: route not authorized (profile/inventory/§5 obligations)")
		return
	}
	if mode == "hold" {
		_, err = tx.Exec(ctx, `SELECT slot FROM harness_nia_hold WHERE slot=1 FOR UPDATE`); must(err)
		fmt.Println("WORKER_HOLDING")
		_, _ = tx.Exec(ctx, `SAVEPOINT nia_bundle`)
	}
	var acct int64
	must(tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=1 AND player_id=42`).Scan(&acct))
	c1b, fct1, sha := c1(name, x, y)
	if !capital {
		_, err = tx.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (1,$1,42,$2,$3,$4,false,1,100)`, cityID, name, x, y)
		if err != nil { niaFail(tx, mode, holdSec, err); return }
	} else {
		_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm); if err != nil { niaFail(tx, mode, holdSec, err); return }
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT DO NOTHING`, realm, acct); if err != nil { niaFail(tx, mode, holdSec, err); return }
		var head *string
		if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil || head != nil {
			niaFail(tx, mode, holdSec, fmt.Errorf("intake head blocked"))
			return
		}
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdID, acct, c1b, fct1, sha)
		if err != nil { niaFail(tx, mode, holdSec, err); return }
		_, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmdID)
		if err != nil { niaFail(tx, mode, holdSec, err); return }
		_, err = tx.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (1,$1,42,$2,$3,$4,true,1,100)`, cityID, name, x, y)
		if err != nil { niaFail(tx, mode, holdSec, err); return }
		_, err = tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),success_city_id=$2,success_server_id=1,success_player_id=42,success_is_capital=true,success_wall_level=1,success_morale=100 WHERE command_id=$1::uuid AND durable_state=1`, cmdID, cityID)
		if err != nil { niaFail(tx, mode, holdSec, err); return }
		_, err = tx.Exec(ctx, `UPDATE harness_nia_allocator_highwater SET highwater=$2 WHERE single_row`, cityID)
		if err != nil { niaFail(tx, mode, holdSec, err); return }
	}
	if mode == "hold" {
		_, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT nia_bundle`)
		time.Sleep(time.Duration(holdSec) * time.Second)
		fmt.Println("NIA_HOLD_END WORKER_DONE")
		return
	}
	must(tx.Commit(ctx))
	fmt.Printf("NIA_COMMITTED city_id=%d WORKER_DONE\n", cityID)
}

func niaFail(tx pgx.Tx, mode string, holdSec int, err error) {
	if mode == "hold" { _, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT nia_bundle`) }
	fmt.Println("NIA_ERR:", err)
	if mode == "hold" { time.Sleep(time.Duration(holdSec) * time.Second) }
	fmt.Println("WORKER_DONE")
}
