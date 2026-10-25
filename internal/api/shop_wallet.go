package api

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pgShopWallet debits player_wallet and mirrors four resources onto loaded domestic cities.
type pgShopWallet struct {
	pool *pgxpool.Pool
	srv  *Server
}

// ShopWalletStore returns the PG-backed wallet debiter wired into shop purchases.
func (s *Server) ShopWalletStore() shop.ResourceWalletStore {
	return s.newShopWalletStore()
}

func (s *Server) newShopWalletStore() shop.ResourceWalletStore {
	if s == nil || s.players == nil || s.players.Pool == nil {
		return nil
	}
	return &pgShopWallet{pool: s.players.Pool, srv: s}
}

func (w *pgShopWallet) Spend(ctx context.Context, player content.PlayerRef, cost content.ResourceWallet) (content.ResourceWallet, error) {
	if cost.Food == 0 && cost.Wood == 0 && cost.Iron == 0 && cost.Stone == 0 && cost.Gold == 0 {
		return w.readWallet(ctx, player)
	}
	tx, err := w.pool.Begin(ctx)
	if err != nil {
		return content.ResourceWallet{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var have content.ResourceWallet
	err = tx.QueryRow(ctx, `
		SELECT food, wood, iron, stone, gold FROM player_wallet
		WHERE server_id = $1 AND player_id = $2
		FOR UPDATE`,
		player.ServerID, player.PlayerID,
	).Scan(&have.Food, &have.Wood, &have.Iron, &have.Stone, &have.Gold)
	if errors.Is(err, pgx.ErrNoRows) {
		return content.ResourceWallet{}, shop.ErrInsufficientBalance
	}
	if err != nil {
		return content.ResourceWallet{}, err
	}
	if have.Food < cost.Food || have.Wood < cost.Wood || have.Iron < cost.Iron ||
		have.Stone < cost.Stone || have.Gold < cost.Gold {
		return have, shop.ErrInsufficientBalance
	}
	after := content.ResourceWallet{
		Food: have.Food - cost.Food, Wood: have.Wood - cost.Wood, Iron: have.Iron - cost.Iron,
		Stone: have.Stone - cost.Stone, Gold: have.Gold - cost.Gold,
	}
	_, err = tx.Exec(ctx, `
		UPDATE player_wallet SET food=$3, wood=$4, iron=$5, stone=$6, gold=$7, updated_at=NOW()
		WHERE server_id=$1 AND player_id=$2`,
		player.ServerID, player.PlayerID,
		after.Food, after.Wood, after.Iron, after.Stone, after.Gold)
	if err != nil {
		return content.ResourceWallet{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.ResourceWallet{}, err
	}
	w.srv.refreshDomesticWalletAfterCommit(ctx, player.ServerID, player.PlayerID)
	return after, nil
}

func (w *pgShopWallet) readWallet(ctx context.Context, player content.PlayerRef) (content.ResourceWallet, error) {
	var have content.ResourceWallet
	err := w.pool.QueryRow(ctx, `
		SELECT food, wood, iron, stone, gold FROM player_wallet
		WHERE server_id = $1 AND player_id = $2`,
		player.ServerID, player.PlayerID,
	).Scan(&have.Food, &have.Wood, &have.Iron, &have.Stone, &have.Gold)
	if errors.Is(err, pgx.ErrNoRows) {
		return content.ResourceWallet{}, nil
	}
	return have, err
}

// refreshDomesticWalletAfterCommit never turns an already committed debit/grant
// into a failed operation: callers must not retry money movement on cache failure.
// The next domestic operation refreshes again before settling or spending.
func (s *Server) refreshDomesticWalletAfterCommit(ctx context.Context, serverID int32, playerID int64) {
	if s == nil || s.domestic == nil || s.players == nil || s.players.Pool == nil {
		return
	}
	for _, city := range s.cities {
		if city == nil || city.PlayerID != playerID {
			continue
		}
		if _, err := s.domestic.RefreshWallet(ctx, city.ID); err != nil {
			s.log.Error("wallet committed; domestic refresh deferred", "server_id", serverID,
				"player_id", playerID, "city_id", city.ID, "error", err)
		}
	}
}
