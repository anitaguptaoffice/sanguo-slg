package api

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/jackc/pgx/v5"
)

var errShopWallet = errors.New("shop initialized wallet unavailable")

// The coordinator calls this before all item/shop participants, including free
// purchases. Unlike a bag load, it never synthesizes an uninitialized wallet.
func lockShopWallet(ctx context.Context, tx pgx.Tx, pc PlayerContext) (content.ResourceWallet, error) {
	var w content.ResourceWallet
	err := tx.QueryRow(ctx, `SELECT food,wood,iron,stone,gold FROM player_wallet
  WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, pc.ServerID, pc.PlayerID).
		Scan(&w.Food, &w.Wood, &w.Iron, &w.Stone, &w.Gold)
	if errors.Is(err, pgx.ErrNoRows) {
		err = errShopWallet
	}
	return w, err
}

// debitShopWallet is supplied-tx only. The caller owns the wallet row lock and
// rolls back on every error. Zero-resource purchases preserve updated_at.
func debitShopWallet(ctx context.Context, tx pgx.Tx, pc PlayerContext, have, cost content.ResourceWallet) (content.ResourceWallet, error) {
	if cost.Food < 0 || cost.Wood < 0 || cost.Iron < 0 || cost.Stone < 0 || cost.Gold < 0 {
		return content.ResourceWallet{}, shop.ErrInvalidPurchaseCount
	}
	if have.Food < cost.Food || have.Wood < cost.Wood || have.Iron < cost.Iron || have.Stone < cost.Stone || have.Gold < cost.Gold {
		return content.ResourceWallet{}, shop.ErrInsufficientBalance
	}
	if cost == (content.ResourceWallet{}) {
		return have, nil
	}
	after := content.ResourceWallet{Food: have.Food - cost.Food, Wood: have.Wood - cost.Wood, Iron: have.Iron - cost.Iron, Stone: have.Stone - cost.Stone, Gold: have.Gold - cost.Gold}
	tag, err := tx.Exec(ctx, `UPDATE player_wallet SET food=food-$3,wood=wood-$4,iron=iron-$5,stone=stone-$6,gold=gold-$7,updated_at=NOW()
  WHERE server_id=$1 AND player_id=$2 AND food>=$3 AND wood>=$4 AND iron>=$5 AND stone>=$6 AND gold>=$7`,
		pc.ServerID, pc.PlayerID, cost.Food, cost.Wood, cost.Iron, cost.Stone, cost.Gold)
	if err != nil {
		return content.ResourceWallet{}, err
	}
	if tag.RowsAffected() != 1 {
		return content.ResourceWallet{}, shop.ErrInsufficientBalance
	}
	return after, nil
}
