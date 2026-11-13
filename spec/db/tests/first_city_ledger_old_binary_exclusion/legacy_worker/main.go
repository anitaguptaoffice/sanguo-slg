package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
)

var ctx = context.Background()

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func main() {
	dsn, schema, mode := os.Getenv("HARNESS_DSN"), os.Getenv("HARNESS_SCHEMA"), os.Getenv("HARNESS_MODE")
	if dsn == "" || schema == "" || mode == "" {
		fmt.Fprintln(os.Stderr, "HARNESS_DSN, HARNESS_SCHEMA, HARNESS_MODE required")
		os.Exit(2)
	}
	if mode != "hold" && mode != "commit" && mode != "rollback_prior" {
		fmt.Fprintln(os.Stderr, "unknown HARNESS_MODE", mode)
		os.Exit(2)
	}
	x, _ := strconv.Atoi(env("HARNESS_X", "41"))
	y, _ := strconv.Atoi(env("HARNESS_Y", "42"))
	holdSec, _ := strconv.Atoi(env("HARNESS_HOLD_SEC", "120"))
	capital := env("HARNESS_IS_CAPITAL", "1") == "1"

	conn, err := pgx.Connect(ctx, dsn)
	must(err)
	defer func() { _ = conn.Close(ctx) }()
	_, err = conn.Exec(ctx, "SET search_path TO "+schema)
	must(err)
	tx, err := conn.Begin(ctx)
	must(err)
	if mode == "hold" {
		_, err = tx.Exec(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE`)
		must(err)
	}
	_, err = tx.Exec(ctx, `SELECT set_config('harness.legacy_writer','1',true)`)
	must(err)
	_, err = tx.Exec(ctx, `SAVEPOINT legacy_create`)
	must(err)
	city := world.City{ServerID: 1, PlayerID: 42, Name: env("HARNESS_NAME", "legacy-city"), X: x, Y: y, IsCapital: capital, WallLevel: 1, Morale: 100}
	got, createErr := world.NewPGStore(nil).CreateCityInTx(ctx, tx, city)
	if createErr != nil {
		_, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT legacy_create`)
	} else {
		_, _ = tx.Exec(ctx, `RELEASE SAVEPOINT legacy_create`)
	}

	switch mode {
	case "hold":
		fmt.Println("WORKER_HOLDING")
		if createErr != nil {
			fmt.Println("LEGACY_CREATE_ERR:", createErr.Error())
		} else {
			fmt.Printf("STAGED_CITY_ID=%d\n", got.CityID)
		}
		time.Sleep(time.Duration(holdSec) * time.Second)
		must(tx.Rollback(ctx))
	case "commit", "rollback_prior":
		tag := "LEGACY"
		if mode == "rollback_prior" {
			tag = "ROLLBACK_PRIOR"
		}
		if createErr != nil {
			fmt.Println(tag+"_CREATE_ERR:", createErr.Error())
			must(tx.Rollback(ctx))
		} else if err = tx.Commit(ctx); err != nil {
			fmt.Println(tag+"_COMMIT_ERR:", err.Error())
			must(tx.Rollback(ctx))
		} else {
			fmt.Printf("%s_COMMITTED city_id=%d\n", tag, got.CityID)
		}
	}
	fmt.Println("WORKER_DONE")
}
