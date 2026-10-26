package api

import (
	"context"
	"fmt"
	"reflect"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/jackc/pgx/v5/pgxpool"
)

func atomicShopFixture(t *testing.T) (*pgxpool.Pool, *Server) {
	t.Helper()
	pool := walletBoundaryPool(t, true)
	seedRecruitActor(t, pool, 7, hero.Resources{Food: 100, Wood: 200, Iron: 300, Stone: 400, Gold: 500}, 2)
	return pool, recruitServer(t, pool, 7)
}

func atomicShopCatalog(s *Server, cat shop.Catalog) {
	store := shop.NewPGStore(s.players.Pool)
	s.shopSvc = shop.NewService(cat, store, shop.NewPayments(s.contentSvc, s.newShopWalletStore()), s.players.Pool)
	s.wireShopTransactions(s.contentCatalog.catalog, store)
}

func shopAtomicState(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var out string
	err := pool.QueryRow(context.Background(), `SELECT jsonb_build_array(
 (SELECT jsonb_agg(w ORDER BY server_id,player_id) FROM player_wallet w),
 (SELECT jsonb_agg(i ORDER BY server_id,player_id,item_cfg_id) FROM player_item i),
 (SELECT jsonb_agg(p ORDER BY server_id,purchase_id) FROM player_shop_purchase p),
 (SELECT jsonb_agg(c ORDER BY server_id,player_id,offer_cfg_id) FROM player_shop_offer_counter c),
 (SELECT jsonb_agg(r ORDER BY server_id,grant_id) FROM reward_grant_queue r))::text`).Scan(&out)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func TestShopAtomicPGDefaultPurchaseReceiptAndRestart(t *testing.T) {
	pool, s := atomicShopFixture(t)
	ctx := context.Background()
	player := content.PlayerRef{ServerID: 1, PlayerID: 7}
	// Deliberately warm the exposed cache; only commit may invalidate it.
	if err := s.contentSvc.LoadPlayer(ctx, player); err != nil {
		t.Fatal(err)
	}
	out, err := s.purchaseShopAtomic(ctx, PlayerContext{ServerID: 1, PlayerID: 7}, 1001, 2)
	if err != nil || out.wallet.Gold != 480 || out.wallet.Food != 100 || out.purchaseID != 1 || out.offer.PurchasedCount != 2 || out.offer.StockRemaining != -1 {
		t.Fatalf("purchase %+v %v", out, err)
	}
	want := content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2001, Qty: 2}}}
	if !reflect.DeepEqual(out.granted, want.Items) || out.receipt.GrantID <= 0 {
		t.Fatalf("grant %+v", out)
	}
	var ledger, grants, counter, qty int
	if err = pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_shop_purchase),(SELECT count(*) FROM reward_grant_queue),
 (SELECT daily_bought FROM player_shop_offer_counter WHERE server_id=1 AND player_id=7 AND offer_cfg_id=1001),
 (SELECT quantity FROM player_item WHERE server_id=1 AND player_id=7 AND item_cfg_id=2001)`).Scan(&ledger, &grants, &counter, &qty); err != nil || ledger != 1 || grants != 1 || counter != 2 || qty != 2 {
		t.Fatalf("durable %d %d %d %d %v", ledger, grants, counter, qty, err)
	}
	fresh := recruitServer(t, pool, 7)
	receipt, found, err := fresh.contentSvc.FindGrantReceipt(ctx, player, want, fmt.Sprintf("shop:7:%d", out.purchaseID))
	if err != nil || !found || receipt.GrantID != out.receipt.GrantID {
		t.Fatalf("restart %+v %t %v", receipt, found, err)
	}
	before := shopAtomicState(t, pool)
	if _, err = fresh.purchaseShopAtomic(ctx, PlayerContext{ServerID: 1, PlayerID: 7}, 1001, 2); err == nil || shopAtomicState(t, pool) != before {
		t.Fatalf("cap reject %v", err)
	}
	if err = fresh.contentSvc.LoadPlayer(ctx, player); err != nil {
		t.Fatal(err)
	}
	seen := false
	for _, stack := range fresh.contentSvc.List(player) {
		if stack.ItemCfgID == 2001 && stack.Quantity == 2 {
			seen = true
		}
	}
	if !seen {
		t.Fatal("restart bag missing exact grant")
	}
}

func TestShopAtomicPGMixedCurrencyAndFreePurchase(t *testing.T) {
	for _, kind := range []string{"mixed", "item-only", "free"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := atomicShopFixture(t)
			price := content.RewardPackage{}
			if kind != "free" {
				price.Items = []content.RewardItem{{ItemCfgID: 2004, Qty: 1}}
			}
			if kind == "mixed" {
				price.Resources = map[string]int64{"food": 3, "silver": 10, "gold": 2}
			}
			atomicShopCatalog(s, shop.Catalog{Offers: []shop.CatalogEntry{{OfferID: 9001, ShelfID: 1, ItemCfgID: 2001, QuantityPerPurchase: 2, Price: price}}})
			out, err := s.purchaseShopAtomic(context.Background(), PlayerContext{ServerID: 1, PlayerID: 7}, 9001, 2)
			if err != nil || len(out.granted) != 1 || out.granted[0].Qty != 4 {
				t.Fatalf("purchase %+v %v", out, err)
			}
			wantGold, wantFood := int64(500), int64(100)
			if kind == "mixed" {
				wantGold, wantFood = 476, 94
			}
			if out.wallet.Gold != wantGold || out.wallet.Food != wantFood {
				t.Fatalf("wallet %+v", out.wallet)
			}
			var books int
			if err = pool.QueryRow(context.Background(), `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=7 AND item_cfg_id=2004`).Scan(&books); err != nil {
				t.Fatal(err)
			}
			wantBooks := 0
			if kind == "free" {
				wantBooks = 2
			}
			if books != wantBooks {
				t.Fatalf("books %d", books)
			}
		})
	}
}
