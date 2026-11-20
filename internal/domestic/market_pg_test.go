package domestic

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGMarketMerchantAndOffers(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	if _, err := pool.Exec(ctx, `
		DELETE FROM market_offer WHERE server_id=1 AND seller_player_id IN (71,72,73);
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE
			VALUES (71,'market71','x'),(72,'market72','x'),(73,'market73','x')
			ON CONFLICT (account_id) DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name)
			VALUES (1,71,71,'seller'),(1,72,72,'buyer'),(1,73,73,'far')
			ON CONFLICT (server_id,player_id) DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y)
			VALUES (1,41,71,'seller city',60,60),(1,42,72,'buyer city',70,60),(1,43,73,'far city',500,500)
			ON CONFLICT (server_id,city_id) DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold)
			VALUES (1,71,10000,10000,10000,10000,1000),(1,72,10000,10000,10000,10000,1000),(1,73,10000,10000,10000,10000,1000)
			ON CONFLICT (server_id,player_id) DO NOTHING;
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level)
			VALUES (1,41,'market',12,3),(1,42,'market',12,3),(1,43,'market',12,3)
			ON CONFLICT (server_id,city_id,slot_key) DO UPDATE SET level=3;
		DELETE FROM market_offer WHERE server_id=1;
		UPDATE player_wallet SET food=10000,wood=10000,stone=10000,iron=10000,gold=1000
			WHERE server_id=1 AND player_id IN (71,72,73)`); err != nil {
		t.Fatal(err)
	}
	m := NewMarket(pool, func() time.Time { return now })

	res, err := m.BuyFromMerchant(ctx, 1, 71, 41, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if res.Gold != 990 || res.GoldDiff != -10 || res.Wallet.Food != 10100 {
		t.Fatalf("buy = %+v", res)
	}
	res, err = m.SellToMerchant(ctx, 1, 71, 41, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if res.Gold != 1000 || res.GoldDiff != 10 || res.Wallet.Food != 10000 {
		t.Fatalf("sell = %+v", res)
	}

	offer, err := m.CreateOffer(ctx, 1, 71, 41, 0, 500, 100, 4)
	if err != nil {
		t.Fatal(err)
	}
	if offer.Offer.GoldTotal != 50 || offer.Wallet.Food != 9500 {
		t.Fatalf("offer = %+v", offer)
	}
	snap, err := m.Snapshot(ctx, 1, 72, 42)
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Offers) != 1 || snap.Offers[0].Distance != 10 || snap.Offers[0].DeliverSeconds != 167 {
		t.Fatalf("offers = %+v", snap.Offers)
	}
	bought, err := m.BuyOffer(ctx, 1, 72, 42, offer.Offer.OfferID)
	if err != nil {
		t.Fatal(err)
	}
	if bought.Gold != 950 || !bought.DeliverAt.Equal(now.Add(167*time.Second)) {
		t.Fatalf("buy offer = %+v", bought)
	}
	snap, err = m.Snapshot(ctx, 1, 72, 42)
	if err != nil || len(snap.Deliveries) != 1 {
		t.Fatalf("deliveries = %+v %v", snap.Deliveries, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE market_offer SET deliver_at=$2 WHERE server_id=1 AND offer_id=$1`,
		offer.Offer.OfferID, now.Add(-time.Second)); err != nil {
		t.Fatal(err)
	}
	snap, err = m.Snapshot(ctx, 1, 72, 42)
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Deliveries) != 0 || snap.Wallet.Food != 10500 {
		t.Fatalf("settled = %+v", snap)
	}
	var sellerGold int64
	if err := pool.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=1 AND player_id=71`).Scan(&sellerGold); err != nil {
		t.Fatal(err)
	}
	if sellerGold != 1050 {
		t.Fatalf("seller gold = %d", sellerGold)
	}

	second, err := m.CreateOffer(ctx, 1, 71, 41, 1, 200, 100, 4)
	if err != nil {
		t.Fatal(err)
	}
	cancelled, err := m.CancelOffer(ctx, 1, 71, 41, second.Offer.OfferID)
	if err != nil || cancelled.Wallet.Wood != 10000 {
		t.Fatalf("cancel = %+v %v", cancelled, err)
	}
	if _, err := m.CancelOffer(ctx, 1, 71, 41, second.Offer.OfferID); !errors.Is(err, ErrMarketOffer) {
		t.Fatalf("double cancel = %v", err)
	}
	if _, err := m.CreateOffer(ctx, 1, 71, 41, 0, 1, 200, 1); !errors.Is(err, ErrMarketPrice) {
		t.Fatalf("price guard = %v", err)
	}
	if _, err := m.CreateOffer(ctx, 1, 71, 41, 0, 300001, 100, 1); !errors.Is(err, ErrMarketAmount) {
		t.Fatalf("amount guard = %v", err)
	}
	if _, err := m.BuyOffer(ctx, 1, 71, 41, offer.Offer.OfferID); !errors.Is(err, ErrMarketOffer) {
		t.Fatalf("sold offer guard = %v", err)
	}
	self, err := m.CreateOffer(ctx, 1, 71, 41, 0, 10, 100, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.BuyOffer(ctx, 1, 71, 41, self.Offer.OfferID); !errors.Is(err, ErrMarketSelf) {
		t.Fatalf("self guard = %v", err)
	}
	far, err := m.CreateOffer(ctx, 1, 71, 41, 0, 10, 100, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.BuyOffer(ctx, 1, 73, 43, far.Offer.OfferID); !errors.Is(err, ErrMarketDistance) {
		t.Fatalf("distance guard = %v", err)
	}
	if _, err := m.CreateOffer(ctx, 1, 71, 41, 0, 1, 100, 1); err != nil {
		t.Fatalf("capacity fill: %v", err)
	}
	if _, err := m.CreateOffer(ctx, 1, 71, 41, 0, 1, 100, 1); !errors.Is(err, ErrMarketCapacity) {
		t.Fatalf("capacity guard = %v", err)
	}
}
