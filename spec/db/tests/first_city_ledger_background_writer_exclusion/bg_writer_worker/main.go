// Background-writer representative (OID §6 row 10). NOT production drain/fence; NOT player_city_id_seq.
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
const realm = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380e44"

func must(err error) { if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(2) } }
func env(k, d string) string { if v := os.Getenv(k); v != "" { return v }; return d }

func main() {
	dsn, schema := os.Getenv("HARNESS_DSN"), os.Getenv("HARNESS_SCHEMA")
	entry, mode := os.Getenv("HARNESS_ENTRY"), os.Getenv("HARNESS_MODE")
	ok := entry == "queue" || entry == "mail" || entry == "rank" || entry == "chat" || entry == "isolated"
	if dsn == "" || schema == "" || mode == "" || !ok || (mode != "hold" && mode != "commit") {
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
	fmt.Println("BG_ENTRY:", entry, "(harness bg_writer_worker; not production controller)")
	c, err := pool.Acquire(ctx); must(err)
	defer c.Release()
	tx, err := c.Begin(ctx); must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `SELECT set_config('harness.bg_role',$1,true)`, entry); must(err)
	switch entry {
	case "queue":
		_, err = tx.Exec(ctx, `INSERT INTO work_queue (server_id,queue_id,player_id,city_id,queue_type,payload,start_at,finish_at,status) VALUES (1,$1,42,$2,1,'{}'::jsonb,now(),now()+interval '1 hour',0)`, cityID, cityID)
	case "mail":
		_, err = tx.Exec(ctx, `INSERT INTO player_mail (server_id,mail_id,player_id,mail_type,title,body) VALUES (1,$1,42,1,$2,$2)`, cityID, env("HARNESS_NAME", "bg-mail"))
	case "rank":
		_, err = tx.Exec(ctx, `INSERT INTO rank_snapshot (server_id,rank_type,batch_id,refreshed_at,entry_count) VALUES (1,1,$1,now(),0)`, cityID)
	case "chat":
		_, err = tx.Exec(ctx, `INSERT INTO chat_message (server_id,channel_id,message_id,sender_player_id,content) VALUES (1,1,$1,42,$2)`, cityID, env("HARNESS_NAME", "bg-chat"))
	case "isolated":
		_, err = tx.Exec(ctx, `INSERT INTO harness_isolated_catalog (note) VALUES ($1)`, env("HARNESS_NAME", "isolated-audit"))
	}
	must(err)
	if mode == "hold" {
		_, err = tx.Exec(ctx, `SELECT slot FROM harness_bg_hold WHERE slot=1 FOR UPDATE`); must(err)
		fmt.Println("WORKER_HOLDING")
	}
	if entry == "isolated" {
		if mode == "hold" {
			time.Sleep(time.Duration(holdSec) * time.Second)
			fmt.Println("BG_HOLD_END WORKER_DONE"); return
		}
		must(tx.Commit(ctx))
		fmt.Println("BG_COMMITTED entry=isolated WORKER_DONE"); return
	}
	name := env("HARNESS_NAME", "bg-city")
	if mode == "hold" { _, _ = tx.Exec(ctx, `SAVEPOINT bg_bundle`) }
	if capital {
		_, err = tx.Exec(ctx, `UPDATE harness_bg_allocator_highwater SET highwater = highwater - 1000 WHERE single_row`)
		if err != nil { fail(tx, mode, holdSec, err); return }
		_, err = tx.Exec(ctx, `DELETE FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
		if err != nil { fail(tx, mode, holdSec, err); return }
	}
	_, err = tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold) VALUES (1,42,1,1,1,1,1) ON CONFLICT (server_id,player_id) DO UPDATE SET food=player_wallet.food+1`); must(err)
	_, err = tx.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (1,$1,42,$2,$3,$4,$5,1,100)`, cityID, name, x, y, capital)
	if err != nil { fail(tx, mode, holdSec, err); return }
	if mode == "hold" {
		_, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT bg_bundle`)
		time.Sleep(time.Duration(holdSec) * time.Second)
		fmt.Println("BG_HOLD_END WORKER_DONE"); return
	}
	must(tx.Commit(ctx))
	fmt.Printf("BG_COMMITTED city_id=%d entry=%s WORKER_DONE\n", cityID, entry)
}

func fail(tx pgx.Tx, mode string, holdSec int, err error) {
	if mode == "hold" { _, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT bg_bundle`) }
	fmt.Println("BG_ERR:", err)
	if mode == "hold" { time.Sleep(time.Duration(holdSec) * time.Second) }
	fmt.Println("WORKER_DONE")
}
