package pgfixture

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DefaultWarmSchema is the fixed schema used across packages when reuse is on.
const DefaultWarmSchema = "sanguo_api_fixture_v1"

// EnvReuseSpec disables warm reuse when set to "0".
const EnvReuseSpec = "SANGUO_PG_REUSE_SPEC"

const warmAdvisoryLockKey int64 = 8817717

// minRecordedMigrations: below this count we run ApplySpecs on warm schema.
const minRecordedMigrations = 12

var warmPerTest sync.Map // uintptr(*testing.T) -> *pgxpool.Pool

var warmFixture struct {
	once   sync.Once
	initOK bool
	initEr error
	pool   *pgxpool.Pool
	admin  *pgxpool.Pool
	mu     sync.Mutex
}

// ReuseEnabled reports whether tests should share DefaultWarmSchema (default true).
func ReuseEnabled() bool {
	return os.Getenv(EnvReuseSpec) != "0"
}

// SkipFullSpecUnderShort skips t when -short is set (full PostgreSQL DDL).
func SkipFullSpecUnderShort(t *testing.T) {
	t.Helper()
	if testing.Short() {
		t.Skip("full-spec PostgreSQL skipped under -short")
	}
}

func warmNeedsApply(ctx context.Context, pool *pgxpool.Pool) (bool, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*)::int FROM schema_migrations`).Scan(&n)
	if err != nil {
		return true, nil
	}
	return n < minRecordedMigrations, nil
}

func initWarmFixture() {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		warmFixture.initEr = fmt.Errorf("DATABASE_URL not set")
		return
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		warmFixture.initEr = err
		return
	}
	if _, err = admin.Exec(ctx, "CREATE SCHEMA IF NOT EXISTS "+DefaultWarmSchema); err != nil {
		admin.Close()
		warmFixture.initEr = err
		return
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		admin.Close()
		warmFixture.initEr = err
		return
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = DefaultWarmSchema + ",pg_catalog"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		admin.Close()
		warmFixture.initEr = err
		return
	}
	need, err := warmNeedsApply(ctx, pool)
	if err != nil {
		pool.Close()
		admin.Close()
		warmFixture.initEr = err
		return
	}
	if need {
		specDir, err := SpecDir()
		if err != nil {
			pool.Close()
			admin.Close()
			warmFixture.initEr = err
			return
		}
		if err := db.ApplySpecs(ctx, pool, specDir); err != nil {
			pool.Close()
			admin.Close()
			warmFixture.initEr = err
			return
		}
	}
	warmFixture.pool = pool
	warmFixture.admin = admin
	warmFixture.initOK = true
}

func resetWarmSchema(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `SELECT pg_advisory_lock($1)`, warmAdvisoryLockKey); err != nil {
		return err
	}
	defer pool.Exec(ctx, `SELECT pg_advisory_unlock($1)`, warmAdvisoryLockKey)
	_, err := pool.Exec(ctx, `DO $r$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind = 'r'
      AND c.relname <> 'schema_migrations'
  LOOP
    EXECUTE format('TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE', current_schema(), r.tablename);
  END LOOP;
END
$r$`)
	return err
}

// WarmPool returns the process-wide warm full-spec pool and TRUNCATEs data for t.
// Tests that share this schema must run with go test -p 1 for that package/binary.
func WarmPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	key := reflect.ValueOf(t).Pointer()
	if p, ok := warmPerTest.Load(key); ok {
		return p.(*pgxpool.Pool)
	}
	warmFixture.once.Do(initWarmFixture)
	if warmFixture.initEr != nil {
		if warmFixture.initEr.Error() == "DATABASE_URL not set" {
			t.Skip(warmFixture.initEr)
		}
		t.Fatal(warmFixture.initEr)
	}
	if !warmFixture.initOK {
		t.Fatal("pgfixture warm pool unavailable")
	}
	warmFixture.mu.Lock()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := resetWarmSchema(ctx, warmFixture.pool); err != nil {
		warmFixture.mu.Unlock()
		t.Fatal("pgfixture reset warm schema:", err)
	}
	warmPerTest.Store(key, warmFixture.pool)
	t.Cleanup(func() {
		warmPerTest.Delete(key)
		warmFixture.mu.Unlock()
	})
	return warmFixture.pool
}