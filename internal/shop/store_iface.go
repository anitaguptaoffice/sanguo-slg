package shop

import (
	"context"
	"time"
)

// Store persists server stock and per-player purchase limits (spec/db/m4_002_shop.sql).
type Store interface {
	StockRemaining(ctx context.Context, serverID int32, offerID int32, total int32) (int32, error)
	TakeStock(ctx context.Context, serverID int32, playerID int64, offerID int32, total int32, qty int32) error
	PurchasedCount(ctx context.Context, serverID int32, playerID int64, offerID int32, limit PurchaseLimitType, now time.Time) (int32, error)
	BumpCounter(ctx context.Context, serverID int32, playerID int64, offerID int32, qty int32, limit PurchaseLimitType, now time.Time) error
}
