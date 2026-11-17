package hero

import (
	"context"
	"os"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/jackc/pgx/v5/pgxpool"
)

func openHeroTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pgfixture.SkipFullSpecUnderShort(t)
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	return pool
}

func applyHeroSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	if pgfixture.ReuseEnabled() {
		return
	}
	specDir, err := pgfixture.SpecDir()
	if err != nil {
		t.Fatal(err)
	}
	if err := db.ApplySpecs(context.Background(), pool, specDir); err != nil {
		t.Fatal(err)
	}
}