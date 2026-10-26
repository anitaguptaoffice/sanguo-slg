package hero

import (
	"context"
	"errors"
	"time"
)

var (
	ErrPersuadeUnknownNPC    = errors.New("hero: persuade target not in M1 roster")
	ErrPersuadeNotBefriended = errors.New("hero: lionize befriending required before persuade")
	ErrInsufficientFriend    = errors.New("hero: insufficient friend for lionize hire")
	ErrPersuadeCooldown      = errors.New("hero: persuade on cooldown")
	ErrLionizeAlreadyDone    = errors.New("hero: famous hero already recruited via lionize")
	ErrLionizeAlreadyFriend     = errors.New("hero: already befriended; use persuade or hire")
	ErrPersuadeFriendSaturated  = errors.New("hero: friend sufficient; call LionizeHero to recruit")
)

// PersuadeTargetView is one row for ListPersuadeTargets.
type PersuadeTargetView struct {
	Target          PersuadeNPCTarget
	Friend          int32
	State           int16
	HireFriendMin   int32
	NextPersuadeAt  time.Time
}

// PersuadeHeroResult is one persuade step outcome.
type PersuadeHeroResult struct {
	NpcCfgID       int32
	Friend         int32
	FriendDelta    int32
	NextPersuadeAt time.Time
}

// LionizeHeroResult covers befriending or hiring via lionize.
type LionizeHeroResult struct {
	NpcCfgID    int32
	Friend      int32
	State       int16
	Hero        *Hero
	GoldSpent   int64
	Befriended  bool
	Recruited   bool
}

func (s *Service) loadLionizeStore() (LionizeStore, error) {
	if s.LionizeStore == nil {
		return nil, errors.New("hero: lionize store missing")
	}
	return s.LionizeStore, nil
}

func mergeLionizeRec(rec *LionizeRecord) LionizeRecord {
	if rec == nil {
		return LionizeRecord{State: LionizeStateNone}
	}
	return *rec
}

func playerOwnsTemplate(heroes []*Hero, templateCfgID int32) bool {
	for _, h := range heroes {
		if h.Status == StatusCaptive {
			continue
		}
		if h.TemplateCfgID == templateCfgID {
			return true
		}
	}
	return false
}

// ListPersuadeTargets returns seeded NPC targets with friend/state progress.
func (s *Service) ListPersuadeTargets(ctx context.Context, p PlayerRef) ([]PersuadeTargetView, error) {
	store, err := s.loadLionizeStore()
	if err != nil {
		return nil, err
	}
	progress, err := store.List(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return nil, err
	}
	now := s.now()
	out := make([]PersuadeTargetView, 0, len(DefaultPersuadeTargets()))
	for _, t := range DefaultPersuadeTargets() {
		rec := progress[t.NpcCfgID]
		view := PersuadeTargetView{
			Target: t, Friend: rec.Friend, State: rec.State, HireFriendMin: LionizeHireFriendMin,
		}
		if !rec.LastPersuadeAt.IsZero() {
			next := rec.LastPersuadeAt.Add(time.Duration(PersuadeCooldownSeconds) * time.Second)
			if next.After(now) {
				view.NextPersuadeAt = next
			}
		}
		out = append(out, view)
	}
	return out, nil
}

// PersuadeHero performs one persuade step (friend delta; legacy simplified).
func (s *Service) PersuadeHero(ctx context.Context, p PlayerRef, city CityRef, npcCfgID int32, cityPort HotelCityPort, inv InventoryPort) (PersuadeHeroResult, error) {
	target, ok := findPersuadeTarget(npcCfgID)
	if !ok {
		return PersuadeHeroResult{}, ErrPersuadeUnknownNPC
	}
	store, err := s.loadLionizeStore()
	if err != nil {
		return PersuadeHeroResult{}, err
	}
	if cityPort == nil || inv == nil {
		return PersuadeHeroResult{}, errors.New("hero: persuade dependencies missing")
	}
	rec := mergeLionizeRec(nil)
	if existing, err := store.Get(ctx, p.ServerID, p.PlayerID, npcCfgID); err != nil {
		return PersuadeHeroResult{}, err
	} else if existing != nil {
		rec = *existing
	}
	if rec.State == LionizeStateRecruited {
		return PersuadeHeroResult{}, ErrLionizeAlreadyDone
	}
	if rec.State != LionizeStateBefriended {
		return PersuadeHeroResult{}, ErrPersuadeNotBefriended
	}
	if rec.Friend >= LionizeHireFriendMin {
		return PersuadeHeroResult{}, ErrPersuadeFriendSaturated
	}
	now := s.now()
	if !rec.LastPersuadeAt.IsZero() {
		next := rec.LastPersuadeAt.Add(time.Duration(PersuadeCooldownSeconds) * time.Second)
		if now.Before(next) {
			return PersuadeHeroResult{}, ErrPersuadeCooldown
		}
	}
	cityID := city.CityID
	if cityID <= 0 {
		return PersuadeHeroResult{}, ErrInvalidRecruit
	}
	_, items, err := inv.LoadWalletAndItems(ctx, p)
	if err != nil {
		return PersuadeHeroResult{}, err
	}
	if items[PersuadeItemCfgID] < PersuadeItemQty {
		return PersuadeHeroResult{}, ErrInsufficientItem
	}
	if err := inv.SpendItemQty(ctx, p, PersuadeItemCfgID, PersuadeItemQty); err != nil {
		return PersuadeHeroResult{}, err
	}
	delta := int32(PersuadeFriendDelta)
	rec.Friend += delta
	if rec.Friend > LionizeHireFriendMin {
		rec.Friend = LionizeHireFriendMin
	}
	rec.LastPersuadeAt = now
	if err := store.Put(ctx, p.ServerID, p.PlayerID, npcCfgID, rec); err != nil {
		return PersuadeHeroResult{}, err
	}
	nextAt := now.Add(time.Duration(PersuadeCooldownSeconds) * time.Second)
	return PersuadeHeroResult{
		NpcCfgID: target.NpcCfgID, Friend: rec.Friend, FriendDelta: delta, NextPersuadeAt: nextAt,
	}, nil
}

// LionizeHero befriends (state 0→1) or recruits when friend meets threshold.
func (s *Service) LionizeHero(ctx context.Context, p PlayerRef, city CityRef, npcCfgID int32, cityPort HotelCityPort) (LionizeHeroResult, error) {
	target, ok := findPersuadeTarget(npcCfgID)
	if !ok {
		return LionizeHeroResult{}, ErrPersuadeUnknownNPC
	}
	store, err := s.loadLionizeStore()
	if err != nil {
		return LionizeHeroResult{}, err
	}
	if cityPort == nil {
		return LionizeHeroResult{}, errors.New("hero: lionize city port missing")
	}
	cityID := city.CityID
	if cityID <= 0 {
		return LionizeHeroResult{}, ErrInvalidRecruit
	}
	rec := mergeLionizeRec(nil)
	if existing, err := store.Get(ctx, p.ServerID, p.PlayerID, npcCfgID); err != nil {
		return LionizeHeroResult{}, err
	} else if existing != nil {
		rec = *existing
	}
	if rec.State == LionizeStateRecruited {
		return LionizeHeroResult{}, ErrLionizeAlreadyDone
	}
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return LionizeHeroResult{}, err
	}
	if playerOwnsTemplate(heroes, target.TemplateCfgID) {
		return LionizeHeroResult{}, ErrAlreadyOwned
	}
	officeLevel, err := cityPort.OfficeLevel(ctx, p.ServerID, cityID)
	if err != nil {
		return LionizeHeroResult{}, err
	}

	// Hire path: befriended and friend >= threshold.
	if rec.State == LionizeStateBefriended && rec.Friend >= LionizeHireFriendMin {
		if !HasHeroCapacity(officeLevel, CountOwnedHeroes(heroes)) {
			return LionizeHeroResult{}, ErrHotelCapacityFull
		}
		tpl, ok := s.Catalog[target.TemplateCfgID]
		if !ok {
			return LionizeHeroResult{}, ErrUnknownTemplate
		}
		now := s.now()
		st := StatsAtLevel(tpl, 1)
		h := &Hero{
			ServerID: p.ServerID, PlayerID: p.PlayerID,
			TemplateCfgID: tpl.TemplateCfgID, DisplayName: tpl.Name,
			Level: 1, Loyalty: LoyaltyDefault,
			Force: st.Force, Intel: st.Intel, Politics: st.Politics, Command: st.Command,
			Status: StatusIdle, CreatedAt: now,
		}
		if err := s.Store.CreateHero(ctx, h); err != nil {
			return LionizeHeroResult{}, err
		}
		rec.State = LionizeStateRecruited
		if err := store.Put(ctx, p.ServerID, p.PlayerID, npcCfgID, rec); err != nil {
			return LionizeHeroResult{}, err
		}
		return LionizeHeroResult{
			NpcCfgID: npcCfgID, Friend: rec.Friend, State: rec.State, Hero: h, Recruited: true,
		}, nil
	}

	if rec.State == LionizeStateBefriended {
		return LionizeHeroResult{}, ErrInsufficientFriend
	}
	// Initial befriending (legacy LionizeHero).
	if rec.State != LionizeStateNone {
		return LionizeHeroResult{}, ErrLionizeAlreadyFriend
	}
	gold := lionizeGoldCost(target.Level)
	if err := cityPort.SpendGold(ctx, p, gold); err != nil {
		return LionizeHeroResult{}, err
	}
	rec.State = LionizeStateBefriended
	rec.Friend = LionizeInitialFriend
	if err := store.Put(ctx, p.ServerID, p.PlayerID, npcCfgID, rec); err != nil {
		return LionizeHeroResult{}, err
	}
	return LionizeHeroResult{
		NpcCfgID: npcCfgID, Friend: rec.Friend, State: rec.State, GoldSpent: gold, Befriended: true,
	}, nil
}
