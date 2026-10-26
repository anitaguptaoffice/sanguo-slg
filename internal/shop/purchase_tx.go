package shop

import (
	"context"
	"encoding/json"
	"errors"
	"math"

	"github.com/jackc/pgx/v5"
)

// Dedicated negative first key cannot collide with positive (server, offer)
// stock keys, or the positive PLAY and CITY creation namespaces.
const purchaseAllocatorNamespace int32 = -1397247824

// LockPurchaseStateInTx uses ONLY tx. Caller owns actor, existing wallet, then
// sorted item locks before entering, even for free/unlimited offers. The wallet
// serializes absent counter rows. Any error requires rollback by the caller.
func (p *PGStore) LockPurchaseStateInTx(ctx context.Context, tx pgx.Tx, intent PurchaseIntent) (PurchaseState, error) {
	in := intent.data
	if tx == nil || p == nil || p.Pool == nil || in == nil || in.service.store != p {
		return PurchaseState{}, ErrPurchaseTransactionRequired
	}
	st := &purchaseState{intent: in, store: p, tx: tx}
	if err := ctx.Err(); err != nil {
		return PurchaseState{}, err
	}
	if stockTotal(in.entry) >= 0 {
		if err := lockOfferInTx(ctx, tx, in.player.ServerID, in.entry.OfferID); err != nil {
			return PurchaseState{}, err
		}
		sold, err := soldQuantityInTx(ctx, tx, in.player.ServerID, in.entry.OfferID)
		if err != nil {
			return PurchaseState{}, err
		}
		st.sold = sold
	}
	err := tx.QueryRow(ctx, `SELECT total_bought,daily_bought,daily_period FROM player_shop_offer_counter
  WHERE server_id=$1 AND player_id=$2 AND offer_cfg_id=$3 FOR UPDATE`, in.player.ServerID, in.player.PlayerID, in.entry.OfferID).Scan(&st.total, &st.daily, &st.period)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return PurchaseState{}, err
	}
	return PurchaseState{st}, nil
}

// RecordPurchaseInTx stages a ledger row for EVERY purchase (including unlimited)
// and the checked counters. It never begins/finishes a tx, calls Pool, or enters a
// shared cache. Roll back on ANY error; never replay after an uncertain commit.
func (p *PGStore) RecordPurchaseInTx(ctx context.Context, tx pgx.Tx, plan PurchasePlan) (int64, error) {
	in, st := plan.intent, plan.state
	if tx == nil || p == nil || p.Pool == nil || in == nil || st == nil || st.intent != in || st.store != p || st.tx != tx || st.recorded || in.service.store != p {
		return 0, ErrPurchaseTransactionRequired
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	st.recorded = true // An error consumes this state too: caller must roll back.
	id, err := nextPurchaseIDInTx(ctx, tx, in.player.ServerID)
	if err != nil {
		return 0, err
	}
	cost, err := json.Marshal(in.cost)
	if err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO player_shop_purchase
  (server_id,purchase_id,player_id,offer_cfg_id,quantity,cost_snapshot,created_at)
  VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`, in.player.ServerID, id, in.player.PlayerID, in.entry.OfferID, in.count, cost, plan.at); err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO player_shop_offer_counter
  (server_id,player_id,offer_cfg_id,total_bought,daily_bought,daily_period,updated_at)
  VALUES($1,$2,$3,$4,$5,$6::date,$7)
  ON CONFLICT(server_id,player_id,offer_cfg_id) DO UPDATE SET
   total_bought=EXCLUDED.total_bought,daily_bought=EXCLUDED.daily_bought,
   daily_period=EXCLUDED.daily_period,updated_at=EXCLUDED.updated_at`,
		in.player.ServerID, in.player.PlayerID, in.entry.OfferID, plan.total, plan.daily, plan.at.Format("2006-01-02"), plan.at)
	return id, err
}

func lockOfferInTx(ctx context.Context, tx pgx.Tx, server, offer int32) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer, $2::integer)`, server, offer)
	return err
}
func soldQuantityInTx(ctx context.Context, tx pgx.Tx, server, offer int32) (int64, error) {
	var sold int64
	err := tx.QueryRow(ctx, `SELECT COALESCE(SUM(quantity),0)::bigint FROM player_shop_purchase WHERE server_id=$1 AND offer_cfg_id=$2`, server, offer).Scan(&sold)
	return sold, err
}
func nextPurchaseIDInTx(ctx context.Context, tx pgx.Tx, server int32) (int64, error) {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer, $2::integer)`, purchaseAllocatorNamespace, server); err != nil {
		return 0, err
	}
	var high int64
	if err := tx.QueryRow(ctx, `SELECT GREATEST(COALESCE(MAX(purchase_id),0),0) FROM player_shop_purchase WHERE server_id=$1`, server).Scan(&high); err != nil {
		return 0, err
	}
	if high == math.MaxInt64 {
		return 0, ErrPurchaseOverflow
	}
	return high + 1, nil
}
