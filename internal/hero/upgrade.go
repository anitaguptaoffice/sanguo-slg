package hero

import (
	"context"
)

// UpgradeResult is the hero row after a successful level-up.
type UpgradeResult struct {
	Hero            *Hero
	PreviousLevel   int32
	ExpConsumed     int64
	UpgradeExpCost  int64
}

// ApplyStatsForLevel recomputes stored attrs from template growth at level.
func ApplyStatsForLevel(h *Hero, t Template, level int32) {
	st := StatsAtLevel(t, level)
	h.Level = level
	h.Force, h.Intel, h.Politics, h.Command = st.Force, st.Intel, st.Politics, st.Command
}

// UpgradeHeroOnce applies legacy upgradeHero rules for one level (M1 cap, idle-only).
func UpgradeHeroOnce(h *Hero, t Template, levels *LevelTable) (UpgradeResult, error) {
	if levels == nil {
		return UpgradeResult{}, ErrLevelTableMissing
	}
	if h.Level >= MaxLevelM1 {
		return UpgradeResult{}, ErrMaxLevel
	}
	if h.Status != StatusIdle {
		return UpgradeResult{}, ErrHeroNotInCity
	}
	cost := levels.UpgradeExpToNext(h.Level)
	if cost <= 0 {
		return UpgradeResult{}, ErrMaxLevel
	}
	pool := levels.ExpTowardNext(h.Level, h.Exp)
	if pool < cost {
		return UpgradeResult{}, ErrInsufficientExp
	}
	prev := h.Level
	ApplyStatsForLevel(h, t, prev+1)
	return UpgradeResult{
		Hero: h, PreviousLevel: prev, ExpConsumed: 0, UpgradeExpCost: cost,
	}, nil
}

// UpgradePlayer loads, upgrades once, and persists the hero.
func (s *Service) UpgradePlayer(ctx context.Context, p PlayerRef, heroID int64) (UpgradeResult, error) {
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return UpgradeResult{}, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return UpgradeResult{}, ErrHeroNotFound
	}
	t, ok := s.Catalog[h.TemplateCfgID]
	if !ok {
		return UpgradeResult{}, ErrUnknownTemplate
	}
	levels := s.levels
	if levels == nil {
		levels, err = DefaultLevelTable()
		if err != nil {
			return UpgradeResult{}, err
		}
	}
	res, err := UpgradeHeroOnce(h, t, levels)
	if err != nil {
		return UpgradeResult{}, err
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return UpgradeResult{}, err
	}
	return res, nil
}
