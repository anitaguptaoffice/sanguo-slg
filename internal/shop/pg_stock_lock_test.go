package shop

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestPGStoreStockLockKeys(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	store := NewPGStore(pool)
	ctx := context.Background()
	const server, offer, total = int32(81), int32(1001), int32(5)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer, $2::integer)`, server, offer); err != nil {
		t.Fatal(err)
	}
	// The original (server, offer) keys must remain independent across servers.
	if err := store.TakeStock(ctx, server+1, 42, offer, total, 2); err != nil {
		t.Fatal(err)
	}
	blocked, cancel := context.WithTimeout(ctx, 200*time.Millisecond)
	defer cancel()
	if err := store.TakeStock(blocked, server, 42, offer, total, 2); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("same key must wait for transaction lock, got %v", err)
	}
	if rem, err := store.StockRemaining(ctx, server, offer, total); err != nil || rem != total {
		t.Fatalf("blocked take changed stock: rem=%d err=%v", rem, err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if err := store.TakeStock(ctx, server, 42, offer, total, 2); err != nil {
		t.Fatal(err)
	}
	if err := store.TakeStock(ctx, server, 42, offer, total, 4); !errors.Is(err, ErrSoldOut) {
		t.Fatalf("oversell err=%v", err)
	}
	pool.Close()
	store = NewPGStore(openShopTestDB(t))
	if rem, err := store.StockRemaining(ctx, server, offer, total); err != nil || rem != 3 {
		t.Fatalf("fresh-pool remaining=%d err=%v", rem, err)
	}
	var rows int
	if err := store.Pool.QueryRow(ctx, `SELECT count(*) FROM player_shop_purchase WHERE server_id=$1 AND offer_cfg_id=$2`, server, offer).Scan(&rows); err != nil || rows != 1 {
		t.Fatalf("purchase rows=%d err=%v", rows, err)
	}
}

func TestPGStoreTakeStockSerializesSameOffer(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	store := NewPGStore(pool)
	ctx := context.Background()
	const buyers, total = 8, int32(3)
	errs := make(chan error, buyers)
	for i := 0; i < buyers; i++ {
		go func(player int64) { errs <- store.TakeStock(ctx, 83, player, 1001, total, 1) }(int64(i + 1))
	}
	var bought, soldOut int32
	for i := 0; i < buyers; i++ {
		err := <-errs
		switch {
		case err == nil:
			bought++
		case errors.Is(err, ErrSoldOut):
			soldOut++
		default:
			t.Errorf("take stock: %v", err)
		}
	}
	if bought != total || soldOut != buyers-total {
		t.Fatalf("bought=%d soldOut=%d", bought, soldOut)
	}
	if rem, err := store.StockRemaining(ctx, 83, 1001, total); err != nil || rem != 0 {
		t.Fatalf("remaining=%d err=%v", rem, err)
	}
}
