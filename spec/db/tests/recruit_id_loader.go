// SPEC-RECRUIT-ID: run from repo root against an explicitly disposable test DB.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func must(err error) {
	if err != nil {
		panic(err)
	}
}

func main() {
	ctx := context.Background()
	dsn := os.Getenv("RECRUIT_ID_TEST_DSN")
	if dsn == "" {
		panic("RECRUIT_ID_TEST_DSN must name a disposable DB")
	}
	admin, err := pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	schema := fmt.Sprintf("recruit_id_loader_%x", time.Now().UnixNano())
	_, err = admin.Exec(ctx, "CREATE SCHEMA "+schema)
	must(err)
	defer func() { _, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); must(err) }()
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	defer pool.Close()
	must(db.ApplySpecs(ctx, pool, "spec/db"))
	_, err = pool.Exec(ctx, "SELECT setval('player_hero_id_seq',7000,true); DELETE FROM schema_migrations WHERE name='m4_005_hero_id_sequence.sql'")
	must(err)
	must(db.ApplySpecs(ctx, pool, "spec/db"))
	var id int64
	must(pool.QueryRow(ctx, "SELECT nextval('player_hero_id_seq')").Scan(&id))
	if id != 7001 {
		panic(fmt.Sprintf("replay lowered sequence: %d", id))
	}
	must(db.ApplySpecs(ctx, pool, "spec/db"))
	must(pool.QueryRow(ctx, "SELECT nextval('player_hero_id_seq')").Scan(&id))
	if id != 7002 {
		panic(fmt.Sprintf("ledger replay changed sequence: %d", id))
	}
	fmt.Println("PASS actual ApplySpecs ordered migration, missing-ledger replay, normal second boot")
}
