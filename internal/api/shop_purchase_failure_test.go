package api

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/jackc/pgx/v5"
)

func shopMixedFixture(s *Server) {
	atomicShopCatalog(s, shop.Catalog{Offers: []shop.CatalogEntry{{OfferID: 9001, ShelfID: 1, ItemCfgID: 2001, QuantityPerPurchase: 1,
		Price: content.RewardPackage{Resources: map[string]int64{"food": 3, "gold": 12}, Items: []content.RewardItem{{ItemCfgID: 2004, Qty: 1}}}}}})
}

func TestShopAtomicPGFailureRollsBackEveryComponent(t *testing.T) {
	for _, stage := range []string{"wallet", "currency-item", "ledger", "counter", "receipt", "reward-item", "commit"} {
		t.Run(stage, func(t *testing.T) {
			pool, s := atomicShopFixture(t)
			shopMixedFixture(s)
			recruitSQL(t, pool, `CREATE FUNCTION fail_shop() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private SQL failure'; END $$`)
			queries := map[string]string{
				"wallet":        `CREATE TRIGGER fail AFTER UPDATE ON player_wallet FOR EACH ROW EXECUTE FUNCTION fail_shop()`,
				"currency-item": `CREATE TRIGGER fail AFTER UPDATE ON player_item FOR EACH ROW WHEN(NEW.item_cfg_id=2004) EXECUTE FUNCTION fail_shop()`,
				"ledger":        `CREATE TRIGGER fail AFTER INSERT ON player_shop_purchase FOR EACH ROW EXECUTE FUNCTION fail_shop()`,
				"counter":       `CREATE TRIGGER fail AFTER INSERT ON player_shop_offer_counter FOR EACH ROW EXECUTE FUNCTION fail_shop()`,
				"receipt":       `CREATE TRIGGER fail AFTER INSERT ON reward_grant_queue FOR EACH ROW EXECUTE FUNCTION fail_shop()`,
				"reward-item":   `CREATE TRIGGER fail AFTER INSERT ON player_item FOR EACH ROW WHEN(NEW.item_cfg_id=2001) EXECUTE FUNCTION fail_shop()`,
				"commit":        `CREATE CONSTRAINT TRIGGER fail AFTER INSERT ON player_shop_purchase DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_shop()`,
			}
			recruitSQL(t, pool, queries[stage])
			before := shopAtomicState(t, pool)
			invalidations := 0
			s.shopPurchase.invalidate = func(context.Context, content.PlayerRef) error { invalidations++; return nil }
			if _, err := s.purchaseShopAtomic(context.Background(), PlayerContext{ServerID: 1, PlayerID: 7}, 9001, 1); err == nil {
				t.Fatal("injected failure accepted")
			}
			if got := shopAtomicState(t, pool); got != before || invalidations != 0 {
				t.Fatalf("partial outcome invalidations=%d\nbefore%s\nafter%s", invalidations, before, got)
			}
		})
	}
}

func TestShopAtomicPGCancellationAfterRealWrites(t *testing.T) {
	for _, stage := range []string{"UPDATE player_wallet", "UPDATE player_item", "INSERT INTO player_shop_purchase", "INSERT INTO player_shop_offer_counter", "INSERT INTO reward_grant_queue", "INSERT INTO player_item"} {
		t.Run(stage, func(t *testing.T) {
			pool, s := atomicShopFixture(t)
			shopMixedFixture(s)
			before := shopAtomicState(t, pool)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			began := s.shopPurchase.begin
			hit := false
			commits := 0
			s.shopPurchase.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, err := began(ctx, opts)
				if err != nil {
					return nil, err
				}
				stop := func(query string) {
					if strings.Contains(query, stage) {
						hit = true
						cancel()
					}
				}
				return &recruitObservedTx{Tx: tx, afterExec: stop, afterRow: stop, commits: &commits}, nil
			}
			_, err := s.purchaseShopAtomic(ctx, PlayerContext{ServerID: 1, PlayerID: 7}, 9001, 1)
			if err == nil || !hit || commits != 0 || shopAtomicState(t, pool) != before {
				t.Fatalf("cancel hit=%t commits=%d err=%v", hit, commits, err)
			}
		})
	}
}

func TestShopAtomicPGUnknownCommitIsNotReplayed(t *testing.T) {
	pool, s := atomicShopFixture(t)
	var audit bytes.Buffer
	s.log = slog.New(slog.NewTextHandler(&audit, nil))
	shopMixedFixture(s)
	begin := s.shopPurchase.begin
	commits, invalidations := 0, 0
	s.shopPurchase.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
		tx, err := begin(ctx, opts)
		if err != nil {
			return nil, err
		}
		return &recruitObservedTx{Tx: tx, commits: &commits, afterCommit: func() error { return errors.New("lost commit response") }}, nil
	}
	s.shopPurchase.invalidate = func(context.Context, content.PlayerRef) error { invalidations++; return nil }
	out, err := s.purchaseShopAtomic(context.Background(), PlayerContext{ServerID: 1, PlayerID: 7}, 9001, 1)
	if !errors.Is(err, errShopOutcome) || commits != 1 || invalidations != 0 || out.purchaseID != 0 || len(out.granted) != 0 {
		t.Fatalf("unknown %+v %v c=%d i=%d", out, err, commits, invalidations)
	}
	if !strings.Contains(audit.String(), "purchase_id=1") || !strings.Contains(audit.String(), "grant_id=1") {
		t.Fatalf("unknown outcome lost reserved audit IDs: %s", audit.String())
	}
	var ledger, receipts, qty, books, count int
	var gold, food int64
	if err = pool.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM player_shop_purchase),(SELECT count(*) FROM reward_grant_queue),
 (SELECT quantity FROM player_item WHERE item_cfg_id=2001),(SELECT quantity FROM player_item WHERE item_cfg_id=2004),
 (SELECT total_bought FROM player_shop_offer_counter),gold,food FROM player_wallet WHERE server_id=1 AND player_id=7`).Scan(&ledger, &receipts, &qty, &books, &count, &gold, &food); err != nil || ledger != 1 || receipts != 1 || qty != 1 || books != 1 || count != 1 || gold != 488 || food != 97 {
		t.Fatalf("durable one outcome %d %d %d %d %d %d %d %v", ledger, receipts, qty, books, count, gold, food, err)
	}
}

func TestShopAtomicPGConfirmedCommitSurvivesRefreshFailure(t *testing.T) {
	pool, s := atomicShopFixture(t)
	calls := 0
	s.shopPurchase.invalidate = func(context.Context, content.PlayerRef) error { calls++; return errors.New("read unavailable") }
	out, err := s.purchaseShopAtomic(context.Background(), PlayerContext{ServerID: 1, PlayerID: 7}, 1001, 1)
	if err != nil || out.wallet.Gold != 490 || len(out.granted) != 1 || calls != 1 {
		t.Fatalf("confirmed %+v %v calls%d", out, err, calls)
	}
	var n int
	if err = pool.QueryRow(context.Background(), `SELECT count(*) FROM player_shop_purchase`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("ledger %d %v", n, err)
	}
}

func TestShopAtomicPGDependencyActorAndCapacityRejects(t *testing.T) {
	for _, kind := range []string{"no-player", "wrong-account", "no-wallet", "foreign-cache-pool", "foreign-private-pool", "foreign-shop", "missing-binding", "wrong-catalog", "count", "stack", "item", "gold", "unknown-offer", "canceled"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := atomicShopFixture(t)
			shopMixedFixture(s)
			pc := PlayerContext{ServerID: 1, PlayerID: 7}
			ctx := context.Background()
			count, offer := int32(1), int32(9001)
			switch kind {
			case "no-player":
				recruitSQL(t, pool, `DELETE FROM player`)
			case "wrong-account":
				pc.AccountID = 999
			case "no-wallet":
				recruitSQL(t, pool, `DELETE FROM player_wallet`)
			case "foreign-cache-pool":
				s.contentSvc.UseStore(content.NewPGStore(walletBoundaryPool(t, true)))
			case "foreign-private-pool":
				s.shopPurchase.itemStore.Pool = walletBoundaryPool(t, true)
			case "foreign-shop":
				s.shopSvc = shop.NewService(devShopCatalog(), nil, nil, pool)
			case "missing-binding":
				s.shopPurchase = nil
			case "wrong-catalog":
				s.contentCatalog.catalog = &content.Catalog{}
			case "count":
				count = 0
			case "stack":
				recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,7,2001,99)`)
			case "item":
				recruitSQL(t, pool, `UPDATE player_item SET quantity=0`)
			case "gold":
				recruitSQL(t, pool, `UPDATE player_wallet SET gold=0`)
			case "unknown-offer":
				offer = 99999
			case "canceled":
				var cancel context.CancelFunc
				ctx, cancel = context.WithCancel(ctx)
				cancel()
			}
			before := shopAtomicState(t, pool)
			if _, err := s.purchaseShopAtomic(ctx, pc, offer, count); err == nil || shopAtomicState(t, pool) != before {
				t.Fatalf("rejection %s %v", kind, err)
			}
		})
	}
}
