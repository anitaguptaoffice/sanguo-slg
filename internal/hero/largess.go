package hero

import (
	"context"
	"errors"
	"time"
)

// LargessGiftKind selects gold or a configured largess item.
type LargessGiftKind int8

const (
	LargessGiftGold LargessGiftKind = 1
	LargessGiftItem LargessGiftKind = 2
)

// LargessRequest is one largess attempt for a owned hero.
type LargessRequest struct {
	HeroID     int64
	Kind       LargessGiftKind
	ItemCfgID  int32
}

// LargessResult is the committed largess outcome.
type LargessResult struct {
	Hero            *Hero
	LoyaltyDelta    int32
	GoldSpent       int64
	ItemCfgID       int32
	NextLargessAtMS int64
}

// DefaultLargessGoods maps item_cfg_id to loyalty gain (legacy cfg_goods gid 30–38 subset).
var DefaultLargessGoods = map[int32]int32{
	2050: 5,
	2051: 10,
	2052: 15,
	2053: 20,
	2054: 25,
	2055: 30,
	2056: 40,
	2057: 50,
	2058: 60,
}

// HeroSalary mirrors legacy largess gold cost basis (affairs/bravery/wisdom → politics/force/intel).
func HeroSalary(h *Hero) int64 {
	over := func(stat int32) int64 {
		if stat <= 90 {
			return 0
		}
		return int64(stat-90) * 50
	}
	return int64(h.Level)*20 + over(h.Politics) + over(h.Force) + over(h.Intel)
}

func goldLargessCost(salary int64) int64 { return salary * 5 }

func goldLargessGain(salary int64, loyalty int, rng randomIntn) (int, error) {
	if loyalty >= LoyaltyMax {
		return 0, ErrLoyaltyMax
	}
	if salary < 3500 {
		return rng.Intn(20) + 1, nil
	}
	if salary < 6500 {
		return rng.Intn(10) + 1, nil
	}
	if loyalty < 30 {
		return rng.Intn(5) + 1, nil
	}
	return 0, ErrGoldLargessNotNeeded
}

func itemLargessGain(goods map[int32]int32, itemCfgID int32) (int32, error) {
	add, ok := goods[itemCfgID]
	if !ok || add <= 0 {
		return 0, ErrLargessUnknownItem
	}
	return add, nil
}

func largessCooldownRemaining(now, last time.Time) time.Duration {
	if last.IsZero() {
		return 0
	}
	elapsed := now.Sub(last)
	cd := time.Duration(LargessCooldown) * time.Second
	if elapsed >= cd {
		return 0
	}
	return cd - elapsed
}

// Largess applies largessHero rules on an in-memory player state (no persistence).
func Largess(ps *PlayerState, goods map[int32]int32, lastLargess time.Time, rng randomIntn, now time.Time, req LargessRequest) (LargessResult, error) {
	if req.HeroID == 0 {
		return LargessResult{}, ErrHeroNotFound
	}
	if req.Kind != LargessGiftGold && req.Kind != LargessGiftItem {
		return LargessResult{}, ErrLargessInvalidGift
	}
	if goods == nil {
		goods = DefaultLargessGoods
	}
	var h *Hero
	for _, row := range ps.Heroes {
		if row.HeroID == req.HeroID {
			h = row
			break
		}
	}
	if h == nil {
		return LargessResult{}, ErrHeroNotFound
	}
	if h.Status != StatusIdle {
		return LargessResult{}, ErrHeroNotInCity
	}
	if rem := largessCooldownRemaining(now, lastLargess); rem > 0 {
		return LargessResult{}, ErrLargessCooldown
	}

	var loyaltyAdd int
	var goldSpent int64
	var itemID int32

	switch req.Kind {
	case LargessGiftGold:
		salary := HeroSalary(h)
		cost := goldLargessCost(salary)
		if ps.Wallet.Gold < cost {
			return LargessResult{}, ErrInsufficientGold
		}
		add, err := goldLargessGain(salary, h.Loyalty, rng)
		if err != nil {
			return LargessResult{}, err
		}
		ps.Wallet.Gold -= cost
		goldSpent = cost
		loyaltyAdd = add
	case LargessGiftItem:
		add, err := itemLargessGain(goods, req.ItemCfgID)
		if err != nil {
			return errResult(err)
		}
		if ps.Items[req.ItemCfgID] < 1 {
			return LargessResult{}, ErrInsufficientItem
		}
		if h.Loyalty >= LoyaltyMax {
			return LargessResult{}, ErrLoyaltyMax
		}
		ps.Items[req.ItemCfgID]--
		itemID = req.ItemCfgID
		loyaltyAdd = int(add)
	default:
		return LargessResult{}, ErrLargessInvalidGift
	}

	before := h.Loyalty
	h.SetLoyalty(before + loyaltyAdd)
	nextAt := now.Add(time.Duration(LargessCooldown) * time.Second)
	return LargessResult{
		Hero:            h,
		LoyaltyDelta:    int32(h.Loyalty - before),
		GoldSpent:       goldSpent,
		ItemCfgID:       itemID,
		NextLargessAtMS: nextAt.UnixMilli(),
	}, nil
}

func errResult(err error) (LargessResult, error) {
	return LargessResult{}, err
}

// LargessPlayer loads state, applies largess, persists hero + cooldown, and commits spend.
func (s *Service) LargessPlayer(ctx context.Context, p PlayerRef, inv InventoryPort, req LargessRequest) (LargessResult, error) {
	if inv == nil {
		return LargessResult{}, errors.New("hero: inventory port required")
	}
	h, err := s.Store.GetHero(ctx, p.ServerID, req.HeroID)
	if err != nil {
		return LargessResult{}, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return LargessResult{}, ErrHeroNotFound
	}
	last, err := s.Store.LastLargessAt(ctx, p.ServerID, req.HeroID)
	if err != nil {
		return LargessResult{}, err
	}
	wallet, items, err := inv.LoadWalletAndItems(ctx, p)
	if err != nil {
		return LargessResult{}, err
	}
	ps := &PlayerState{
		ServerID: p.ServerID, PlayerID: p.PlayerID,
		Wallet: wallet, Items: items, Heroes: []*Hero{h},
	}
	res, err := Largess(ps, DefaultLargessGoods, last, s.random(), s.now(), req)
	if err != nil {
		return LargessResult{}, err
	}
	if err := s.Store.SaveHero(ctx, res.Hero); err != nil {
		return LargessResult{}, err
	}
	if err := s.Store.SetLastLargessAt(ctx, p.ServerID, req.HeroID, s.now()); err != nil {
		return LargessResult{}, err
	}
	if err := inv.ApplyLargessSpend(ctx, p, res.GoldSpent, res.ItemCfgID); err != nil {
		return LargessResult{}, err
	}
	return res, nil
}
