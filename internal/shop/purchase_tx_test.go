package shop

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func purchaseTestService(pool *pgxpool.Pool, cat Catalog, at time.Time) (*Service, *PGStore) {
	store := NewPGStore(pool)
	svc := NewService(cat, store, nil, nil)
	svc.now = func() time.Time { return at }
	return svc, store
}

// Simulates the coordinator-owned wallet mutex, not a SHOP participant behavior.
func lockPurchaseTestWallet(ctx context.Context, tx pgx.Tx, p content.PlayerRef) error {
	if _, err := tx.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, p.ServerID, p.PlayerID); err != nil {
		return err
	}
	var one int
	return tx.QueryRow(ctx, `SELECT 1 FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, p.ServerID, p.PlayerID).Scan(&one)
}
func stagePurchase(ctx context.Context, tx pgx.Tx, svc *Service, store *PGStore, actor content.PlayerRef, offer, count int32) (PurchasePlan, int64, error) {
	in, err := svc.PreparePurchase(actor, offer, count)
	if err != nil {
		return PurchasePlan{}, 0, err
	}
	if err = lockPurchaseTestWallet(ctx, tx, actor); err != nil {
		return PurchasePlan{}, 0, err
	}
	st, err := store.LockPurchaseStateInTx(ctx, tx, in)
	if err != nil {
		return PurchasePlan{}, 0, err
	}
	plan, err := svc.PlanPurchase(in, st)
	if err != nil {
		return plan, 0, err
	}
	id, err := store.RecordPurchaseInTx(ctx, tx, plan)
	return plan, id, err
}
func TestPurchaseTxRollbackCommitAndBinding(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	ctx := context.Background()
	at := time.Date(2026, 3, 15, 23, 59, 0, 0, time.FixedZone("east", 8*3600))
	cat := intentCatalog()
	cat.Offers[0].DailyLimit = ptr32(3)
	cat.Offers[0].Price.Resources = map[string]int64{"silver": 10}
	svc, store := purchaseTestService(pool, cat, at)
	actor := content.PlayerRef{ServerID: 91, PlayerID: 1}
	for _, commit := range []bool{false, true} {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		plan, id, err := stagePurchase(ctx, tx, svc, store, actor, 1001, 2)
		if err != nil {
			_ = tx.Rollback(ctx) // Best-effort cleanup before reporting the staging failure.
			t.Fatal(err)
		}
		if id != 1 || plan.Offer().PurchasedCount != 2 {
			t.Fatalf("id=%d plan=%+v", id, plan)
		}
		if _, err = store.RecordPurchaseInTx(ctx, tx, plan); !errors.Is(err, ErrPurchaseTransactionRequired) {
			t.Fatal(err)
		}
		if commit {
			err = tx.Commit(ctx)
		} else {
			err = tx.Rollback(ctx)
		}
		if err != nil {
			t.Fatal(err)
		}
		var n int
		want := 0
		if commit {
			want = 1
		}
		for _, table := range []string{"player_shop_purchase", "player_shop_offer_counter"} {
			if err = pool.QueryRow(ctx, `SELECT count(*) FROM `+table+` WHERE server_id=91`).Scan(&n); err != nil || n != want {
				t.Fatalf("%s count=%d err=%v", table, n, err)
			}
		}
	}
	var qty, cost, total, daily int32
	var day string
	var created time.Time
	var key *string
	err := pool.QueryRow(ctx, `SELECT quantity,(cost_snapshot->'resources'->>'silver')::integer,idempotency_key,created_at FROM player_shop_purchase WHERE server_id=91`).Scan(&qty, &cost, &key, &created)
	if err != nil || qty != 2 || cost != 20 || key != nil || !created.Equal(at) {
		t.Fatalf("ledger qty=%d cost=%d key=%v at=%v err=%v", qty, cost, key, created, err)
	}
	err = pool.QueryRow(ctx, `SELECT total_bought,daily_bought,daily_period::text FROM player_shop_offer_counter WHERE server_id=91`).Scan(&total, &daily, &day)
	if err != nil || total != 2 || daily != 2 || day != "2026-03-15" {
		t.Fatalf("counter %d/%d %s err=%v", total, daily, day, err)
	}
	if !svc.UsesPurchaseStore(store, pool) || svc.UsesPurchaseStore(NewPGStore(pool), pool) || svc.UsesPurchaseStore(store, nil) {
		t.Fatal("binding")
	}
	in, _ := svc.PreparePurchase(actor, 1001, 1)
	tx, _ := pool.Begin(ctx)
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, ctx)
	if _, err = NewPGStore(pool).LockPurchaseStateInTx(ctx, tx, in); !errors.Is(err, ErrPurchaseTransactionRequired) {
		t.Fatal(err)
	}
	if _, err = store.LockPurchaseStateInTx(ctx, nil, in); !errors.Is(err, ErrPurchaseTransactionRequired) {
		t.Fatal(err)
	}
}
func TestPurchaseTxUsesOnlySuppliedConnection(t *testing.T) {
	setup := openShopTestDB(t)
	applyShopSchema(t, setup)
	cfg := setup.Config()
	cfg.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	svc, store := purchaseTestService(pool, intentCatalog(), time.Now())
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, context.Background())
	if _, _, err = stagePurchase(ctx, tx, svc, store, content.PlayerRef{ServerID: 92, PlayerID: 1}, 1001, 1); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
}
