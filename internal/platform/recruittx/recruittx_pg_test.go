package recruittx

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Only a newly owned disposable PG17 instance; no application or production DSN.
func TestPostgresAtomicLifetime(t *testing.T) {
	dsn := os.Getenv("RECRUIT_TX_TEST_DSN")
	if dsn == "" {
		t.Skip("isolated PostgreSQL test DSN not supplied")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(dsn)
	check(t, err == nil, fmt.Sprint(err))
	cfg.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	check(t, err == nil, fmt.Sprint(err))
	defer pool.Close()
	var version int
	err = pool.QueryRow(ctx, "SELECT current_setting('server_version_num')::int").Scan(&version)
	check(t, err == nil, fmt.Sprint(err))
	check(t, version/10000 == 17, "PG17 required")
	_, err = pool.Exec(ctx, "CREATE TEMP TABLE recruit_tx_lifetime(id integer PRIMARY KEY)")
	check(t, err == nil, fmt.Sprint(err))
	b, _ := NewBinding(pool)
	wrong, _ := NewBinding(pool)
	o, err := b.Begin(ctx)
	check(t, err == nil, fmt.Sprint(err))
	defer rollback(o)
	a := o.Access()
	var first, second int64
	check(t, a.Scan(ctx, b, "SELECT txid_current()", nil, &first) == nil, "first identity")
	_, err = a.Exec(ctx, wrong, "INSERT INTO recruit_tx_lifetime VALUES(99)")
	check(t, err != nil, "wrong binding")
	for _, id := range []int{1, 2} {
		_, err = a.Exec(ctx, b, "INSERT INTO recruit_tx_lifetime VALUES($1)", id)
		check(t, err == nil, fmt.Sprint(err))
	}
	check(t, a.Scan(ctx, b, "SELECT txid_current()", nil, &second) == nil && first == second, "different transaction")
	check(t, o.Commit(ctx) == nil, "commit failed")
	_, err = a.Exec(ctx, b, "INSERT INTO recruit_tx_lifetime VALUES(99)")
	check(t, err != nil, "post-end write")
	o, err = b.Begin(ctx)
	check(t, err == nil, fmt.Sprint(err))
	defer rollback(o)
	_, err = o.Access().Exec(ctx, b, "INSERT INTO recruit_tx_lifetime VALUES(3)")
	check(t, err == nil, fmt.Sprint(err))
	check(t, o.Rollback(ctx) == nil, "rollback failed")
	var count, sum int
	err = pool.QueryRow(ctx, "SELECT count(*),sum(id) FROM recruit_tx_lifetime").Scan(&count, &sum)
	check(t, err == nil, fmt.Sprint(err))
	check(t, count == 2 && sum == 3, "non-atomic effects")
}
