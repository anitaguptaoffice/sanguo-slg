package domestic

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/jackc/pgx/v5/pgxpool"
)

func openDomesticTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	skipDomesticPGUnderShort(t)
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Open(ctx, url)
	if err != nil {
		t.Fatalf("db: %v", err)
	}
	return pool
}

func applyDomesticSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	var schema string
	if err := pool.QueryRow(context.Background(), "SELECT current_schema()").Scan(&schema); err != nil {
		t.Fatal(err)
	}
	if schema == pgfixture.DefaultWarmSchema {
		return
	}
	for _, name := range []string{"001_account.sql", "002_world.sql", "003_domestic.sql", "007_domestic_production_checkpoint.sql", "m4_008_work_queue_id_sequence.sql"} {
		specDir, err := pgfixture.SpecDir()
		if err != nil {
			t.Fatal(err)
		}
		sql, err := os.ReadFile(filepath.Join(specDir, name))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(context.Background(), string(sql)); err != nil {
			t.Fatal(err)
		}
	}
}

func skipDomesticPGUnderShort(t *testing.T) {
	t.Helper()
	if testing.Short() {
		t.Skip("domestic PostgreSQL skipped under -short")
	}
}

func domesticWorkPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	skipDomesticPGUnderShort(t)
	if pgfixture.ReuseEnabled() {
		return pgfixture.WarmPool(t)
	}
	return openDomesticTestDB(t)
}