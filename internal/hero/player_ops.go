package hero

import (
	"context"
	"errors"
)

// PlayerRef identifies a player on a shard.
type PlayerRef struct {
	ServerID int32
	PlayerID int64
}

// ListQuery optionally paginates hero rows for a player.
type ListQuery struct {
	Limit  int
	Offset int
}

// ListResult is a page of heroes plus total count.
type ListResult struct {
	Heroes []*Hero
	Total  int
}

// HeroDetail enriches a hero row with template metadata.
type HeroDetail struct {
	Hero                *Hero
	TemplateName        string
	TemplateCode        string
	Rarity              int16
	LoyaltyMin          int32
	LoyaltyMax          int32
	Tagline             string
	ExpectedStats       BaseStats
	ExpTowardNext       int64
	UpgradeExpRequired  int64
}

// InventoryPort loads and commits recruit/largess costs against the content/wallet layer.
type InventoryPort interface {
	LoadWalletAndItems(ctx context.Context, p PlayerRef) (Resources, map[int32]int32, error)
	ApplyRecruitSpend(ctx context.Context, p PlayerRef, walletBefore Resources, itemsBefore map[int32]int32, walletAfter Resources, itemsAfter map[int32]int32) error
	ApplyLargessSpend(ctx context.Context, p PlayerRef, goldSpent int64, itemCfgID int32) error
	SpendItemQty(ctx context.Context, p PlayerRef, itemCfgID int32, qty int32) error
}

// LoadPlayerState hydrates recruit/list state from the hero store and inventory port.
func (s *Service) LoadPlayerState(ctx context.Context, p PlayerRef, inv InventoryPort) (*PlayerState, error) {
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return nil, err
	}
	maxID, err := s.Store.MaxHeroID(ctx, p.ServerID)
	if err != nil {
		return nil, err
	}
	var wallet Resources
	var items map[int32]int32
	if inv != nil {
		wallet, items, err = inv.LoadWalletAndItems(ctx, p)
		if err != nil {
			return nil, err
		}
	}
	if items == nil {
		items = map[int32]int32{}
	}
	return &PlayerState{
		ServerID: p.ServerID, PlayerID: p.PlayerID,
		Wallet: wallet, Items: items, Heroes: heroes, nextHeroID: maxID,
	}, nil
}

// ListPlayerHeroes returns heroes for a player, optionally paginated.
func (s *Service) ListPlayerHeroes(ctx context.Context, p PlayerRef, q ListQuery) (ListResult, error) {
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return ListResult{}, err
	}
	var owned []*Hero
	for _, h := range heroes {
		if h.Status != StatusCaptive {
			owned = append(owned, h)
		}
	}
	heroes = owned
	total := len(heroes)
	if q.Offset < 0 {
		q.Offset = 0
	}
	if q.Offset >= total {
		return ListResult{Total: total}, nil
	}
	if q.Limit <= 0 {
		return ListResult{Heroes: heroes[q.Offset:], Total: total}, nil
	}
	end := q.Offset + q.Limit
	if end > total {
		end = total
	}
	return ListResult{Heroes: heroes[q.Offset:end], Total: total}, nil
}

// GetHeroDetail loads one hero and enriches it with template metadata.
func (s *Service) GetHeroDetail(ctx context.Context, p PlayerRef, heroID int64) (HeroDetail, error) {
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return HeroDetail{}, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return HeroDetail{}, ErrHeroNotFound
	}
	if h.TemplateCfgID == TemplateCfgIDHotelRandom {
		name := h.DisplayName
		if name == "" {
			name = "客栈将领"
		}
		return HeroDetail{
			Hero: h, TemplateName: name, TemplateCode: "hotel_random", Rarity: 1,
			LoyaltyMin: LoyaltyMin, LoyaltyMax: LoyaltyMax,
			ExpectedStats: BaseStats{Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command},
		}, nil
	}
	t, ok := s.Catalog[h.TemplateCfgID]
	if !ok {
		return HeroDetail{}, ErrUnknownTemplate
	}
	levels := s.levels
	if levels == nil {
		levels, err = DefaultLevelTable()
		if err != nil {
			return HeroDetail{}, err
		}
	}
	toward := levels.ExpTowardNext(h.Level, h.Exp)
	req := levels.UpgradeExpToNext(h.Level)
	if h.Level >= MaxLevelM1 {
		req = 0
	}
	return HeroDetail{
		Hero: h, TemplateName: t.Name, TemplateCode: t.Code, Rarity: t.Rarity,
		LoyaltyMin: LoyaltyMin, LoyaltyMax: LoyaltyMax,
		ExpectedStats: BaseStats{Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command},
		ExpTowardNext: toward, UpgradeExpRequired: req,
	}, nil
}

// RecruitPlayer runs recruit logic, persists the hero, and commits inventory spend.
func (s *Service) RecruitPlayer(ctx context.Context, p PlayerRef, inv InventoryPort, req RecruitRequest) (RecruitResult, error) {
	if inv == nil {
		return RecruitResult{}, errors.New("hero: inventory port required")
	}
	ps, err := s.LoadPlayerState(ctx, p, inv)
	if err != nil {
		return RecruitResult{}, err
	}
	walletBefore := ps.Wallet
	itemsBefore := cloneItems(ps.Items)
	res, err := Recruit(ps, s.Catalog, s.Items, s.RNG, s.now(), req)
	if err != nil {
		return RecruitResult{}, err
	}
	if err := s.Store.SaveHero(ctx, res.Hero); err != nil {
		return RecruitResult{}, err
	}
	if err := inv.ApplyRecruitSpend(ctx, p, walletBefore, itemsBefore, res.Wallet, res.Items); err != nil {
		return RecruitResult{}, err
	}
	return res, nil
}

func cloneItems(m map[int32]int32) map[int32]int32 {
	out := make(map[int32]int32, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
