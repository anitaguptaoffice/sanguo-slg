package shop

import (
	"context"
	"time"
)

// ListShopShelfContext never turns failed stock/counter reads into a successful
// empty/zero view. On error it returns no partial list; use the request context.
func (s *Service) ListShopShelfContext(ctx context.Context, serverID, shelfID int32, playerID int64) ([]Offer, int64, error) {
	if err := ctx.Err(); err != nil {
		return nil, 0, err
	}
	if s == nil || s.store == nil {
		return nil, 0, ErrPurchaseTransactionRequired
	}
	at := s.now()
	out := make([]Offer, 0, len(s.catalog.Offers))
	for _, e := range s.catalog.Offers {
		if shelfID != 0 && e.ShelfID != shelfID {
			continue
		}
		view, err := s.viewOfferContext(ctx, serverID, playerID, e, at)
		if err != nil {
			return nil, s.catalog.Version, err
		}
		out = append(out, view)
	}
	if err := ctx.Err(); err != nil {
		return nil, s.catalog.Version, err
	}
	return out, s.catalog.Version, nil
}
func (s *Service) viewOfferContext(ctx context.Context, serverID int32, playerID int64, e CatalogEntry, at time.Time) (Offer, error) {
	if err := ctx.Err(); err != nil {
		return Offer{}, err
	}
	remaining, err := s.store.StockRemaining(ctx, serverID, e.OfferID, stockTotal(e))
	if err != nil {
		return Offer{}, err
	}
	if err = ctx.Err(); err != nil {
		return Offer{}, err
	}
	kind, _ := limitMeta(e)
	purchased, err := s.store.PurchasedCount(ctx, serverID, playerID, e.OfferID, kind, at)
	if err != nil {
		return Offer{}, err
	}
	if err = ctx.Err(); err != nil {
		return Offer{}, err
	}
	return offerFromFacts(e, remaining, purchased, at), nil
}
