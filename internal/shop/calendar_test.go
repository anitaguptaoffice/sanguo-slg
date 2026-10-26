package shop

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func calendarCases(t *testing.T) []struct {
	name string
	now  time.Time
} {
	t.Helper()
	la, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatal(err)
	}
	return []struct {
		name string
		now  time.Time
	}{
		{"UTC", time.Date(2026, 10, 25, 0, 30, 0, 0, time.UTC)},
		{"minus7", time.Date(2026, 10, 25, 0, 30, 0, 0, time.FixedZone("PDT", -7*3600))},
		{"plus8", time.Date(2026, 10, 25, 0, 30, 0, 0, time.FixedZone("CST", 8*3600))},
		{"DST_spring", time.Date(2026, 3, 8, 0, 30, 0, 0, la)},
		{"DST_fall", time.Date(2026, 11, 1, 0, 30, 0, 0, la)},
	}
}

func TestStoreCalendarDay(t *testing.T) {
	for _, pg := range []bool{false, true} {
		for i, tc := range calendarCases(t) {
			t.Run(fmt.Sprintf("pg=%t/%s", pg, tc.name), func(t *testing.T) {
				ctx := context.Background()
				var store Store = NewMemStore()
				if pg {
					pool := openShopTestDB(t)
					applyShopSchema(t, pool)
					store = NewPGStore(pool)
				}
				server := int32(60 + i)
				check := func(limit PurchaseLimitType, at time.Time, want int32) {
					t.Helper()
					got, err := store.PurchasedCount(ctx, server, 88, 1001, limit, at)
					if err != nil || got != want {
						t.Fatalf("at=%s limit=%d count=%d want=%d err=%v", at, limit, got, want, err)
					}
				}
				check(PurchaseLimitDaily, tc.now, 0)
				if err := store.BumpCounter(ctx, server, 88, 1001, 2, PurchaseLimitDaily, tc.now); err != nil {
					t.Fatal(err)
				}
				if pg {
					old := store.(*PGStore)
					var date time.Time
					var count int32
					if err := old.Pool.QueryRow(ctx, `SELECT daily_period, daily_bought FROM player_shop_offer_counter WHERE server_id=$1 AND player_id=88 AND offer_cfg_id=1001`, server).Scan(&date, &count); err != nil {
						t.Fatal(err)
					}
					t.Logf("clock=%s persisted date=%s count=%d", tc.now.Format(time.RFC3339), date.Format(time.RFC3339), count)
					if date.Format("2006-01-02") != tc.now.Format("2006-01-02") || count != 2 {
						t.Fatalf("unexpected persisted date/count: %s/%d", date, count)
					}
					old.Pool.Close()
					store = NewPGStore(openShopTestDB(t)) // genuinely new pool, not only a wrapper
				}
				check(PurchaseLimitDaily, tc.now, 2)
				y, m, d := tc.now.Date()
				next := time.Date(y, m, d+1, 0, 0, 0, 0, tc.now.Location())
				check(PurchaseLimitDaily, next.Add(-time.Nanosecond), 2)
				// A DATE is a civil label: changing the location representation alone
				// must not reset the same year/month/day, even across offset changes.
				check(PurchaseLimitDaily, time.Date(y, m, d, 12, 0, 0, 0, time.UTC), 2)
				check(PurchaseLimitLifetime, next.Add(-time.Nanosecond), 2)
				check(PurchaseLimitNone, next.Add(-time.Nanosecond), 0)
				check(PurchaseLimitDaily, next, 0)
				if err := store.BumpCounter(ctx, server, 88, 1001, 3, PurchaseLimitDaily, next); err != nil {
					t.Fatal(err)
				}
				check(PurchaseLimitDaily, next, 3)
				check(PurchaseLimitLifetime, next, 5)
				check(PurchaseLimitNone, next, 0)
				next = next.AddDate(0, 0, 1)
				for _, limit := range []PurchaseLimitType{PurchaseLimitLifetime, PurchaseLimitNone} {
					if err := store.BumpCounter(ctx, server, 88, 1001, 1, limit, next); err != nil {
						t.Fatal(err)
					}
				}
				check(PurchaseLimitLifetime, next, 7)
				check(PurchaseLimitDaily, next, 0)
				check(PurchaseLimitNone, next, 0)
			})
		}
	}
}

// PG cases commit SHOP participants only; memory cases retain non-atomic payment fixtures.
func TestCalendarCapSerialMemoryAndPGParticipant(t *testing.T) {
	for _, pg := range []bool{false, true} {
		for i, tc := range calendarCases(t) {
			t.Run(fmt.Sprintf("pg=%t/%s", pg, tc.name), func(t *testing.T) {
				var svc *Service
				var wallet *stubWallet
				if pg {
					pool := openShopTestDB(t)
					applyShopSchema(t, pool)
					cat := intentCatalog()
					cat.Offers[0].DailyLimit = ptr32(3)
					cat.Offers[0].Price.Resources = map[string]int64{"gold": 10}
					svc = NewService(cat, NewPGStore(pool), nil, nil)
				} else {
					svc, wallet = testShop(t)
				}
				now := tc.now
				svc.now = func() time.Time { return now }
				server := int32(70 + i)
				player := content.PlayerRef{ServerID: server, PlayerID: 42}
				if !pg {
					wallet.seed(player, content.ResourceWallet{Gold: 100})
				}
				purchase := func(wantGold int64) (Offer, error) {
					if pg {
						return commitShopParticipant(t, svc, player, 1001, 1)
					}
					offer, _, after, err := svc.Purchase(server, 42, 1001, 1)
					if err == nil && after.Gold != wantGold {
						t.Fatalf("memory wallet=%+v want gold=%d", after, wantGold)
					}
					return offer, err
				}
				for n := int32(1); n <= 3; n++ {
					offer, err := purchase(100 - int64(n)*10)
					if err != nil || offer.PurchasedCount != n {
						t.Fatalf("buy=%d offer=%+v err=%v", n, offer, err)
					}
				}
				if pg {
					svc.store.(*PGStore).Pool.Close()
					svc = NewService(svc.catalog, NewPGStore(openShopTestDB(t)), nil, nil)
					svc.now = func() time.Time { return now }
				}
				y, m, d := now.Date()
				next := time.Date(y, m, d+1, 0, 0, 0, 0, now.Location())
				if tc.name == "DST_spring" && next.Sub(startOfDay(now)) != 23*time.Hour {
					t.Fatal("expected 23-hour spring day")
				}
				if tc.name == "DST_fall" && next.Sub(startOfDay(now)) != 25*time.Hour {
					t.Fatal("expected 25-hour fall day")
				}
				checkOffer := func(count int32, soldOut bool) {
					t.Helper()
					offers, _, err := svc.ListShopShelf(server, 1, 42)
					if err != nil || len(offers) != 1 || offers[0].PurchasedCount != count || offers[0].SoldOut != soldOut || offers[0].LimitResetsAtMs != next.UnixMilli() {
						t.Fatalf("offers=%+v want count=%d soldOut=%t reset=%s err=%v", offers, count, soldOut, next, err)
					}
				}
				checkOffer(3, true)
				now = next.Add(-time.Nanosecond)
				checkOffer(3, true)
				if _, err := purchase(0); !errors.Is(err, ErrPurchaseLimitExceeded) {
					t.Fatalf("cap err=%v", err)
				}
				if pg {
					checkShopParticipantRows(t, svc, player, 3, 3, 3, tc.now)
				} else {
					qty, err := svc.payments.svc.Get(player, 2001)
					if err != nil || qty != 3 || wallet.balances[player].Gold != 70 {
						t.Fatalf("rejected buy mutated balance/grant: qty=%d gold=%d err=%v", qty, wallet.balances[player].Gold, err)
					}
				}
				now = next
				next = next.AddDate(0, 0, 1)
				checkOffer(0, false)
				offer, err := purchase(60)
				if err != nil || offer.PurchasedCount != 1 || offer.LimitResetsAtMs != next.UnixMilli() {
					t.Fatalf("next day offer=%+v err=%v", offer, err)
				}
				if pg {
					checkShopParticipantRows(t, svc, player, 4, 4, 1, now)
				}
			})
		}
	}
}

func TestCalendarDayIsNotInstantEquality(t *testing.T) {
	a := time.Date(2026, 10, 25, 0, 30, 0, 0, time.FixedZone("CST", 8*3600))
	if sameCalendarDay(a, a.UTC()) {
		t.Fatal("same instant has different civil dates")
	}
	b := time.Date(2026, 10, 25, 12, 0, 0, 0, time.FixedZone("PDT", -7*3600))
	if !sameCalendarDay(a, b) {
		t.Fatal("same civil date has different instants")
	}
}
