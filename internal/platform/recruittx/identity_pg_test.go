package recruittx

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RECRUIT_TX_TEST_DSN must refer only to a newly owned disposable PG17 fixture.
func TestPostgresTransactionIdentity(t *testing.T) {
	dsn := os.Getenv("RECRUIT_TX_TEST_DSN")
	if dsn == "" {
		t.Skip("isolated PostgreSQL test DSN not supplied")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 2
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var version int
	check(t, pool.QueryRow(ctx, "SELECT current_setting('server_version_num')::int").Scan(&version) == nil && version/10000 == 17, "PG17 required")
	b, err := NewBinding(pool)
	check(t, err == nil, "binding")
	first, err := b.Begin(ctx)
	check(t, err == nil, "first Begin")
	defer func() { _ = rollback(first) }()
	second, err := b.Begin(ctx)
	check(t, err == nil, "second Begin")
	defer func() { _ = rollback(second) }()
	a := first.Access()
	snapshot := *a
	check(t, snapshot.CheckSameTransaction(ctx, b, first.Access()) == nil, "same owner alias")
	check(t, snapshot.CheckSameTransaction(ctx, b, second.Access()) != nil, "different live tx accepted")
	*a = *second.Access()
	check(t, snapshot.CheckSameTransaction(ctx, b, a) != nil, "overwrite accepted")
	wrong, _ := NewBinding(pool)
	check(t, snapshot.CheckSameTransaction(ctx, wrong, first.Access()) != nil, "same pool different binding")
	check(t, first.Commit(ctx) == nil, "first end")
	check(t, snapshot.CheckSameTransaction(ctx, b, first.Access()) != nil, "ended original")
	check(t, second.Access().CheckSameTransaction(ctx, b, a) == nil, "unrelated owner affected")
	check(t, rollback(second) == nil, "second rollback")
	check(t, a.CheckSameTransaction(ctx, b, second.Access()) != nil, "ended second")
}
