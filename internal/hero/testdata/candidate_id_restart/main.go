// Disposable test only: run before/after an owned PostgreSQL restart. No production DSN.
package main

import (
	"context"
	"fmt"
	"os"
	"regexp"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func must(err error) {
	if err != nil {
		panic(err)
	}
}

func main() {
	ctx := context.Background()
	dsn, schema, phase := os.Getenv("HOTEL_CANDIDATE_ID_TEST_DSN"), os.Getenv("HOTEL_ID_PROBE_SCHEMA"), os.Getenv("HOTEL_ID_PROBE_PHASE")
	if dsn == "" || !regexp.MustCompile(`^hotel_candidate_probe_[a-z0-9]+$`).MatchString(schema) || (phase != "before" && phase != "after") {
		panic("explicit disposable DSN, unique hotel_candidate_probe_<suffix> schema and before/after phase required")
	}
	admin, err := pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	quoted := pgx.Identifier{schema}.Sanitize()
	if phase == "before" {
		_, err = admin.Exec(ctx, "CREATE SCHEMA "+quoted)
		must(err)
	} else {
		defer func() { _, err := admin.Exec(ctx, "DROP SCHEMA "+quoted+" CASCADE"); must(err) }()
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	defer pool.Close()
	if phase == "before" {
		must(db.ApplySpecs(ctx, pool, "spec/db"))
	}
	store := hero.NewPGHotelStore(pool)
	id, err := store.NextCandidateID(ctx, 1, 77)
	must(err)
	want := int64(1)
	if phase == "after" {
		want = 2
	}
	if id != want {
		panic(fmt.Sprintf("%s restart ID=%d want=%d", phase, id, want))
	}
	fmt.Printf("PASS actual PGHotelStore %s process/database restart: reserved ID=%d without persisting candidate\n", phase, id)
}
