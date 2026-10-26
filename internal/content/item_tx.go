package content

import (
	"context"
	"errors"
	"math"
	"sort"

	"github.com/jackc/pgx/v5"
)

var (
	ErrItemTransactionsUnsupported = errors.New("content: item transactions require a PG store and caller transaction")
	ErrInvalidPlayer               = errors.New("content: invalid player identity")
)

// SupportsItemTransactions reports whether this service has durable item ports.
// Wiring must use a transaction from the same database as the configured store.
func (s *Service) SupportsItemTransactions() bool {
	if s == nil {
		return false
	}
	p, ok := s.store.(*PGStore)
	return ok && p != nil && p.Pool != nil
}

// LoadBagInTx reads authoritative positive stacks, not the service cache. It
// locks wallet before items, including when the wallet or an item is absent.
// The caller owns commit/rollback and must not hold item locks before calling.
func (s *Service) LoadBagInTx(ctx context.Context, tx pgx.Tx, p PlayerRef) ([]Stack, error) {
	if !s.SupportsItemTransactions() || tx == nil {
		return nil, ErrItemTransactionsUnsupported
	}
	if err := lockItemWallet(ctx, tx, p); err != nil {
		return nil, err
	}
	return loadBagInTx(ctx, tx, p)
}

// DebitItemsInTx debits positive server-derived costs using only tx. Duplicate
// costs are summed, then applied in item ID order. Results contain actual
// remaining quantities, including zero, for affected items. On ANY error the
// caller must roll back its transaction; this method never publishes caches,
// starts/finishes a transaction, or uses the pool. Commit errors are not retried.
func (s *Service) DebitItemsInTx(ctx context.Context, tx pgx.Tx, p PlayerRef, costs []Stack) ([]Stack, error) {
	if !s.SupportsItemTransactions() || tx == nil {
		return nil, ErrItemTransactionsUnsupported
	}
	ordered, err := s.itemCosts(costs)
	if err != nil {
		return nil, err
	}
	return debitItemsInTx(ctx, tx, p, ordered)
}

func (s *Service) itemCosts(costs []Stack) ([]Stack, error) {
	totals := make(map[int32]int32, len(costs))
	for _, cost := range costs {
		if cost.Quantity <= 0 || int64(totals[cost.ItemCfgID])+int64(cost.Quantity) > math.MaxInt32 {
			return nil, ErrInvalidQuantity
		}
		if _, err := s.itemDef(cost.ItemCfgID); err != nil {
			return nil, err
		}
		totals[cost.ItemCfgID] += cost.Quantity
	}
	ordered := make([]Stack, 0, len(totals))
	for id, qty := range totals {
		ordered = append(ordered, Stack{ItemCfgID: id, Quantity: qty})
	}
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].ItemCfgID < ordered[j].ItemCfgID })
	return ordered, nil
}

// The wallet serializes absent/zero item creation as well as existing rows.
// This matches Grant and resource-pack Use; never take an item lock first.
func lockItemWallet(ctx context.Context, tx pgx.Tx, p PlayerRef) error {
	if p.ServerID <= 0 || p.PlayerID <= 0 {
		return ErrInvalidPlayer
	}
	if _, err := tx.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, p.ServerID, p.PlayerID); err != nil {
		return err
	}
	var locked int
	return tx.QueryRow(ctx, `SELECT 1 FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, p.ServerID, p.PlayerID).Scan(&locked)
}

func loadBagInTx(ctx context.Context, tx pgx.Tx, p PlayerRef) ([]Stack, error) {
	rows, err := tx.Query(ctx, `SELECT item_cfg_id,quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND quantity>0 ORDER BY item_cfg_id FOR UPDATE`, p.ServerID, p.PlayerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Stack
	for rows.Next() {
		var st Stack
		if err := rows.Scan(&st.ItemCfgID, &st.Quantity); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

func debitItemsInTx(ctx context.Context, tx pgx.Tx, p PlayerRef, costs []Stack) ([]Stack, error) {
	if err := lockItemWallet(ctx, tx, p); err != nil {
		return nil, err
	}
	out := make([]Stack, 0, len(costs))
	for _, cost := range costs {
		remaining := Stack{ItemCfgID: cost.ItemCfgID}
		err := tx.QueryRow(ctx, `UPDATE player_item SET quantity=quantity-$4 WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=$3 AND quantity>=$4 RETURNING quantity`, p.ServerID, p.PlayerID, cost.ItemCfgID, cost.Quantity).Scan(&remaining.Quantity)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInsufficientItems
		}
		if err != nil {
			return nil, err
		}
		out = append(out, remaining)
	}
	return out, nil
}

// InvalidatePlayerContext evicts only; the next LoadPlayer reads durable state.
// Call only after a separately owned transaction has committed. A cancellation
// or cache error is diagnostic, never a reason to repeat a committed debit.
func (s *Service) InvalidatePlayerContext(ctx context.Context, p PlayerRef) error {
	if err := s.lockGrantContext(ctx); err != nil {
		return err
	}
	defer s.mu.Unlock()
	delete(s.bags, p)
	delete(s.wallets, p)
	return nil
}
