package shop

import (
	"errors"
	"math"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func intentCatalog() Catalog {
	return Catalog{Version: 1, Offers: []CatalogEntry{{OfferID: 1001, ShelfID: 1, ItemCfgID: 2001, QuantityPerPurchase: 1}}}
}
func TestPreparePurchaseCheckedArithmetic(t *testing.T) {
	tests := []struct {
		name  string
		edit  func(*CatalogEntry)
		count int32
		want  error
	}{
		{"unknown resource", func(e *CatalogEntry) { e.Price.Resources = map[string]int64{"copper": 1} }, 1, ErrInvalidPurchase},
		{"negative resource", func(e *CatalogEntry) { e.Price.Resources = map[string]int64{"gold": -1} }, 1, ErrInvalidPurchase},
		{"alias overflow", func(e *CatalogEntry) { e.Price.Resources = map[string]int64{"gold": math.MaxInt64, "silver": 1} }, 1, ErrPurchaseOverflow},
		{"cost product", func(e *CatalogEntry) { e.Price.Resources = map[string]int64{"food": math.MaxInt64} }, 2, ErrPurchaseOverflow},
		{"reward product", func(e *CatalogEntry) { e.QuantityPerPurchase = math.MaxInt32 }, 2, ErrPurchaseOverflow},
		{"item product", func(e *CatalogEntry) { e.Price.Items = []content.RewardItem{{ItemCfgID: 1, Qty: math.MaxInt32}} }, 2, ErrPurchaseOverflow},
		{"item sum", func(e *CatalogEntry) {
			e.Price.Items = []content.RewardItem{{ItemCfgID: 1, Qty: math.MaxInt32}, {ItemCfgID: 1, Qty: 1}}
		}, 1, ErrPurchaseOverflow},
		{"invalid item", func(e *CatalogEntry) { e.Price.Items = []content.RewardItem{{ItemCfgID: 0, Qty: 1}} }, 1, ErrInvalidPurchase},
		{"zero qty", func(e *CatalogEntry) { e.Price.Items = []content.RewardItem{{ItemCfgID: 1}} }, 1, ErrInvalidPurchase},
		{"negative limit", func(e *CatalogEntry) { v := int32(-1); e.DailyLimit = &v }, 1, ErrInvalidPurchase},
		{"zero count", func(e *CatalogEntry) {}, 0, ErrInvalidPurchaseCount},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cat := intentCatalog()
			tt.edit(&cat.Offers[0])
			svc := NewService(cat, NewMemStore(), nil, nil)
			if _, err := svc.PreparePurchase(content.PlayerRef{ServerID: 1, PlayerID: 2}, 1001, tt.count); !errors.Is(err, tt.want) {
				t.Fatalf("got %v want %v", err, tt.want)
			}
		})
	}
}
func TestPreparePurchaseBoundCatalogAndCosts(t *testing.T) {
	cat := intentCatalog()
	e := &cat.Offers[0]
	daily := int32(3)
	e.DailyLimit = &daily
	e.Price = content.RewardPackage{Resources: map[string]int64{"gold": 3, "silver": 7}, Items: []content.RewardItem{{ItemCfgID: 9, Qty: 2}, {ItemCfgID: 2, Qty: 1}, {ItemCfgID: 9, Qty: 3}}}
	svc := NewService(cat, NewMemStore(), nil, nil)
	e.Price.Resources["silver"] = 99
	e.Price.Items[0].Qty = 99
	daily = 99
	in, err := svc.PreparePurchase(content.PlayerRef{ServerID: 1, PlayerID: 2}, 1001, 2)
	if err != nil {
		t.Fatal(err)
	}
	if in.data.wallet.Gold != 20 || in.data.cost.Resources["silver"] != 14 || in.data.items[0].ItemCfgID != 2 || in.data.items[1].Quantity != 10 || *in.data.entry.DailyLimit != 3 {
		t.Fatalf("bad bound quote: %+v", in.data)
	}
	if _, err = svc.PreparePurchase(content.PlayerRef{}, 1001, 1); !errors.Is(err, ErrInvalidPurchase) {
		t.Fatal(err)
	}
	if _, err = svc.PreparePurchase(content.PlayerRef{ServerID: 1, PlayerID: 2}, 9999, 1); !errors.Is(err, ErrOfferNotFound) {
		t.Fatal(err)
	}
	cat.Offers = append(cat.Offers, cat.Offers[0])
	if _, err = NewService(cat, nil, nil, nil).PreparePurchase(content.PlayerRef{ServerID: 1, PlayerID: 2}, 1001, 1); !errors.Is(err, ErrInvalidPurchase) {
		t.Fatal(err)
	}
}
