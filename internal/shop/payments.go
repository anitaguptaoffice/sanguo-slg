package shop

import "github.com/anitaguptaoffice/sanguo-slg/internal/content"

type Payments struct {
	svc   *content.Service
	spent map[content.PlayerRef]content.ResourceWallet
}

func NewPayments(svc *content.Service) *Payments {
	return &Payments{svc: svc, spent: make(map[content.PlayerRef]content.ResourceWallet)}
}

func (p *Payments) wallet(player content.PlayerRef) content.ResourceWallet {
	w := p.svc.Wallet(player)
	s := p.spent[player]
	return content.ResourceWallet{
		Food: w.Food - s.Food, Wood: w.Wood - s.Wood, Iron: w.Iron - s.Iron,
		Stone: w.Stone - s.Stone, Gold: w.Gold - s.Gold,
	}
}

func (p *Payments) spendResources(player content.PlayerRef, cost content.ResourceWallet) (content.ResourceWallet, error) {
	have := p.wallet(player)
	if have.Food < cost.Food || have.Wood < cost.Wood || have.Iron < cost.Iron ||
		have.Stone < cost.Stone || have.Gold < cost.Gold {
		return have, ErrInsufficientBalance
	}
	s := p.spent[player]
	s.Food += cost.Food
	s.Wood += cost.Wood
	s.Iron += cost.Iron
	s.Stone += cost.Stone
	s.Gold += cost.Gold
	p.spent[player] = s
	return content.ResourceWallet{
		Food: have.Food - cost.Food, Wood: have.Wood - cost.Wood, Iron: have.Iron - cost.Iron,
		Stone: have.Stone - cost.Stone, Gold: have.Gold - cost.Gold,
	}, nil
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
