package shop

import (
	"errors"
	"math"
	"sort"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidPurchase             = errors.New("shop: invalid purchase configuration or actor")
	ErrPurchaseOverflow            = errors.New("shop: purchase arithmetic overflow")
	ErrPurchaseTransactionRequired = errors.New("shop: matching purchase transaction required")
)

// PurchaseIntent is an immutable, server-derived quote, not permission to spend.
// Prepare it before beginning a transaction; caps/stock are checked after locks.
type PurchaseIntent struct{ data *purchaseIntent }
type purchaseIntent struct {
	service *Service
	player  content.PlayerRef
	entry   CatalogEntry
	count   int32
	cost    content.RewardPackage
	wallet  content.ResourceWallet
	items   []content.Stack
	reward  content.RewardPackage
}

// UsesPurchaseStore checks exact provenance, not merely a capability boolean.
func (s *Service) UsesPurchaseStore(store *PGStore, pool *pgxpool.Pool) bool {
	return s != nil && store != nil && pool != nil && s.store == store && store.Pool == pool
}

func (s *Service) PreparePurchase(player content.PlayerRef, offerID, count int32) (PurchaseIntent, error) {
	if count <= 0 {
		return PurchaseIntent{}, ErrInvalidPurchaseCount
	}
	if s == nil || player.ServerID <= 0 || player.PlayerID <= 0 {
		return PurchaseIntent{}, ErrInvalidPurchase
	}
	e, ok := s.entry(offerID)
	if !ok {
		return PurchaseIntent{}, ErrOfferNotFound
	}
	matches := 0
	for _, row := range s.catalog.Offers {
		if row.OfferID == offerID {
			matches++
		}
	}
	if matches != 1 || e.OfferID <= 0 || e.ShelfID <= 0 || e.ItemCfgID <= 0 || e.QuantityPerPurchase <= 0 {
		return PurchaseIntent{}, ErrInvalidPurchase
	}
	for _, limit := range []*int32{e.ServerStockLimit, e.DailyLimit, e.TotalLimit} {
		if limit != nil && *limit < 0 {
			return PurchaseIntent{}, ErrInvalidPurchase
		}
	}
	cost, wallet, items, err := checkedCost(e.Price, count)
	if err != nil {
		return PurchaseIntent{}, err
	}
	qty := int64(e.QuantityPerPurchase) * int64(count)
	if qty > math.MaxInt32 {
		return PurchaseIntent{}, ErrPurchaseOverflow
	}
	return PurchaseIntent{&purchaseIntent{service: s, player: player, entry: cloneEntry(e), count: count,
		cost: cost, wallet: wallet, items: items,
		reward: content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: e.ItemCfgID, Qty: int32(qty)}}}}}, nil
}

func checkedCost(price content.RewardPackage, count int32) (content.RewardPackage, content.ResourceWallet, []content.Stack, error) {
	out := content.RewardPackage{Resources: make(map[string]int64, len(price.Resources))}
	var wallet content.ResourceWallet
	fields := map[string]*int64{"food": &wallet.Food, "wood": &wallet.Wood, "iron": &wallet.Iron, "stone": &wallet.Stone, "gold": &wallet.Gold, "silver": &wallet.Gold}
	for name, n := range price.Resources {
		dst, ok := fields[name]
		if !ok || n < 0 {
			return out, wallet, nil, ErrInvalidPurchase
		}
		if n > math.MaxInt64/int64(count) {
			return out, wallet, nil, ErrPurchaseOverflow
		}
		scaled := n * int64(count)
		if scaled > math.MaxInt64-*dst {
			return out, wallet, nil, ErrPurchaseOverflow
		}
		*dst += scaled
		out.Resources[name] = scaled
	}
	totals := make(map[int32]int64, len(price.Items))
	for _, row := range price.Items {
		if row.ItemCfgID <= 0 || row.Qty <= 0 {
			return out, wallet, nil, ErrInvalidPurchase
		}
		qty := int64(row.Qty) * int64(count)
		if qty > math.MaxInt32-totals[row.ItemCfgID] {
			return out, wallet, nil, ErrPurchaseOverflow
		}
		totals[row.ItemCfgID] += qty
	}
	items := make([]content.Stack, 0, len(totals))
	for id, qty := range totals {
		items = append(items, content.Stack{ItemCfgID: id, Quantity: int32(qty)})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ItemCfgID < items[j].ItemCfgID })
	for _, item := range items {
		out.Items = append(out.Items, content.RewardItem{ItemCfgID: item.ItemCfgID, Qty: item.Quantity})
	}
	return out, wallet, items, nil
}

func cloneEntry(e CatalogEntry) CatalogEntry {
	e.Price = clonePackage(e.Price)
	for _, ptr := range []**int32{&e.ServerStockLimit, &e.DailyLimit, &e.TotalLimit} {
		if *ptr != nil {
			n := **ptr
			*ptr = &n
		}
	}
	return e
}
func clonePackage(p content.RewardPackage) content.RewardPackage {
	if p.Resources != nil {
		resources := make(map[string]int64, len(p.Resources))
		for k, v := range p.Resources {
			resources[k] = v
		}
		p.Resources = resources
	}
	if p.Items != nil {
		p.Items = append([]content.RewardItem{}, p.Items...)
	}
	return p
}
func cloneCatalog(cat Catalog) Catalog {
	cat.Offers = append([]CatalogEntry(nil), cat.Offers...)
	for i := range cat.Offers {
		cat.Offers[i] = cloneEntry(cat.Offers[i])
	}
	return cat
}
