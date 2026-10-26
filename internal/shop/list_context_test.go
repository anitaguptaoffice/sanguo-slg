package shop

import (
	"context"
	"errors"
	"testing"
	"time"
)

type failingListStore struct {
	Store
	stockErr, countErr     error
	seen                   context.Context
	stockReads, countReads int
	cancel                 context.CancelFunc
}

func (s *failingListStore) StockRemaining(ctx context.Context, server, offer, total int32) (int32, error) {
	s.seen = ctx
	s.stockReads++
	if s.cancel != nil {
		s.cancel()
	}
	if s.stockErr != nil {
		return 0, s.stockErr
	}
	return s.Store.StockRemaining(ctx, server, offer, total)
}
func (s *failingListStore) PurchasedCount(ctx context.Context, server int32, player int64, offer int32, kind PurchaseLimitType, at time.Time) (int32, error) {
	s.countReads++
	if s.countErr != nil {
		return 0, s.countErr
	}
	return s.Store.PurchasedCount(ctx, server, player, offer, kind, at)
}
func TestListShopShelfContextPropagatesReads(t *testing.T) {
	boom := errors.New("read failed")
	for _, which := range []string{"stock", "counter", "wrapper"} {
		t.Run(which, func(t *testing.T) {
			store := &failingListStore{Store: NewMemStore()}
			if which == "stock" {
				store.stockErr = boom
			} else {
				store.countErr = boom
			}
			svc := NewService(intentCatalog(), store, nil, nil)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			offers, version, err := svc.ListShopShelfContext(ctx, 1, 0, 1)
			if which == "wrapper" {
				offers, version, err = svc.ListShopShelf(1, 0, 1)
			} else if store.seen != ctx {
				t.Fatal("context discarded")
			}
			if !errors.Is(err, boom) || offers != nil || version != 1 {
				t.Fatalf("offers=%v version=%d err=%v", offers, version, err)
			}
		})
	}
}
func TestListShopShelfContextCancellationAndViewCopies(t *testing.T) {
	store := &failingListStore{Store: NewMemStore()}
	cat := intentCatalog()
	cat.Offers[0].DailyLimit = ptr32(3)
	svc := NewService(cat, store, nil, nil)
	at := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return at }
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, _, err := svc.ListShopShelfContext(ctx, 1, 0, 1); !errors.Is(err, context.Canceled) || store.stockReads != 0 {
		t.Fatalf("err=%v reads=%d", err, store.stockReads)
	}
	ctx, cancel = context.WithCancel(context.Background())
	store.cancel = cancel
	if offers, _, err := svc.ListShopShelfContext(ctx, 1, 0, 1); !errors.Is(err, context.Canceled) || offers != nil || store.countReads != 0 {
		t.Fatalf("offers=%v err=%v reads=%d", offers, err, store.countReads)
	}
	store.cancel = nil
	offers, version, err := svc.ListShopShelfContext(context.Background(), 1, 1, 1)
	if err != nil || version != 1 || len(offers) != 1 || offers[0].StockRemaining != -1 || offers[0].LimitResetsAtMs != startOfDay(at).AddDate(0, 0, 1).UnixMilli() {
		t.Fatalf("offers=%v err=%v", offers, err)
	}
}
func TestPGListShopShelfContextReadFailure(t *testing.T) {
	pool := openShopTestDB(t)
	applyShopSchema(t, pool)
	cat := intentCatalog()
	cat.Offers[0].ServerStockLimit = ptr32(3)
	svc := NewService(cat, NewPGStore(pool), nil, nil)
	pool.Close()
	if offers, _, err := svc.ListShopShelfContext(context.Background(), 1, 0, 1); err == nil || offers != nil {
		t.Fatalf("offers=%v err=%v", offers, err)
	}
}
