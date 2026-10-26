package shop

import (
	"errors"
	"math"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func TestPurchasePlanCountersAndStock(t *testing.T) {
	today := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name                string
		daily, total, stock *int32
		state               purchaseState
		want                error
		count, remaining    int32
	}{
		{"daily precedence", ptr32(3), ptr32(1), nil, purchaseState{total: 9, daily: 2, period: today}, nil, 3, -1},
		{"daily cap", ptr32(3), nil, nil, purchaseState{daily: 3, period: today}, ErrPurchaseLimitExceeded, 0, 0},
		{"stale day", ptr32(3), nil, nil, purchaseState{daily: 3, period: today.AddDate(0, 0, -1)}, nil, 1, -1},
		{"lifetime cap", nil, ptr32(3), nil, purchaseState{total: 3}, ErrPurchaseLimitExceeded, 0, 0},
		{"no limit", nil, nil, nil, purchaseState{total: 4, daily: 4, period: today}, nil, 0, -1},
		{"last stock", nil, nil, ptr32(3), purchaseState{sold: 2}, nil, 0, 0},
		{"wide sold", nil, nil, ptr32(3), purchaseState{sold: math.MaxInt64}, ErrSoldOut, 0, 0},
		{"total exhaustion", nil, nil, nil, purchaseState{total: math.MaxInt32}, ErrPurchaseOverflow, 0, 0},
		{"daily exhaustion", ptr32(0), nil, nil, purchaseState{daily: math.MaxInt32, period: today}, ErrPurchaseOverflow, 0, 0},
		{"negative state", nil, nil, nil, purchaseState{total: -1}, ErrInvalidPurchase, 0, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cat := intentCatalog()
			cat.Offers[0].DailyLimit = tt.daily
			cat.Offers[0].TotalLimit = tt.total
			cat.Offers[0].ServerStockLimit = tt.stock
			svc := NewService(cat, nil, nil, nil)
			svc.now = func() time.Time { return today }
			in, err := svc.PreparePurchase(content.PlayerRef{ServerID: 1, PlayerID: 2}, 1001, 1)
			if err != nil {
				t.Fatal(err)
			}
			tt.state.intent = in.data
			p, err := svc.PlanPurchase(in, PurchaseState{&tt.state})
			if !errors.Is(err, tt.want) {
				t.Fatalf("err=%v want=%v", err, tt.want)
			}
			if err == nil && (p.Offer().PurchasedCount != tt.count || p.Offer().StockRemaining != tt.remaining || p.total != tt.state.total+1) {
				t.Fatalf("plan=%+v", p)
			}
		})
	}
}
func ptr32(v int32) *int32 { return &v }

func TestPurchasePlanCivilClockAndCopies(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	for _, date := range []time.Time{time.Date(2026, 3, 8, 0, 0, 0, 0, ny), time.Date(2026, 11, 1, 0, 0, 0, 0, ny), time.Date(2026, 3, 15, 0, 0, 0, 0, time.FixedZone("east", 8*3600)), time.Date(2026, 3, 15, 0, 0, 0, 0, time.FixedZone("west", -8*3600))} {
		cat := intentCatalog()
		cat.Offers[0].DailyLimit = ptr32(3)
		cat.Offers[0].Price.Items = []content.RewardItem{{ItemCfgID: 2, Qty: 1}}
		svc := NewService(cat, nil, nil, nil)
		samples := 0
		svc.now = func() time.Time { samples++; return date }
		in, _ := svc.PreparePurchase(content.PlayerRef{ServerID: 1, PlayerID: 2}, 1001, 1)
		y, m, d := date.Date()
		st := PurchaseState{&purchaseState{intent: in.data, total: 2, daily: 2, period: time.Date(y, m, d, 0, 0, 0, 0, time.UTC)}}
		p, err := svc.PlanPurchase(in, st)
		if err != nil {
			t.Fatal(err)
		}
		if samples != 1 || p.Offer().PurchasedCount != 3 || p.Offer().LimitResetsAtMs != date.AddDate(0, 0, 1).UnixMilli() {
			t.Fatalf("calendar=%+v samples=%d", p, samples)
		}
		p.ItemCosts()[0].Quantity = 99
		p.Reward().Items[0].Qty = 99
		p.Offer().PriceItems[0].Qty = 99
		if p.ItemCosts()[0].Quantity != 1 || p.Reward().Items[0].Qty != 1 || p.Offer().PriceItems[0].Qty != 1 {
			t.Fatal("mutable plan")
		}
		if p.Player() != in.data.player || p.OfferID() != 1001 || p.Count() != 1 || p.DecisionTime() != date {
			t.Fatal("plan metadata")
		}
		if _, err = NewService(cat, nil, nil, nil).PlanPurchase(in, st); !errors.Is(err, ErrPurchaseTransactionRequired) {
			t.Fatal(err)
		}
	}
}
