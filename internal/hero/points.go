package hero

import (
	"context"
)

// PointBudget is unallocated potential from level (legacy levelAdd; lord 3× deferred M1).
func PointBudget(level int32) int32 {
	if level < 0 {
		return 0
	}
	return level
}

// PotentialUsed returns allocated points on politics/force/intel (legacy affairs/bravery/wisdom adds).
func PotentialUsed(h *Hero) int32 {
	return h.PoliticsAdd + h.ForceAdd + h.IntelAdd
}

// PotentialRemaining is unused potential for the three allocatable stats.
func PotentialRemaining(h *Hero) int32 {
	rem := PointBudget(h.Level) - PotentialUsed(h)
	if rem < 0 {
		return 0
	}
	return rem
}

// PointResult is the hero row after add/clear point ops.
type PointResult struct {
	Hero               *Hero
	PotentialRemaining int32
}

// AddHeroPointRequest sets target politics/force/intel (legacy addHeroPoint absolute targets).
type AddHeroPointRequest struct {
	HeroID   int64
	Politics int32
	Force    int32
	Intel    int32
}

// AddHeroPointOnce applies legacy addHeroPoint rules on an owned idle hero.
func AddHeroPointOnce(h *Hero, t Template, req AddHeroPointRequest) (PointResult, error) {
	if h.Status != StatusIdle {
		return PointResult{}, ErrHeroNotInCity
	}
	base := StatsAtLevel(t, h.Level)
	newPoliticsAdd := req.Politics - base.Politics
	newForceAdd := req.Force - base.Force
	newIntelAdd := req.Intel - base.Intel
	if newPoliticsAdd < 0 || newForceAdd < 0 || newIntelAdd < 0 {
		return PointResult{}, ErrInvalidPointTargets
	}
	if newPoliticsAdd < h.PoliticsAdd || newForceAdd < h.ForceAdd || newIntelAdd < h.IntelAdd {
		return PointResult{}, ErrInvalidPointTargets
	}
	used := newPoliticsAdd + newForceAdd + newIntelAdd
	if used > PointBudget(h.Level) {
		return PointResult{}, ErrInsufficientPotential
	}
	h.PoliticsAdd, h.ForceAdd, h.IntelAdd = newPoliticsAdd, newForceAdd, newIntelAdd
	ApplyStatsForLevel(h, t, h.Level)
	return PointResult{Hero: h, PotentialRemaining: PotentialRemaining(h)}, nil
}

// ClearHeroPointOnce resets point adds (legacy clearHeroPoint + useXiShuiDan zero adds; item cost M1 delta).
func ClearHeroPointOnce(h *Hero, t Template) (PointResult, error) {
	if h.Status != StatusIdle {
		return PointResult{}, ErrHeroNotInCity
	}
	h.PoliticsAdd, h.ForceAdd, h.IntelAdd = 0, 0, 0
	ApplyStatsForLevel(h, t, h.Level)
	return PointResult{Hero: h, PotentialRemaining: PotentialRemaining(h)}, nil
}

// AddHeroPointPlayer loads, allocates points, and persists.
func (s *Service) AddHeroPointPlayer(ctx context.Context, p PlayerRef, req AddHeroPointRequest) (PointResult, error) {
	h, t, err := s.ownedTemplateHero(ctx, p, req.HeroID)
	if err != nil {
		return PointResult{}, err
	}
	res, err := AddHeroPointOnce(h, t, req)
	if err != nil {
		return PointResult{}, err
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return PointResult{}, err
	}
	return res, nil
}

// ClearHeroPointPlayer loads, clears adds, and persists.
func (s *Service) ClearHeroPointPlayer(ctx context.Context, p PlayerRef, heroID int64) (PointResult, error) {
	h, t, err := s.ownedTemplateHero(ctx, p, heroID)
	if err != nil {
		return PointResult{}, err
	}
	res, err := ClearHeroPointOnce(h, t)
	if err != nil {
		return PointResult{}, err
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return PointResult{}, err
	}
	return res, nil
}

func (s *Service) ownedTemplateHero(ctx context.Context, p PlayerRef, heroID int64) (*Hero, Template, error) {
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, Template{}, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return nil, Template{}, ErrHeroNotFound
	}
	if h.TemplateCfgID == TemplateCfgIDHotelRandom {
		return nil, Template{}, ErrUnknownTemplate
	}
	t, ok := s.Catalog[h.TemplateCfgID]
	if !ok {
		return nil, Template{}, ErrUnknownTemplate
	}
	return h, t, nil
}
