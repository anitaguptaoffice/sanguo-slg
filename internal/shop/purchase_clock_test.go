package shop

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5/pgxpool"
)

func waitPurchaseLock(t *testing.T, ctx context.Context, pool *pgxpool.Pool, pid int32) {
	t.Helper()
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		var wait string
		if err := pool.QueryRow(ctx, `SELECT COALESCE(wait_event_type,'') FROM pg_stat_activity WHERE pid=$1`, pid).Scan(&wait); err != nil {
			t.Fatal(err)
		}
		if wait == "Lock" {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal("purchase did not wait on lock")
		case <-ticker.C:
		}
	}
}
func TestPurchaseDecisionClockAfterBusinessLocksNotAllocator(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	before := time.Date(2026, 3, 15, 23, 59, 59, 0, time.FixedZone("civil-east", 8*3600))
	after := before.Add(time.Second)
	for i, kind := range []string{"wallet", "offer", "counter", "allocator"} {
		t.Run(kind, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			server := int32(110 + i)
			actor := content.PlayerRef{ServerID: server, PlayerID: 1}
			if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id) VALUES($1,1)`, server); err != nil {
				t.Fatal(err)
			}
			if _, err := pool.Exec(ctx, `INSERT INTO player_shop_offer_counter(server_id,player_id,offer_cfg_id,total_bought,daily_bought,daily_period) VALUES($1,1,1001,2,2,'2026-03-15')`, server); err != nil {
				t.Fatal(err)
			}
			blocker, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer blocker.Rollback(context.Background())
			switch kind {
			case "wallet":
				_, err = blocker.Exec(ctx, `SELECT 1 FROM player_wallet WHERE server_id=$1 FOR UPDATE`, server)
			case "counter":
				_, err = blocker.Exec(ctx, `SELECT 1 FROM player_shop_offer_counter WHERE server_id=$1 FOR UPDATE`, server)
			case "offer":
				_, err = blocker.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer,$2::integer)`, server, int32(1001))
			case "allocator":
				_, err = blocker.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer,$2::integer)`, purchaseAllocatorNamespace, server)
			}
			if err != nil {
				t.Fatal(err)
			}
			cat := intentCatalog()
			cat.Offers[0].DailyLimit = ptr32(3)
			cat.Offers[0].ServerStockLimit = ptr32(10)
			svc, store := purchaseTestService(pool, cat, before)
			var clock atomic.Value
			clock.Store(before)
			var samples atomic.Int32
			svc.now = func() time.Time { samples.Add(1); return clock.Load().(time.Time) }
			tx, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback(context.Background())
			var pid int32
			if err = tx.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&pid); err != nil {
				t.Fatal(err)
			}
			type outcome struct {
				plan PurchasePlan
				err  error
			}
			done := make(chan outcome, 1)
			go func() {
				plan, _, err := stagePurchase(ctx, tx, svc, store, actor, 1001, 1)
				if err == nil {
					err = tx.Commit(ctx)
				}
				done <- outcome{plan, err}
			}()
			waitPurchaseLock(t, ctx, pool, pid)
			wantSamples := int32(0)
			wantTime := after
			wantDaily := int32(1)
			if kind == "allocator" {
				wantSamples = 1
				wantTime = before
				wantDaily = 3
			}
			if got := samples.Load(); got != wantSamples {
				t.Fatalf("sampled before decision lock: %d want %d", got, wantSamples)
			}
			clock.Store(after)
			if err = blocker.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			out := <-done
			if out.err != nil {
				t.Fatal(out.err)
			}
			if samples.Load() != 1 || !out.plan.DecisionTime().Equal(wantTime) || out.plan.Offer().PurchasedCount != wantDaily {
				t.Fatalf("time=%v daily=%d samples=%d", out.plan.DecisionTime(), out.plan.Offer().PurchasedCount, samples.Load())
			}
			var day string
			var daily int32
			var created time.Time
			err = pool.QueryRow(ctx, `SELECT daily_period::text,daily_bought FROM player_shop_offer_counter WHERE server_id=$1`, server).Scan(&day, &daily)
			if err != nil || day != wantTime.Format("2006-01-02") || daily != wantDaily {
				t.Fatalf("stored day=%s daily=%d err=%v", day, daily, err)
			}
			err = pool.QueryRow(ctx, `SELECT created_at FROM player_shop_purchase WHERE server_id=$1`, server).Scan(&created)
			if err != nil || !created.Equal(wantTime) {
				t.Fatalf("created=%v err=%v", created, err)
			}
			// The next decision uses the new civil day even when allocator wait preserved
			// yesterday's decision. No clock resample/rollback-to-yesterday is performed.
			tx2, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer tx2.Rollback(context.Background())
			plan, _, err := stagePurchase(ctx, tx2, svc, store, actor, 1001, 1)
			if err != nil {
				t.Fatal(err)
			}
			nextCount := int32(2)
			if kind == "allocator" {
				nextCount = 1
			}
			if plan.Offer().PurchasedCount != nextCount {
				t.Fatalf("next count=%d", plan.Offer().PurchasedCount)
			}
			if err = tx2.Commit(ctx); err != nil {
				t.Fatal(err)
			}
		})
	}
}
