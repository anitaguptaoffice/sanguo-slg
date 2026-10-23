package shop

import (
	"context"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrOfferNotFound         = errors.New("shop: offer not found")
	ErrInvalidPurchaseCount  = errors.New("shop: purchase_count must be positive")
	ErrInsufficientBalance   = errors.New("shop: insufficient resources")
	ErrInsufficientItems     = errors.New("shop: insufficient item currency")
	ErrPurchaseLimitExceeded = errors.New("shop: purchase limit exceeded")
	ErrSoldOut               = errors.New("shop: offer sold out")
)

type PurchaseLimitType int32

const (
	PurchaseLimitNone     PurchaseLimitType = 1
	PurchaseLimitDaily    PurchaseLimitType = 2
	PurchaseLimitLifetime PurchaseLimitType = 4
)

type Offer struct {
	OfferID, ShelfID, SortOrder, ItemCfgID, QuantityPerPurchase int32
	ShelfName                                                 string
	PriceResources                                            content.ResourceWallet
	PriceItems                                                []content.RewardItem
	StockTotal, StockRemaining, PurchaseLimit, PurchasedCount int32
	LimitType                                                 PurchaseLimitType
	LimitResetsAtMs                                           int64
	SoldOut                                                   bool
}

type CatalogEntry struct {
	OfferID, ShelfID, SortOrder, ItemCfgID, QuantityPerPurchase int32
	ShelfName string
	Price     content.RewardPackage
	ServerStockLimit, DailyLimit, TotalLimit *int32
}

type Catalog struct {
	Version int64
	Offers  []CatalogEntry
}

type Service struct {
	catalog  Catalog
	store    Store
	payments *Payments
	now      func() time.Time
}

// NewService wires catalog, persistence, and payments. When store is nil, PostgreSQL is used
// if pool is non-nil (production default from SHOP-001); pass NewMemStore() explicitly in unit tests.
func NewService(cat Catalog, store Store, payments *Payments, pool *pgxpool.Pool) *Service {
	if store == nil {
		if pool != nil {
			store = NewPGStore(pool)
		} else {
			store = NewMemStore()
		}
	}
	return &Service{catalog: cat, store: store, payments: payments, now: time.Now}
}

func (s *Service) ListShopShelf(serverID int32, shelfID int32, playerID int64) ([]Offer, int64, error) {
	ctx := context.Background()
	now := s.now()
	out := make([]Offer, 0, len(s.catalog.Offers))
	for _, e := range s.catalog.Offers {
		if shelfID != 0 && e.ShelfID != shelfID {
			continue
		}
		out = append(out, s.viewOffer(ctx, serverID, playerID, e, now))
	}
	return out, s.catalog.Version, nil
}

func (s *Service) Purchase(serverID int32, playerID int64, offerID int32, count int32) (Offer, []content.RewardItem, content.ResourceWallet, error) {
	if count <= 0 {
		return Offer{}, nil, content.ResourceWallet{}, ErrInvalidPurchaseCount
	}
	entry, ok := s.entry(offerID)
	if !ok {
		return Offer{}, nil, content.ResourceWallet{}, ErrOfferNotFound
	}
	ctx := context.Background()
	now := s.now()
	limitType, limit := limitMeta(entry)
	purchased, err := s.store.PurchasedCount(ctx, serverID, playerID, offerID, limitType, now)
	if err != nil {
		return Offer{}, nil, content.ResourceWallet{}, err
	}
	if limit > 0 && purchased+count > limit {
		return Offer{}, nil, content.ResourceWallet{}, ErrPurchaseLimitExceeded
	}
	total := stockTotal(entry)
	if total >= 0 {
		rem, err := s.store.StockRemaining(ctx, serverID, offerID, total)
		if err != nil {
			return Offer{}, nil, content.ResourceWallet{}, err
		}
		if rem < count {
			return Offer{}, nil, content.ResourceWallet{}, ErrSoldOut
		}
	}
	player := content.PlayerRef{ServerID: serverID, PlayerID: playerID}
	walletAfter, err := s.payments.spendResources(player, scaleWallet(priceWallet(entry.Price), count))
	if err != nil {
		return Offer{}, nil, content.ResourceWallet{}, err
	}
	if err := s.payments.spendItems(player, scaleItems(entry.Price.Items, count)); err != nil {
		return Offer{}, nil, content.ResourceWallet{}, err
	}
	if err := s.store.TakeStock(ctx, serverID, playerID, offerID, total, count); err != nil {
		return Offer{}, nil, content.ResourceWallet{}, err
	}
	grant := content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: entry.ItemCfgID, Qty: entry.QuantityPerPurchase * count}}}
	if _, err := s.payments.svc.Grant(player, grant, ""); err != nil {
		return Offer{}, nil, content.ResourceWallet{}, err
	}
	if err := s.store.BumpCounter(ctx, serverID, playerID, offerID, count, limitType, now); err != nil {
		return Offer{}, nil, content.ResourceWallet{}, err
	}
	return s.viewOffer(ctx, serverID, playerID, entry, now), grant.Items, walletAfter, nil
}

func (s *Service) entry(offerID int32) (CatalogEntry, bool) {
	for _, e := range s.catalog.Offers {
		if e.OfferID == offerID {
			return e, true
		}
	}
	return CatalogEntry{}, false
}

func (s *Service) viewOffer(ctx context.Context, serverID int32, playerID int64, e CatalogEntry, now time.Time) Offer {
	limitType, limit := limitMeta(e)
	total := stockTotal(e)
	rem, _ := s.store.StockRemaining(ctx, serverID, e.OfferID, total)
	purchased, _ := s.store.PurchasedCount(ctx, serverID, playerID, e.OfferID, limitType, now)
	var resetMs int64
	if limitType == PurchaseLimitDaily {
		resetMs = startOfDay(now).AddDate(0, 0, 1).UnixMilli()
	}
	return Offer{
		OfferID: e.OfferID, ShelfID: e.ShelfID, ShelfName: e.ShelfName, SortOrder: e.SortOrder,
		ItemCfgID: e.ItemCfgID, QuantityPerPurchase: e.QuantityPerPurchase,
		PriceResources: priceWallet(e.Price), PriceItems: e.Price.Items,
		StockTotal: total, StockRemaining: rem, LimitType: limitType, PurchaseLimit: limit,
		PurchasedCount: purchased, LimitResetsAtMs: resetMs,
		SoldOut: rem == 0 || (limit > 0 && purchased >= limit),
	}
}

func limitMeta(e CatalogEntry) (PurchaseLimitType, int32) {
	if e.DailyLimit != nil {
		return PurchaseLimitDaily, *e.DailyLimit
	}
	if e.TotalLimit != nil {
		return PurchaseLimitLifetime, *e.TotalLimit
	}
	return PurchaseLimitNone, 0
}

func stockTotal(e CatalogEntry) int32 {
	if e.ServerStockLimit == nil {
		return -1
	}
	return *e.ServerStockLimit
}
