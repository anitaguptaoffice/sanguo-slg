package hero

import (
	"context"
	"time"
)

// M1 出征体力（对齐 legacy mem_hero_blood + StartTroop 闸；见 spec/rules/legacy_alignment.md §9）。
const (
	MarchForceMarchCost      int32 = 10
	MarchForceRegenPeriodSec int64 = 180 // 每 3 分钟 +1
	MarchForceMaxCap         int32 = 100
)

// MarchForceState is persisted march stamina (legacy mem_hero_blood).
type MarchForceState struct {
	ServerID    int32
	HeroID      int64
	Current     int32
	LastRegenAt time.Time
}

// MarchForceMax returns the stamina cap for a hero level (M1 simplified).
func MarchForceMax(level int32) int32 {
	if level < 1 {
		level = 1
	}
	max := 20 + level*4
	if max > MarchForceMaxCap {
		return MarchForceMaxCap
	}
	return max
}

func marchForceCanRegen(status int16) bool {
	return status == StatusIdle || status == StatusGarrison
}

// ApplyMarchForceRegen mutates state in place when the hero may passively recover.
func ApplyMarchForceRegen(st *MarchForceState, max int32, status int16, now time.Time) {
	if st == nil {
		return
	}
	if max <= 0 {
		max = 1
	}
	if st.Current >= max {
		st.Current = max
		st.LastRegenAt = now
		return
	}
	if !marchForceCanRegen(status) {
		return
	}
	if st.LastRegenAt.IsZero() {
		st.LastRegenAt = now
		return
	}
	elapsed := now.Unix() - st.LastRegenAt.Unix()
	if elapsed < MarchForceRegenPeriodSec {
		return
	}
	ticks := elapsed / MarchForceRegenPeriodSec
	add := int32(ticks)
	if add > max-st.Current {
		add = max - st.Current
	}
	st.Current += add
	st.LastRegenAt = st.LastRegenAt.Add(time.Duration(ticks*MarchForceRegenPeriodSec) * time.Second)
}

// RestMarchForceOnce sets stamina to max when the hero is idle in city.
func RestMarchForceOnce(h *Hero, st *MarchForceState, now time.Time) (MarchForceState, error) {
	if h.Status != StatusIdle {
		return MarchForceState{}, ErrHeroNotInCity
	}
	max := MarchForceMax(h.Level)
	if st == nil {
		st = &MarchForceState{ServerID: h.ServerID, HeroID: h.HeroID}
	}
	st.Current = max
	st.LastRegenAt = now
	return *st, nil
}

// ConsumeMarchForceOnce deducts march cost after regen; does not change hero status.
func ConsumeMarchForceOnce(h *Hero, st *MarchForceState, now time.Time) (MarchForceState, error) {
	max := MarchForceMax(h.Level)
	if st == nil {
		st = &MarchForceState{
			ServerID: h.ServerID, HeroID: h.HeroID,
			Current: max, LastRegenAt: now,
		}
	}
	ApplyMarchForceRegen(st, max, h.Status, now)
	if st.Current < MarchForceMarchCost {
		return *st, ErrInsufficientMarchForce
	}
	st.Current -= MarchForceMarchCost
	return *st, nil
}

// MarchForceView is the API-facing stamina snapshot.
type MarchForceView struct {
	Current int32
	Max     int32
}

func (s *Service) loadMarchForceState(ctx context.Context, serverID int32, heroID int64, level int32, status int16, now time.Time) (MarchForceState, error) {
	st, err := s.Store.GetMarchForceState(ctx, serverID, heroID)
	if err != nil {
		return MarchForceState{}, err
	}
	max := MarchForceMax(level)
	if st == nil {
		st = &MarchForceState{
			ServerID: serverID, HeroID: heroID,
			Current: max, LastRegenAt: now,
		}
		if err := s.Store.SaveMarchForceState(ctx, *st); err != nil {
			return MarchForceState{}, err
		}
		return *st, nil
	}
	ApplyMarchForceRegen(st, max, status, now)
	if err := s.Store.SaveMarchForceState(ctx, *st); err != nil {
		return MarchForceState{}, err
	}
	return *st, nil
}

// MarchForceForHero returns current/max after passive regen.
func (s *Service) MarchForceForHero(ctx context.Context, p PlayerRef, h *Hero) (MarchForceView, error) {
	if h == nil {
		return MarchForceView{}, ErrHeroNotFound
	}
	now := s.now()
	st, err := s.loadMarchForceState(ctx, p.ServerID, h.HeroID, h.Level, h.Status, now)
	if err != nil {
		return MarchForceView{}, err
	}
	return MarchForceView{Current: st.Current, Max: MarchForceMax(h.Level)}, nil
}

// RestHero restores march stamina to max for an idle owned hero.
func (s *Service) RestHero(ctx context.Context, p PlayerRef, heroID int64) (MarchForceView, error) {
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return MarchForceView{}, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return MarchForceView{}, ErrHeroNotFound
	}
	now := s.now()
	st, err := s.Store.GetMarchForceState(ctx, p.ServerID, heroID)
	if err != nil {
		return MarchForceView{}, err
	}
	updated, err := RestMarchForceOnce(h, st, now)
	if err != nil {
		return MarchForceView{}, err
	}
	if err := s.Store.SaveMarchForceState(ctx, updated); err != nil {
		return MarchForceView{}, err
	}
	return MarchForceView{Current: updated.Current, Max: MarchForceMax(h.Level)}, nil
}

func (s *Service) consumeMarchForceForMarch(ctx context.Context, p PlayerRef, h *Hero) error {
	now := s.now()
	st, err := s.Store.GetMarchForceState(ctx, p.ServerID, h.HeroID)
	if err != nil {
		return err
	}
	updated, err := ConsumeMarchForceOnce(h, st, now)
	if err != nil {
		if st == nil || updated.Current != st.Current {
			_ = s.Store.SaveMarchForceState(ctx, updated)
		}
		return err
	}
	return s.Store.SaveMarchForceState(ctx, updated)
}
