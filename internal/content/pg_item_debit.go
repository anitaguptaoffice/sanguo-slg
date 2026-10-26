package content

import "context"

// removeItemAtomic is the standalone transaction owner used by Service.Remove.
// Supplied-transaction participants never call it. Its input was validated by
// Service before beginning; debitItemsInTx owns the common wallet→item order.
func (p *PGStore) removeItemAtomic(ctx context.Context, player PlayerRef, itemID, quantity int32) (int32, error) {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	remaining, err := debitItemsInTx(ctx, tx, player, []Stack{{ItemCfgID: itemID, Quantity: quantity}})
	if err != nil {
		return 0, err
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return remaining[0].Quantity, nil
}
