package shop

import (
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func testShop(t *testing.T) (*Service, *content.Service) {
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	daily := int32(3)
	shopCat := Catalog{Version: 1, Offers: []CatalogEntry{{
		OfferID: 1001, ShelfID: 1, ShelfName: "每日特惠", ItemCfgID: 2001, QuantityPerPurchase: 1,
		Price: content.RewardPackage{Resources: map[string]int64{"gold": 10}}, DailyLimit: &daily,
	}}}
	return NewService(shopCat, NewMemStore(), NewPayments(contentSvc)), contentSvc
}

func TestPurchaseSuccessDebitsAndGrants(t *testing.T) {
	svc, contentSvc := testShop(t)
	p := content.PlayerRef{ServerID: 1, PlayerID: 42}
	_, err := contentSvc.Grant(p, content.RewardPackage{Resources: map[string]int64{"gold": 100}}, "")
	if err != nil {
		t.Fatal(err)
	}
	_, _, wallet, err := svc.Purchase(1, 42, 1001, 1)
	if err != nil || wallet.Gold != 90 {
		t.Fatalf("err=%v wallet=%+v", err, wallet)
	}
	qty, _ := contentSvc.Get(p, 2001)
	if qty != 1 {
		t.Fatalf("qty %d", qty)
	}
}

func TestPurchaseInsufficientBalance(t *testing.T) {
	svc, _ := testShop(t)
	_, _, _, err := svc.Purchase(1, 7, 1001, 1)
	if !errors.Is(err, ErrInsufficientBalance) {
		t.Fatalf("got %v", err)
	}
}

func TestPurchaseLimitExceeded(t *testing.T) {
	svc, contentSvc := testShop(t)
	p := content.PlayerRef{ServerID: 1, PlayerID: 99}
	_, _ = contentSvc.Grant(p, content.RewardPackage{Resources: map[string]int64{"gold": 1000}}, "")
	for i := 0; i < 3; i++ {
		if _, _, _, err := svc.Purchase(1, 99, 1001, 1); err != nil {
			t.Fatalf("buy %d: %v", i, err)
		}
	}
	if _, _, _, err := svc.Purchase(1, 99, 1001, 1); !errors.Is(err, ErrPurchaseLimitExceeded) {
		t.Fatalf("got %v", err)
	}
}
