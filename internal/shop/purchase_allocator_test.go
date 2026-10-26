package shop

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func TestPurchaseAllocatorCompatibleConcurrentWriters(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	other := openShopTestDB(t)
	ctx := context.Background()
	const server = int32(93)
	if _, err := pool.Exec(ctx, `INSERT INTO player_shop_purchase(server_id,purchase_id,player_id,offer_cfg_id,quantity) VALUES($1,1000000000000,1,999,1)`, server); err != nil {
		t.Fatal(err)
	}
	const n = 24
	errs := make(chan error, n)
	for i := 0; i < n; i++ {
		go func(i int) {
			p := pool
			if i%2 == 0 {
				p = other
			}
			offer := int32(1100 + i)
			if i%3 == 0 {
				errs <- NewPGStore(p).TakeStock(ctx, server, int64(i+1), offer, -1, 1)
				return
			}
			cat := intentCatalog()
			cat.Offers[0].OfferID = offer
			svc, store := purchaseTestService(p, cat, time.Now())
			tx, err := p.Begin(ctx)
			if err != nil {
				errs <- err
				return
			}
			defer func(rollback func(context.Context) error, ctx context.Context) {
				_ = rollback(ctx)
			}(tx.Rollback, ctx)
			_, _, err = stagePurchase(ctx, tx, svc, store, content.PlayerRef{ServerID: server, PlayerID: int64(i + 1)}, offer, 1)
			if err == nil {
				err = tx.Commit(ctx)
			}
			errs <- err
		}(i)
	}
	for i := 0; i < n; i++ {
		if err := <-errs; err != nil {
			t.Fatal(err)
		}
	}
	var count int
	var low, high int64
	if err := pool.QueryRow(ctx, `SELECT count(*),min(purchase_id),max(purchase_id) FROM player_shop_purchase WHERE server_id=$1`, server).Scan(&count, &low, &high); err != nil || count != n+1 || low != 1000000000000 || high != low+n {
		t.Fatalf("count=%d range=%d..%d err=%v", count, low, high, err)
	}
}
func TestPurchaseAllocatorExhaustionAndCancellation(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	ctx := context.Background()
	store := NewPGStore(pool)
	if _, err := pool.Exec(ctx, `INSERT INTO player_shop_purchase(server_id,purchase_id,player_id,offer_cfg_id,quantity) VALUES(94,$1,1,999,1)`, int64(math.MaxInt64)); err != nil {
		t.Fatal(err)
	}
	if err := store.TakeStock(ctx, 94, 1, 1001, -1, 1); !errors.Is(err, ErrPurchaseOverflow) {
		t.Fatalf("exhaustion=%v", err)
	}
	blocker, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(blocker.Rollback, ctx)
	if _, err = blocker.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer,$2::integer)`, purchaseAllocatorNamespace, int32(95)); err != nil {
		t.Fatal(err)
	}
	timed, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()
	if err = store.TakeStock(timed, 95, 1, 1001, -1, 1); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("allocator wait=%v", err)
	}
	// A different shard must not wait on the blocked allocator.
	if err = store.TakeStock(ctx, 96, 1, 1001, -1, 1); err != nil {
		t.Fatal(err)
	}
	var n int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM player_shop_purchase WHERE server_id=95`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("canceled rows=%d err=%v", n, err)
	}
	if err = blocker.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if err = store.TakeStock(ctx, 95, 1, 1001, -1, 1); err != nil {
		t.Fatal(err)
	}
}
func TestPGStockWideSumAndInvalidTake(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	ctx := context.Background()
	store := NewPGStore(pool)
	if _, err := pool.Exec(ctx, `INSERT INTO player_shop_purchase(server_id,purchase_id,player_id,offer_cfg_id,quantity) VALUES(97,1,1,1001,$1),(97,2,1,1001,$1)`, int32(math.MaxInt32)); err != nil {
		t.Fatal(err)
	}
	if rem, err := store.StockRemaining(ctx, 97, 1001, 3); err != nil || rem != 0 {
		t.Fatalf("wide remaining=%d err=%v", rem, err)
	}
	if err := store.TakeStock(ctx, 97, 1, 1001, 3, 1); !errors.Is(err, ErrSoldOut) {
		t.Fatal(err)
	}
	if err := store.TakeStock(ctx, 97, 1, 1002, -1, 0); !errors.Is(err, ErrInvalidPurchaseCount) {
		t.Fatal(err)
	}
	if err := store.TakeStock(ctx, -1, 1, 1002, -1, 1); !errors.Is(err, ErrInvalidPurchase) {
		t.Fatal(err)
	}
}
