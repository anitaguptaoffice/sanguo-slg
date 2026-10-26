// SPEC-HOTEL-CANDIDATE-ID: actual ApplySpecs against explicit disposable PG only.
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
	dsn := os.Getenv("HOTEL_CANDIDATE_ID_TEST_DSN")
	if dsn == "" {
		panic("HOTEL_CANDIDATE_ID_TEST_DSN must name a disposable DB")
	}
	admin, err := pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	schema := fmt.Sprintf("hotel_id_loader_%x", time.Now().UnixNano())
	_, err = admin.Exec(ctx, "CREATE SCHEMA "+schema)
	must(err)
	defer func() { _, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); must(err) }()
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["sanguo.hotel_candidate_id_reserved_highwater"] = "7000"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	defer pool.Close()
	must(db.ApplySpecs(ctx, pool, "spec/db"))
	var id int64
	must(pool.QueryRow(ctx, "SELECT nextval('city_hotel_candidate_id_seq')").Scan(&id))
	if id != 7001 {
		panic(fmt.Sprintf("reservation not applied: %d", id))
	}
	_, err = pool.Exec(ctx, "DELETE FROM schema_migrations WHERE name='m4_006_hotel_candidate_id_sequence.sql'")
	must(err)
	for i := int64(7002); i <= 7003; i++ {
		must(db.ApplySpecs(ctx, pool, "spec/db"))
		must(pool.QueryRow(ctx, "SELECT nextval('city_hotel_candidate_id_seq')").Scan(&id))
		if id != i {
			panic(fmt.Sprintf("replay changed sequence: got %d want %d", id, i))
		}
	}
	fmt.Println("PASS actual ApplySpecs ordering, pool-wide reservation, missing-ledger replay, second boot")
}
