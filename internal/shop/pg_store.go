package shop

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists shop stock (via player_shop_purchase aggregates) and player_shop_offer_counter.
type PGStore struct {
	Pool *pgxpool.Pool
}

// NewPGStore wraps a PostgreSQL pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore {
	return &PGStore{Pool: pool}
}

func (p *PGStore) StockRemaining(ctx context.Context, serverID, offerID, total int32) (int32, error) {
	if total < 0 {
		return -1, nil
	}
	sold, err := p.soldQuantity(ctx, serverID, offerID)
	if err != nil {
		return 0, err
	}
	return remainingStock(total, sold), nil
}

// TakeStock is a legacy stock-only wrapper, NOT an atomic purchase. It shares
// the allocator with transaction participants, including unlimited ledger rows.
func (p *PGStore) TakeStock(ctx context.Context, serverID int32, playerID int64, offerID, total, qty int32) error {
	if p == nil || p.Pool == nil {
		return ErrPurchaseTransactionRequired
	}
	if serverID <= 0 || playerID <= 0 || offerID <= 0 || total < -1 {
		return ErrInvalidPurchase
	}
	if qty <= 0 {
		return ErrInvalidPurchaseCount
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	if total >= 0 {
		if err := lockOfferInTx(ctx, tx, serverID, offerID); err != nil {
			return err
		}
		sold, err := soldQuantityInTx(ctx, tx, serverID, offerID)
		if err != nil {
			return err
		}
		if int64(qty) > int64(total)-sold {
			return ErrSoldOut
		}
	}
	purchaseID, err := nextPurchaseIDInTx(ctx, tx, serverID)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO player_shop_purchase
  (server_id,purchase_id,player_id,offer_cfg_id,quantity,cost_snapshot)
  VALUES($1,$2,$3,$4,$5,'{}'::jsonb)`, serverID, purchaseID, playerID, offerID, qty); err != nil {
		return err
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (p *PGStore) soldQuantity(ctx context.Context, serverID, offerID int32) (int64, error) {
	var sold int64
	err := p.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(quantity), 0)::bigint
		FROM player_shop_purchase
		WHERE server_id = $1 AND offer_cfg_id = $2`,
		serverID, offerID,
	).Scan(&sold)
	return sold, err
}

func (p *PGStore) PurchasedCount(ctx context.Context, serverID int32, playerID int64, offerID int32, limit PurchaseLimitType, now time.Time) (int32, error) {
	if limit == PurchaseLimitNone {
		return 0, nil
	}
	var totalBought, dailyBought int32
	var dailyPeriod time.Time
	err := p.Pool.QueryRow(ctx, `
		SELECT total_bought, daily_bought, daily_period
		FROM player_shop_offer_counter
		WHERE server_id = $1 AND player_id = $2 AND offer_cfg_id = $3`,
		serverID, playerID, offerID,
	).Scan(&totalBought, &dailyBought, &dailyPeriod)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	if limit == PurchaseLimitDaily {
		if !sameCalendarDay(dailyPeriod, now) {
			return 0, nil
		}
		return dailyBought, nil
	}
	return totalBought, nil
}

func (p *PGStore) BumpCounter(ctx context.Context, serverID int32, playerID int64, offerID, qty int32, limit PurchaseLimitType, now time.Time) error {
	day := startOfDay(now)
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO player_shop_offer_counter (
			server_id, player_id, offer_cfg_id, total_bought, daily_bought, daily_period, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6::date, $7)
		ON CONFLICT (server_id, player_id, offer_cfg_id) DO UPDATE SET
			total_bought = player_shop_offer_counter.total_bought + EXCLUDED.total_bought,
			daily_bought = CASE
				WHEN player_shop_offer_counter.daily_period = EXCLUDED.daily_period
				THEN player_shop_offer_counter.daily_bought + EXCLUDED.daily_bought
				ELSE EXCLUDED.daily_bought
			END,
			daily_period = EXCLUDED.daily_period,
			updated_at = EXCLUDED.updated_at`,
		serverID, playerID, offerID, qty, dailyBumpQty(limit, qty), day, now.UTC(),
	)
	return err
}

func dailyBumpQty(limit PurchaseLimitType, qty int32) int32 {
	if limit == PurchaseLimitDaily {
		return qty
	}
	return 0
}
