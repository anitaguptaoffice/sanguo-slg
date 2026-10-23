package shop

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

type Payments struct {
	svc    *content.Service
	wallet ResourceWalletStore
}

func NewPayments(svc *content.Service, wallet ResourceWalletStore) *Payments {
	return &Payments{svc: svc, wallet: wallet}
}

func (p *Payments) spendResources(ctx context.Context, player content.PlayerRef, cost content.ResourceWallet) (content.ResourceWallet, error) {
	if p.wallet == nil {
		return content.ResourceWallet{}, ErrInsufficientBalance
	}
	return p.wallet.Spend(ctx, player, cost)
}

func (p *Payments) spendItems(player content.PlayerRef, items []content.RewardItem) error {
	for _, row := range items {
		if _, err := p.svc.Remove(player, row.ItemCfgID, row.Qty); err != nil {
			if err == content.ErrInsufficientItems {
				return ErrInsufficientItems
			}
			return err
		}
	}
	return nil
}

func priceWallet(pkg content.RewardPackage) content.ResourceWallet {
	var w content.ResourceWallet
	for k, v := range pkg.Resources {
		switch k {
		case "food":
			w.Food = v
		case "wood":
			w.Wood = v
		case "iron":
			w.Iron = v
		case "stone":
			w.Stone = v
		case "gold", "silver":
			w.Gold += v
		}
	}
	return w
}

func scaleWallet(w content.ResourceWallet, n int32) content.ResourceWallet {
	return content.ResourceWallet{
		Food: w.Food * int64(n), Wood: w.Wood * int64(n), Iron: w.Iron * int64(n),
		Stone: w.Stone * int64(n), Gold: w.Gold * int64(n),
	}
}

func scaleItems(items []content.RewardItem, n int32) []content.RewardItem {
	out := make([]content.RewardItem, len(items))
	for i, row := range items {
		out[i] = content.RewardItem{ItemCfgID: row.ItemCfgID, Qty: row.Qty * n}
	}
	return out
}
