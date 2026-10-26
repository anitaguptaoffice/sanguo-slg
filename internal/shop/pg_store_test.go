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

func TestPurchaseParticipantLimitWithPGStore(t *testing.T) {
	pool := openShopTestDB(t)
	ctx := context.Background()
	applyShopSchema(t, pool)

	daily := int32(2)
	stock := int32(10)
	shopCat := Catalog{Version: 1, Offers: []CatalogEntry{{
		OfferID: 7001, ShelfID: 1, ItemCfgID: 2001, QuantityPerPurchase: 1,
		Price:      content.RewardPackage{Resources: map[string]int64{"gold": 1}},
		DailyLimit: &daily, ServerStockLimit: &stock,
	}}}
	p := content.PlayerRef{ServerID: 1, PlayerID: 55}
	svc := NewService(shopCat, nil, nil, pool)
	now := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }
	for i := 0; i < 2; i++ {
		if _, err := commitShopParticipant(t, svc, p, 7001, 1); err != nil {
			t.Fatalf("buy %d: %v", i, err)
		}
	}
	pool.Close()
	pool = openShopTestDB(t)
	svc2 := NewService(shopCat, nil, nil, pool)
	svc2.now = svc.now
	if _, err := commitShopParticipant(t, svc2, p, 7001, 1); err != ErrPurchaseLimitExceeded {
		t.Fatalf("expected limit, got %v", err)
	}
	checkShopParticipantRows(t, svc2, p, 2, 2, 2, now)
	if rem, err := svc2.store.StockRemaining(ctx, 1, 7001, stock); err != nil || rem != 8 {
		t.Fatalf("stock=%d err=%v", rem, err)
	}
}

// This harness owns a transaction and a synthetic wallet mutex, but performs no
// payment/grant. It proves only durable SHOP counter/ledger/calendar behavior.
func commitShopParticipant(t *testing.T, svc *Service, actor content.PlayerRef, offer, count int32) (Offer, error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	store := svc.store.(*PGStore)
	tx, err := store.Pool.Begin(ctx)
	if err != nil {
		return Offer{}, err
	}
	defer tx.Rollback(context.Background())
	plan, _, err := stagePurchase(ctx, tx, svc, store, actor, offer, count)
	if err != nil {
		return Offer{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Offer{}, err
	}
	return plan.Offer(), nil
}

func checkShopParticipantRows(t *testing.T, svc *Service, actor content.PlayerRef, rows, total, daily int32, at time.Time) {
	t.Helper()
	pool := svc.store.(*PGStore).Pool
	var gotRows, gotTotal, gotDaily int32
	var period string
	err := pool.QueryRow(context.Background(), `SELECT count(*) FROM player_shop_purchase WHERE server_id=$1 AND player_id=$2`, actor.ServerID, actor.PlayerID).Scan(&gotRows)
	if err != nil || gotRows != rows {
		t.Fatalf("ledger rows=%d want=%d err=%v", gotRows, rows, err)
	}
	err = pool.QueryRow(context.Background(), `SELECT total_bought,daily_bought,daily_period::text FROM player_shop_offer_counter WHERE server_id=$1 AND player_id=$2`, actor.ServerID, actor.PlayerID).Scan(&gotTotal, &gotDaily, &period)
	if err != nil || gotTotal != total || gotDaily != daily || period != at.Format("2006-01-02") {
		t.Fatalf("counter=%d/%d/%s want=%d/%d/%s err=%v", gotTotal, gotDaily, period, total, daily, at.Format("2006-01-02"), err)
	}
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
	t.Cleanup(pool.Close)
	return pool
}

func applyShopSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	specDir := filepath.Join("..", "..", "spec", "db")
	if err := db.ApplySpecs(context.Background(), pool, specDir); err != nil {
		t.Fatal(err)
	}
}
