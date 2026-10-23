package api

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/jackc/pgx/v5"
)

type heroInventory struct {
	srv *Server
}

func (s *Server) heroInventoryPort() hero.InventoryPort {
	if s == nil {
		return nil
	}
	return &heroInventory{srv: s}
}

func (h *heroInventory) LoadWalletAndItems(ctx context.Context, p hero.PlayerRef) (hero.Resources, map[int32]int32, error) {
	ref := content.PlayerRef{ServerID: p.ServerID, PlayerID: p.PlayerID}
	var wallet hero.Resources
	if h.srv.players != nil && h.srv.players.Pool != nil {
		var cw content.ResourceWallet
		err := h.srv.players.Pool.QueryRow(ctx, `
			SELECT food, wood, iron, stone, gold FROM player_wallet
			WHERE server_id = $1 AND player_id = $2`,
			p.ServerID, p.PlayerID,
		).Scan(&cw.Food, &cw.Wood, &cw.Iron, &cw.Stone, &cw.Gold)
		if errors.Is(err, pgx.ErrNoRows) {
			cw = content.ResourceWallet{}
		} else if err != nil {
			return hero.Resources{}, nil, err
		}
		wallet = heroWalletFromContent(cw)
	} else if h.srv.contentSvc != nil {
		cw := h.srv.contentSvc.Wallet(ref)
		wallet = heroWalletFromContent(cw)
	}
	items := map[int32]int32{}
	if h.srv.contentSvc != nil {
		if err := h.srv.contentSvc.LoadPlayer(ctx, ref); err != nil {
			return hero.Resources{}, nil, err
		}
		for _, st := range h.srv.contentSvc.List(ref) {
			items[st.ItemCfgID] = st.Quantity
		}
	}
	return wallet, items, nil
}

func (h *heroInventory) ApplyRecruitSpend(ctx context.Context, p hero.PlayerRef, walletBefore hero.Resources, itemsBefore map[int32]int32, walletAfter hero.Resources, itemsAfter map[int32]int32) error {
	ref := content.PlayerRef{ServerID: p.ServerID, PlayerID: p.PlayerID}
	cost := content.ResourceWallet{
		Food:  walletBefore.Food - walletAfter.Food,
		Wood:  walletBefore.Wood - walletAfter.Wood,
		Stone: walletBefore.Stone - walletAfter.Stone,
		Iron:  walletBefore.Iron - walletAfter.Iron,
	}
	if w := h.srv.newShopWalletStore(); w != nil && (cost.Food > 0 || cost.Wood > 0 || cost.Stone > 0 || cost.Iron > 0) {
		if _, err := w.Spend(ctx, ref, cost); err != nil {
			if errors.Is(err, shop.ErrInsufficientBalance) {
				return hero.ErrInsufficientRes
			}
			return err
		}
	}
	if h.srv.contentSvc != nil {
		for id, beforeQty := range itemsBefore {
			afterQty := itemsAfter[id]
			if beforeQty > afterQty {
				if _, err := h.srv.contentSvc.Remove(ref, id, beforeQty-afterQty); err != nil {
					if errors.Is(err, content.ErrInsufficientItems) {
						return hero.ErrInsufficientItem
					}
					return err
				}
			}
		}
	}
	return nil
}

func heroWalletFromContent(w content.ResourceWallet) hero.Resources {
	return hero.Resources{Food: w.Food, Wood: w.Wood, Stone: w.Stone, Iron: w.Iron}
}
