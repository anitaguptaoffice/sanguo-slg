// SPEC-QUEUE-ID-VERIFY: actual ApplySpecs, explicit disposable PG only.
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
	dsn := os.Getenv("QUEUE_ID_TEST_DSN")
	if dsn == "" {
		panic("QUEUE_ID_TEST_DSN must name a disposable DB")
	}
	admin, err := pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	schema := fmt.Sprintf("queue_id_loader_%x", time.Now().UnixNano())
	_, err = admin.Exec(ctx, "CREATE SCHEMA "+schema)
	must(err)
	defer func() { _, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); must(err) }()
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["sanguo.queue_id_retained_highwater"] = "7000"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	defer func() { pool.Close() }()
	must(db.ApplySpecs(ctx, pool, "spec/db"))
	var oid, original uint32
	var id int64
	must(pool.QueryRow(ctx, "SELECT 'work_queue_id_seq'::regclass::oid").Scan(&original))
	check := func(want int64) {
		must(pool.QueryRow(ctx, "SELECT nextval('work_queue_id_seq'), 'work_queue_id_seq'::regclass::oid").Scan(&id, &oid))
		if id != want || oid != original {
			panic(fmt.Sprintf("allocator changed: ID=%d want=%d OID=%d original=%d", id, want, oid, original))
		}
	}
	check(7001)
	_, err = pool.Exec(ctx, "DELETE FROM schema_migrations WHERE name='m4_008_work_queue_id_sequence.sql'")
	must(err)
	must(db.ApplySpecs(ctx, pool, "spec/db"))
	check(7002)
	pool.Close()
	pool, err = pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	must(db.ApplySpecs(ctx, pool, "spec/db"))
	check(7003)
	var count int
	must(pool.QueryRow(ctx, "SELECT count(*) FROM work_queue").Scan(&count))
	if count != 0 {
		panic("loader unexpectedly changed queue rows")
	}
	fmt.Println("PASS actual ApplySpecs order; pool-wide retained highwater; missing-ledger replay; fresh pool/empty queue keeps sequence")
	defaultPublic(ctx, admin, dsn)
}
