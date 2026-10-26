package shop

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func TestPurchaseTxConcurrentCapsAndStock(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	other := openShopTestDB(t)
	at := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name                string
		server              int32
		daily, total, stock *int32
		players             bool
		wantErr             error
	}{
		{"daily", 101, ptr32(3), nil, nil, false, ErrPurchaseLimitExceeded},
		{"lifetime", 102, nil, ptr32(3), nil, false, ErrPurchaseLimitExceeded},
		{"finite", 103, nil, nil, ptr32(1), true, ErrSoldOut},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			cat := intentCatalog()
			e := &cat.Offers[0]
			e.DailyLimit = tt.daily
			e.TotalLimit = tt.total
			e.ServerStockLimit = tt.stock
			if !tt.players {
				if _, err := pool.Exec(ctx, `INSERT INTO player_shop_offer_counter(server_id,player_id,offer_cfg_id,total_bought,daily_bought,daily_period) VALUES($1,1,1001,2,2,'2026-03-15')`, tt.server); err != nil {
					t.Fatal(err)
				}
			}
			const n = 8
			errs := make(chan error, n)
			for i := 0; i < n; i++ {
				go func(i int) {
					p := pool
					if i%2 == 0 {
						p = other
					}
					svc, store := purchaseTestService(p, cat, at)
					tx, err := p.Begin(ctx)
					if err != nil {
						errs <- err
						return
					}
					defer func(rollback func(context.Context) error, ctx context.Context) {
						_ = rollback(ctx)
					}(tx.Rollback, context.Background())
					player := int64(1)
					if tt.players {
						player = int64(i + 1)
					}
					_, _, err = stagePurchase(ctx, tx, svc, store, content.PlayerRef{ServerID: tt.server, PlayerID: player}, 1001, 1)
					if err == nil {
						err = tx.Commit(ctx)
					}
					errs <- err
				}(i)
			}
			successes := 0
			for i := 0; i < n; i++ {
				err := <-errs
				if err == nil {
					successes++
				} else if !errors.Is(err, tt.wantErr) {
					t.Fatal(err)
				}
			}
			if successes != 1 {
				t.Fatalf("successes=%d", successes)
			}
			fresh := NewPGStore(openShopTestDB(t))
			var rows, sum int
			err := fresh.Pool.QueryRow(ctx, `SELECT count(*),COALESCE(SUM(quantity),0) FROM player_shop_purchase WHERE server_id=$1`, tt.server).Scan(&rows, &sum)
			if err != nil || rows != 1 || sum != 1 {
				t.Fatalf("fresh rows=%d sum=%d err=%v", rows, sum, err)
			}
			if !tt.players {
				count, err := fresh.PurchasedCount(ctx, tt.server, 1, 1001, PurchaseLimitLifetime, at)
				if err != nil || count != 3 {
					t.Fatalf("fresh count=%d err=%v", count, err)
				}
			}
		})
	}
}
func TestPurchaseTxCounterExhaustionDoesNotWrite(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	ctx := context.Background()
	at := time.Now()
	for i, kind := range []string{"total", "daily"} {
		server := int32(104 + i)
		cat := intentCatalog()
		total, daily := int32(math.MaxInt32), int32(0)
		if kind == "daily" {
			cat.Offers[0].DailyLimit = ptr32(0)
			total, daily = 0, math.MaxInt32
		}
		if _, err := pool.Exec(ctx, `INSERT INTO player_shop_offer_counter(server_id,player_id,offer_cfg_id,total_bought,daily_bought,daily_period) VALUES($1,1,1001,$2,$3,$4::date)`, server, total, daily, at.Format("2006-01-02")); err != nil {
			t.Fatal(err)
		}
		svc, store := purchaseTestService(pool, cat, at)
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		_, _, err = stagePurchase(ctx, tx, svc, store, content.PlayerRef{ServerID: server, PlayerID: 1}, 1001, 1)
		tx.Rollback(ctx)
		if !errors.Is(err, ErrPurchaseOverflow) {
			t.Fatalf("%s err=%v", kind, err)
		}
		var rows int
		if err = pool.QueryRow(ctx, `SELECT count(*) FROM player_shop_purchase WHERE server_id=$1`, server).Scan(&rows); err != nil || rows != 0 {
			t.Fatalf("rows=%d err=%v", rows, err)
		}
	}
}
func TestPurchaseTxCancellationAtParticipantLocks(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	ctx := context.Background()
	at := time.Now()
	for i, kind := range []string{"offer", "counter", "allocator", "already canceled"} {
		t.Run(kind, func(t *testing.T) {
			server := int32(106 + i)
			cat := intentCatalog()
			cat.Offers[0].ServerStockLimit = ptr32(3)
			if _, err := pool.Exec(ctx, `INSERT INTO player_shop_offer_counter(server_id,player_id,offer_cfg_id) VALUES($1,1,1001)`, server); err != nil {
				t.Fatal(err)
			}
			blocker, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer func(rollback func(context.Context) error, ctx context.Context) {
				_ = rollback(ctx)
			}(blocker.Rollback, ctx)
			switch kind {
			case "offer":
				_, err = blocker.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer,$2::integer)`, server, int32(1001))
			case "counter":
				_, err = blocker.Exec(ctx, `SELECT 1 FROM player_shop_offer_counter WHERE server_id=$1 FOR UPDATE`, server)
			case "allocator":
				_, err = blocker.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer,$2::integer)`, purchaseAllocatorNamespace, server)
			}
			if err != nil {
				t.Fatal(err)
			}
			svc, store := purchaseTestService(pool, cat, at)
			tx, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			timed, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
			defer cancel()
			if kind == "already canceled" {
				cancel()
			}
			_, _, err = stagePurchase(timed, tx, svc, store, content.PlayerRef{ServerID: server, PlayerID: 1}, 1001, 1)
			tx.Rollback(ctx)
			if !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
				t.Fatalf("wait=%v", err)
			}
			blocker.Rollback(ctx)
			var rows, total int
			if err = pool.QueryRow(ctx, `SELECT count(*) FROM player_shop_purchase WHERE server_id=$1`, server).Scan(&rows); err != nil || rows != 0 {
				t.Fatalf("rows=%d err=%v", rows, err)
			}
			if err = pool.QueryRow(ctx, `SELECT total_bought FROM player_shop_offer_counter WHERE server_id=$1`, server).Scan(&total); err != nil || total != 0 {
				t.Fatalf("total=%d err=%v", total, err)
			}
		})
	}
}
