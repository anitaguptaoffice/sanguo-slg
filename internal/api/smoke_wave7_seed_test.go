package api_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DATA-001 core subset SQL (spec/data/generated). Order respects cfg_item before shop offers.
var wave7SeedFiles = []string{
	"cfg_item.sql",
	"cfg_quest.sql",
	"cfg_shop.sql",
	"cfg_shop_shelf.sql",
	"cfg_shop_offer.sql",
	"cfg_hero_template.sql",
	"cfg_unit.sql",
}

func applyWave7CoreSubsetSeeds(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	root := filepath.Join(runtime.RepoRoot(), "spec", "data", "generated")
	for _, name := range wave7SeedFiles {
		body, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			t.Fatalf("read seed %s: %v", name, err)
		}
		if _, err := pool.Exec(ctx, string(body)); err != nil {
			t.Fatalf("apply seed %s: %v", name, err)
		}
	}
}
