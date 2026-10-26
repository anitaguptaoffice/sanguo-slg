package api

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
)

func TestShopPurchaseWalletPGCallerOwnership(t *testing.T) {
	pool := walletBoundaryPool(t)
	ctx := context.Background()
	_, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food,wood,iron,stone,gold,updated_at) VALUES(1,7,100,200,300,400,500,'2020-01-01')`)
	if err != nil {
		t.Fatal(err)
	}
	pc := PlayerContext{ServerID: 1, PlayerID: 7}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, ctx)
	have, err := lockShopWallet(ctx, tx, pc)
	if err != nil || have.Gold != 500 {
		t.Fatalf("lock %+v %v", have, err)
	}
	var stamp, timeAfter time.Time
	if err = tx.QueryRow(ctx, `SELECT updated_at FROM player_wallet WHERE server_id=1 AND player_id=7`).Scan(&stamp); err != nil {
		t.Fatal(err)
	}
	got, err := debitShopWallet(ctx, tx, pc, have, content.ResourceWallet{})
	if err != nil || got != have {
		t.Fatalf("free %+v %v", got, err)
	}
	if err = tx.QueryRow(ctx, `SELECT updated_at FROM player_wallet WHERE server_id=1 AND player_id=7`).Scan(&timeAfter); err != nil || !stamp.Equal(timeAfter) {
		t.Fatalf("free timestamp %v %v", timeAfter, err)
	}
	for _, cost := range []content.ResourceWallet{{Gold: -1}, {Food: -1}, {Wood: -1}, {Iron: -1}, {Stone: -1}} {
		if _, err = debitShopWallet(ctx, tx, pc, have, cost); !errors.Is(err, shop.ErrInvalidPurchaseCount) {
			t.Fatalf("negative %+v %v", cost, err)
		}
	}
	if _, err = debitShopWallet(ctx, tx, pc, have, content.ResourceWallet{Gold: 501}); !errors.Is(err, shop.ErrInsufficientBalance) {
		t.Fatal(err)
	}
	cost := content.ResourceWallet{Food: 10, Wood: 20, Iron: 30, Stone: 40, Gold: 50}
	want := content.ResourceWallet{Food: 90, Wood: 180, Iron: 270, Stone: 360, Gold: 450}
	got, err = debitShopWallet(ctx, tx, pc, have, cost)
	if err != nil || got != want {
		t.Fatalf("debit %+v %v", got, err)
	}
	actual, err := lockShopWallet(ctx, tx, pc)
	if err != nil || actual != want {
		t.Fatalf("staged %+v %v", actual, err)
	}
	if err = tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx, err = pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, ctx)
	actual, err = lockShopWallet(ctx, tx, pc)
	if err != nil || actual != have {
		t.Fatalf("rollback %+v %v", actual, err)
	}
	if _, err = lockShopWallet(ctx, tx, PlayerContext{ServerID: 1, PlayerID: 8}); !errors.Is(err, errShopWallet) {
		t.Fatalf("missing %v", err)
	}
	var n int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM player_wallet`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("synthesized %d %v", n, err)
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err = lockShopWallet(canceled, tx, pc); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancel %v", err)
	}
}
