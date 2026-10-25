package content

import (
	"context"
	"os"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGStoreGrantSurvivesRestart(t *testing.T) {
	pool := openContentTestDB(t)
	ctx := context.Background()
	applyContentSchema(t, pool)
	store := NewPGStore(pool)

	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	p := PlayerRef{ServerID: 1, PlayerID: 100}
	pkg := RewardPackage{
		Resources: map[string]int64{"food": 500},
		Items:     []RewardItem{{ItemCfgID: 2001, Qty: 3}},
	}
	key := "quest:100:1:claim"

	svc1 := NewService(cat)
	svc1.UseStore(store)
	if _, err := svc1.Grant(p, pkg, key); err != nil {
		t.Fatal(err)
	}

	svc2 := NewService(cat)
	svc2.UseStore(store)
	if err := svc2.LoadPlayer(ctx, p); err != nil {
		t.Fatal(err)
	}
	qty, err := svc2.Get(p, 2001)
	if err != nil || qty != 3 {
		t.Fatalf("item qty after reload: %d err=%v", qty, err)
	}

	dup, err := svc2.Grant(p, pkg, key)
	if err != nil {
		t.Fatal(err)
	}
	if !dup.Duplicate {
		t.Fatal("expected duplicate after restart")
	}
	qty, _ = svc2.Get(p, 2001)
	if qty != 3 {
		t.Fatalf("duplicate must not double items: %d", qty)
	}
}

func openContentTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	pool, err := db.Open(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	return pool
}

func applyContentSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	if err := db.ApplySpecs(context.Background(), pool, "../../spec/db"); err != nil {
		t.Fatal(err)
	}
}
