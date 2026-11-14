package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
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
	holdSec, _ := strconv.Atoi(env("HARNESS_HOLD_SEC", "120"))
	capital := env("HARNESS_IS_CAPITAL", "1") == "1"
	cfg, err := pgxpool.ParseConfig(dsn); must(err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg); must(err)
	defer pool.Close()
	fmt.Println("DOM_CHAIN_ENTRY: internal/domestic/city_atomic.go:CreateNewCity -> pg_store.go:saveCityWithWorld")
	h := domestic.NewHub(func() time.Time { return time.Unix(1700000000, 0) })
	h.UseStore(domestic.NewPGStore(pool), 1, 0)
	initial := &domestic.CityState{PlayerID: 42, Wallet: domestic.Resources{Food: 8000, Wood: 8000, Stone: 5000, Iron: 5000},
		Buildings: map[string]*domestic.BuildingInstance{"hall": {CfgID: 1, Level: 1}, "farm": {CfgID: 2, Level: 1}}}
	participant := func(ctx context.Context, tx pgx.Tx) (int64, error) {
		if _, err := tx.Exec(ctx, `SELECT set_config('harness.dom_api_chain','1',true)`); err != nil { return 0, err }
		if mode == "hold" {
			if _, err = tx.Exec(ctx, `SELECT slot FROM harness_dom_chain_hold WHERE slot=1 FOR UPDATE`); err != nil { return 0, err }
			fmt.Println("WORKER_HOLDING")
		}
		wc := world.City{ServerID: 1, PlayerID: 42, Name: env("HARNESS_NAME", "dom-city"), X: x, Y: y,
			IsCapital: capital, WallLevel: 1, Morale: 100}
		var staged world.City
		var werr error
		if mode == "hold" {
			_, _ = tx.Exec(ctx, `SAVEPOINT dom_chain_world`)
		}
		staged, werr = world.NewPGStore(nil).CreateCityInTx(ctx, tx, wc)
		if mode == "hold" && werr != nil {
			_, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT dom_chain_world`)
		} else if mode == "hold" && werr == nil {
			_, _ = tx.Exec(ctx, `RELEASE SAVEPOINT dom_chain_world`)
		}
		if mode == "hold" {
			if werr != nil { fmt.Println("DOM_CHAIN_WORLD_ERR:", werr) } else { fmt.Printf("STAGED_CITY_ID=%d\n", staged.CityID) }
			time.Sleep(time.Duration(holdSec) * time.Second)
			return 0, fmt.Errorf("harness hold abort")
		}
		if werr != nil { fmt.Println("DOM_CHAIN_WORLD_ERR:", werr); return 0, werr }
		return staged.CityID, nil
	}
	id, err := h.CreateNewCity(ctx, 1, initial, participant)
	if mode == "hold" { fmt.Println("DOM_CHAIN_HOLD_END") } else if err != nil { fmt.Println("DOM_CHAIN_ERR:", err) } else { fmt.Printf("DOM_CHAIN_COMMITTED city_id=%d\n", id) }
	fmt.Println("WORKER_DONE")
}
