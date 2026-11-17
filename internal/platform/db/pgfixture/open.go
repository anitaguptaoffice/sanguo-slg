package pgfixture

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OpenFullSpecDB returns a full-spec pool: warm shared schema by default, or a
// disposable schema when SANGUO_PG_REUSE_SPEC=0.
func OpenFullSpecDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	SkipFullSpecUnderShort(t)
	if ReuseEnabled() {
		return WarmPool(t)
	}
	return openDisposableFullSpec(t, "spec_test")
}

func openDisposableFullSpec(t *testing.T, prefix string) *pgxpool.Pool {
	t.Helper()
	url := osGetenvDatabaseURL(t)
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",pg_catalog"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		admin.Close()
		t.Fatal(err)
	}
	specDir, err := SpecDir()
	if err != nil {
		pool.Close()
		admin.Close()
		t.Fatal(err)
	}
	if err := db.ApplySpecs(ctx, pool, specDir); err != nil {
		pool.Close()
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
		admin.Close()
	})
	return pool
}

func osGetenvDatabaseURL(t *testing.T) string {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	return url
}