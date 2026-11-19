package content

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGStoreGrantSurvivesRestart(t *testing.T) {
	pgfixture.SkipFullSpecUnderShort(t)
	pool := pgfixture.WarmPool(t)
	ctx := context.Background()
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
