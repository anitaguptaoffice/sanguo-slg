package shop

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGStorePurchaseLimitsSurviveRestart(t *testing.T) {
	pool := openShopTestDB(t)
	ctx := context.Background()
	applyShopSchema(t, pool)

	store1 := NewPGStore(pool)
	now := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	serverID := int32(3)
	playerID := int64(88)
	offerID := int32(5001)

	if err := store1.BumpCounter(ctx, serverID, playerID, offerID, 2, PurchaseLimitDaily, now); err != nil {
		t.Fatal(err)
	}

	store2 := NewPGStore(pool)
	n, err := store2.PurchasedCount(ctx, serverID, playerID, offerID, PurchaseLimitDaily, now)
	if err != nil || n != 2 {
		t.Fatalf("count=%d err=%v", n, err)
	}
}

func TestPGStoreServerStockSurviveRestart(t *testing.T) {
	pool := openShopTestDB(t)
	ctx := context.Background()
	applyShopSchema(t, pool)

	store1 := NewPGStore(pool)
	const total = int32(5)
	serverID := int32(2)
	playerID := int64(7)
	offerID := int32(9001)

	rem, err := store1.StockRemaining(ctx, serverID, offerID, total)
	if err != nil || rem != total {
		t.Fatalf("rem=%d err=%v", rem, err)
	}
	if err := store1.TakeStock(ctx, serverID, playerID, offerID, total, 2); err != nil {
		t.Fatal(err)
	}

	store2 := NewPGStore(pool)
	rem, err = store2.StockRemaining(ctx, serverID, offerID, total)
	if err != nil || rem != 3 {
		t.Fatalf("after restart rem=%d err=%v", rem, err)
	}
}

func TestServicePurchaseLimitWithPGStore(t *testing.T) {
	pool := openShopTestDB(t)
	ctx := context.Background()
	applyShopSchema(t, pool)

	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	daily := int32(2)
	stock := int32(10)
	shopCat := Catalog{Version: 1, Offers: []CatalogEntry{{
		OfferID: 7001, ShelfID: 1, ItemCfgID: 2001, QuantityPerPurchase: 1,
		Price: content.RewardPackage{Resources: map[string]int64{"gold": 1}},
		DailyLimit: &daily, ServerStockLimit: &stock,
	}}}
	wallet := &stubWallet{balances: make(map[content.PlayerRef]content.ResourceWallet)}
	p := content.PlayerRef{ServerID: 1, PlayerID: 55}
	wallet.seed(p, content.ResourceWallet{Gold: 100})
	svc := NewService(shopCat, nil, NewPayments(contentSvc, wallet), pool)
	for i := 0; i < 2; i++ {
		if _, _, _, err := svc.Purchase(1, 55, 7001, 1); err != nil {
			t.Fatalf("buy %d: %v", i, err)
		}
	}
	svc2 := NewService(shopCat, nil, NewPayments(contentSvc, wallet), pool)
	if _, _, _, err := svc2.Purchase(1, 55, 7001, 1); err != ErrPurchaseLimitExceeded {
		t.Fatalf("expected limit, got %v", err)
	}
	_ = ctx
}

func openShopTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
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

func applyShopSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	specDir := filepath.Join("spec", "db")
	if err := db.ApplySpecs(context.Background(), pool, specDir); err != nil {
		t.Fatal(err)
	}
}
