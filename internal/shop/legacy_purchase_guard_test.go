package shop

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

type wrappedLegacyStore struct{ Store }

func TestLegacyPurchaseRejectsBeforeDependencies(t *testing.T) {
	var nilMemory *MemStore
	var nilPG *PGStore
	for name, svc := range map[string]*Service{
		"nil service":           nil,
		"nil store":             {},
		"nil memory":            {store: nilMemory},
		"nil PG":                {store: nilPG},
		"PG without pool":       {store: NewPGStore(nil)},
		"wrapped PG":            {store: wrappedLegacyStore{NewPGStore(nil)}},
		"custom memory wrapper": {store: wrappedLegacyStore{NewMemStore()}},
	} {
		t.Run(name, func(t *testing.T) {
			if svc != nil {
				svc.now = func() time.Time { t.Fatal("legacy clock accessed"); return time.Time{} }
			}
			// Nil payments/pools and nil embedded stores cannot be consulted. The
			// transaction-required guard also precedes ordinary input validation.
			for _, count := range []int32{1, 0} {
				offer, items, wallet, err := svc.Purchase(1, 1, 1001, count)
				if !errors.Is(err, ErrPurchaseTransactionRequired) || !reflect.DeepEqual(offer, Offer{}) || items != nil || wallet != (content.ResourceWallet{}) {
					t.Fatalf("offer=%+v items=%v wallet=%+v err=%v", offer, items, wallet, err)
				}
			}
		})
	}
}

type guardWallet struct {
	stubWallet
	calls int
}

func (w *guardWallet) Spend(ctx context.Context, player content.PlayerRef, cost content.ResourceWallet) (content.ResourceWallet, error) {
	w.calls++
	return w.stubWallet.Spend(ctx, player, cost)
}

func TestLegacyPGPurchaseGuardLeavesAllStateUntouched(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	ctx := context.Background()
	actor := content.PlayerRef{ServerID: 121, PlayerID: 1}
	for _, query := range []string{
		`INSERT INTO player_wallet(server_id,player_id,gold) VALUES(121,1,100)`,
		`INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(121,1,2001,5)`,
		`INSERT INTO player_shop_purchase(server_id,purchase_id,player_id,offer_cfg_id,quantity) VALUES(121,1,1,1001,1)`,
		`INSERT INTO player_shop_offer_counter(server_id,player_id,offer_cfg_id,total_bought,daily_bought,daily_period) VALUES(121,1,1001,1,1,'2026-03-15')`,
	} {
		if _, err := pool.Exec(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	items := content.NewService(cat)
	items.UseStore(content.NewPGStore(pool))
	if err = items.LoadPlayer(ctx, actor); err != nil {
		t.Fatal(err)
	}
	wallet := &guardWallet{stubWallet: stubWallet{balances: map[content.PlayerRef]content.ResourceWallet{actor: {Gold: 100}}}}
	shopCat := intentCatalog()
	shopCat.Offers[0].Price = content.RewardPackage{Resources: map[string]int64{"gold": 10}, Items: []content.RewardItem{{ItemCfgID: 2001, Qty: 1}}}
	snapshot := func() map[string]string {
		t.Helper()
		out := map[string]string{}
		for _, table := range []string{"player_wallet", "player_item", "player_shop_purchase", "player_shop_offer_counter", "reward_grant_queue"} {
			var raw string
			if err := pool.QueryRow(ctx, `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text FROM `+table+` t WHERE server_id=121`).Scan(&raw); err != nil {
				t.Fatal(err)
			}
			out[table] = raw
		}
		return out
	}
	before := snapshot()
	for _, wrapped := range []bool{false, true} {
		for _, payments := range []*Payments{nil, NewPayments(items, wallet)} {
			var store Store = NewPGStore(pool)
			if wrapped {
				store = wrappedLegacyStore{store}
			}
			svc := NewService(shopCat, store, payments, nil)
			svc.now = func() time.Time { t.Fatal("legacy clock accessed"); return time.Time{} }
			if _, _, _, err := svc.Purchase(121, 1, 1001, 1); !errors.Is(err, ErrPurchaseTransactionRequired) {
				t.Fatalf("wrapped=%t nil payments=%t err=%v", wrapped, payments == nil, err)
			}
			if after := snapshot(); !reflect.DeepEqual(before, after) {
				t.Fatalf("durable state changed: before=%v after=%v", before, after)
			}
		}
	}
	if qty, err := items.Get(actor, 2001); err != nil || qty != 5 || wallet.calls != 0 || wallet.balances[actor].Gold != 100 {
		t.Fatalf("cached qty=%d wallet=%+v calls=%d err=%v", qty, wallet.balances[actor], wallet.calls, err)
	}
}
