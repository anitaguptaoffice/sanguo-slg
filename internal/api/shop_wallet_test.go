package api_test

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
)

func TestPgShopWalletSpend(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		t.Fatal(err)
	}
	if err := db.SeedDevServer(ctx, pool, 1, "S1"); err != nil {
		t.Fatal(err)
	}
	const playerID = 4242
	_, err := pool.Exec(ctx, `
		INSERT INTO account (account_id, login_name, password_hash)
		VALUES (9001, 'wallet-test', 'x') ON CONFLICT DO NOTHING`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO player (server_id, player_id, account_id, display_name)
		VALUES (1, $1, 9001, 'wallet-test') ON CONFLICT DO NOTHING`, playerID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO player_wallet (server_id, player_id, food, wood, iron, stone, gold)
		VALUES (1, $1, 100, 200, 300, 400, 50)
		ON CONFLICT (server_id, player_id) DO UPDATE SET gold=50, food=100, wood=200, iron=300, stone=400`,
		playerID)
	if err != nil {
		t.Fatal(err)
	}

	srv := api.NewServer(nil, pool, nil, nil, nil)
	store := srv.ShopWalletStore()
	p := content.PlayerRef{ServerID: 1, PlayerID: playerID}
	after, err := store.Spend(ctx, p, content.ResourceWallet{Gold: 10})
	if err != nil || after.Gold != 40 {
		t.Fatalf("spend: err=%v after=%+v", err, after)
	}
	_, err = store.Spend(ctx, p, content.ResourceWallet{Gold: 100})
	if !errors.Is(err, shop.ErrInsufficientBalance) {
		t.Fatalf("expected insufficient, got %v", err)
	}
}
