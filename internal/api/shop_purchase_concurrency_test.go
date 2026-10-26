package api

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func shopSecondPool(t *testing.T, pool *pgxpool.Pool) *pgxpool.Pool {
	t.Helper()
	other, err := pgxpool.NewWithConfig(context.Background(), pool.Config().Copy())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(other.Close)
	return other
}

func TestShopAtomicPGIndependentInstancesDailyCap(t *testing.T) {
	pool, s := atomicShopFixture(t)
	other := recruitServer(t, shopSecondPool(t, pool), 7)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	gate := make(chan struct{})
	results := make(chan error, 24)
	var workers sync.WaitGroup
	for i := 0; i < 24; i++ {
		workers.Add(1)
		go func(i int) {
			defer workers.Done()
			<-gate
			server := s
			if i%2 == 1 {
				server = other
			}
			_, err := server.purchaseShopAtomic(ctx, PlayerContext{ServerID: 1, PlayerID: 7}, 1001, 1)
			results <- err
		}(i)
	}
	close(gate)
	workers.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		} else if !errors.Is(err, shop.ErrPurchaseLimitExceeded) {
			t.Fatalf("unexpected %v", err)
		}
	}
	var ledger, receipts, count, qty int
	var gold int64
	err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_shop_purchase),(SELECT count(*) FROM reward_grant_queue),
 (SELECT daily_bought FROM player_shop_offer_counter),(SELECT quantity FROM player_item WHERE item_cfg_id=2001),gold FROM player_wallet`).Scan(&ledger, &receipts, &count, &qty, &gold)
	if err != nil || success != 3 || ledger != 3 || receipts != 3 || count != 3 || qty != 3 || gold != 470 {
		t.Fatalf("cap success%d ledger%d receipt%d count%d qty%d gold%d err%v", success, ledger, receipts, count, qty, gold, err)
	}
}

func TestShopAtomicPGIndependentPlayersLastStock(t *testing.T) {
	pool, s := atomicShopFixture(t)
	other := recruitServer(t, shopSecondPool(t, pool), 7)
	for id := int64(8); id < 19; id++ {
		seedRecruitActor(t, pool, id, hero.Resources{Gold: 500}, 2)
	}
	stock := int32(3)
	cat := shop.Catalog{Offers: []shop.CatalogEntry{{OfferID: 9001, ShelfID: 1, ItemCfgID: 2001, QuantityPerPurchase: 1, ServerStockLimit: &stock, Price: content.RewardPackage{Resources: map[string]int64{"gold": 10}}}}}
	atomicShopCatalog(s, cat)
	atomicShopCatalog(other, cat)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	results := make(chan error, 12)
	gate := make(chan struct{})
	var workers sync.WaitGroup
	for id := int64(7); id < 19; id++ {
		workers.Add(1)
		go func(id int64) {
			defer workers.Done()
			<-gate
			server := s
			if id%2 == 0 {
				server = other
			}
			_, err := server.purchaseShopAtomic(ctx, PlayerContext{ServerID: 1, PlayerID: id}, 9001, 1)
			results <- err
		}(id)
	}
	close(gate)
	workers.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		} else if !errors.Is(err, shop.ErrSoldOut) {
			t.Fatalf("unexpected %v", err)
		}
	}
	var ledger, receipt, qty int
	var gold int64
	err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_shop_purchase),(SELECT count(*) FROM reward_grant_queue),
 (SELECT COALESCE(sum(quantity),0) FROM player_item WHERE item_cfg_id=2001),(SELECT sum(gold) FROM player_wallet)`).Scan(&ledger, &receipt, &qty, &gold)
	if err != nil || success != 3 || ledger != 3 || receipt != 3 || qty != 3 || gold != 5970 {
		t.Fatalf("stock %d %d %d %d %d %v", success, ledger, receipt, qty, gold, err)
	}
}

func TestShopAtomicPGWalletWaitCancellation(t *testing.T) {
	pool, s := atomicShopFixture(t)
	before := shopAtomicState(t, pool)
	tx, err := pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, context.Background())
	if _, err = lockShopWallet(context.Background(), tx, PlayerContext{ServerID: 1, PlayerID: 7}); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	if _, err = s.purchaseShopAtomic(ctx, PlayerContext{ServerID: 1, PlayerID: 7}, 1001, 1); err == nil {
		t.Fatal("locked wallet unexpectedly purchased")
	}
	if err = tx.Rollback(context.Background()); err != nil {
		t.Fatal(err)
	}
	if shopAtomicState(t, pool) != before {
		t.Fatal("wait cancellation changed state")
	}
}

func TestShopAtomicPGDifferentOffersShareItemsAndAllocator(t *testing.T) {
	pool, s := atomicShopFixture(t)
	other := recruitServer(t, shopSecondPool(t, pool), 7)
	cat := shop.Catalog{Offers: []shop.CatalogEntry{
		{OfferID: 9001, ShelfID: 1, ItemCfgID: 2001, QuantityPerPurchase: 1, Price: content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2004, Qty: 1}}}},
		{OfferID: 9002, ShelfID: 1, ItemCfgID: 2002, QuantityPerPurchase: 1, Price: content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2004, Qty: 1}}}},
	}}
	atomicShopCatalog(s, cat)
	atomicShopCatalog(other, cat)
	results := make(chan error, 12)
	gate := make(chan struct{})
	var workers sync.WaitGroup
	for i := 0; i < 12; i++ {
		workers.Add(1)
		go func(i int) {
			defer workers.Done()
			<-gate
			server := s
			offer := int32(9001)
			if i%2 == 1 {
				server = other
				offer = 9002
			}
			_, err := server.purchaseShopAtomic(context.Background(), PlayerContext{ServerID: 1, PlayerID: 7}, offer, 1)
			results <- err
		}(i)
	}
	close(gate)
	workers.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		} else if !errors.Is(err, shop.ErrInsufficientItems) {
			t.Fatalf("unexpected %v", err)
		}
	}
	var bought, books, qty, receipts int
	err := pool.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM player_shop_purchase),(SELECT quantity FROM player_item WHERE item_cfg_id=2004),
 (SELECT COALESCE(sum(quantity),0) FROM player_item WHERE item_cfg_id IN(2001,2002)),(SELECT count(*) FROM reward_grant_queue)`).Scan(&bought, &books, &qty, &receipts)
	if err != nil || success != 2 || bought != 2 || books != 0 || qty != 2 || receipts != 2 {
		t.Fatalf("shared items %d %d %d %d %d %v", success, bought, books, qty, receipts, err)
	}
}

func TestShopAtomicPGProvenanceBeforeBegin(t *testing.T) {
	_, s := atomicShopFixture(t)
	calls := 0
	s.shopPurchase.begin = func(context.Context, pgx.TxOptions) (pgx.Tx, error) {
		calls++
		return nil, errors.New("must not begin")
	}
	s.contentSvc.UseStore(content.NewPGStore(nil))
	if _, err := s.purchaseShopAtomic(context.Background(), PlayerContext{ServerID: 1, PlayerID: 7}, 1001, 1); !errors.Is(err, errShopBinding) || calls != 0 {
		t.Fatalf("provenance err%v begin%d", err, calls)
	}
}
