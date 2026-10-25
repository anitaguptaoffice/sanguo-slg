package content

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// useResourceAtomic uses the durable stock, not a potentially stale service bag.
// Wallet-before-item locking matches grantTx. Cache publication belongs to Use.
func (p *PGStore) useResourceAtomic(ctx context.Context, player PlayerRef, itemID, count int32, delta ResourceWallet) (int32, ResourceWallet, error) {
	var wallet ResourceWallet
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return 0, wallet, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, player.ServerID, player.PlayerID)
	if err != nil {
		return 0, wallet, err
	}
	err = tx.QueryRow(ctx, `SELECT food,wood,iron,stone,gold FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, player.ServerID, player.PlayerID).Scan(&wallet.Food, &wallet.Wood, &wallet.Iron, &wallet.Stone, &wallet.Gold)
	if err != nil {
		return 0, wallet, err
	}
	var qty int32
	err = tx.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=$3 FOR UPDATE`, player.ServerID, player.PlayerID, itemID).Scan(&qty)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, wallet, ErrInsufficientItems
	}
	if err != nil {
		return 0, wallet, err
	}
	if qty < count {
		return 0, wallet, ErrInsufficientItems
	}
	remaining := qty - count
	if remaining == 0 {
		_, err = tx.Exec(ctx, `DELETE FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=$3`, player.ServerID, player.PlayerID, itemID)
	} else {
		_, err = tx.Exec(ctx, `UPDATE player_item SET quantity=$4 WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=$3`, player.ServerID, player.PlayerID, itemID, remaining)
	}
	if err != nil {
		return 0, wallet, err
	}
	err = tx.QueryRow(ctx, `UPDATE player_wallet SET food=food+$3,wood=wood+$4,iron=iron+$5,stone=stone+$6,updated_at=now() WHERE server_id=$1 AND player_id=$2 RETURNING food,wood,iron,stone,gold`, player.ServerID, player.PlayerID, delta.Food, delta.Wood, delta.Iron, delta.Stone).Scan(&wallet.Food, &wallet.Wood, &wallet.Iron, &wallet.Stone, &wallet.Gold)
	if err != nil {
		return 0, ResourceWallet{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, ResourceWallet{}, err
	}
	return remaining, wallet, nil
}
