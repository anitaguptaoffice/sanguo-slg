package hero

import (
	"context"
	"errors"
	"fmt"
)

// CaptiveSummonItemCfgID is M1 stand-in for legacy jewel goods gid 30–38 subset.
const CaptiveSummonItemCfgID = 2050

// CaptiveRecord holds per-captive metadata (legacy sys_hero_captive + mem_hero_summon).
type CaptiveRecord struct {
	CityID          int64
	SummonItemCfgID int32
	SummonItemQty   int32
}

// CaptiveStore persists captive metadata separate from player_hero rows.
type CaptiveStore interface {
	PutCaptive(ctx context.Context, serverID int32, heroID int64, rec CaptiveRecord) error
	GetCaptive(ctx context.Context, serverID int32, heroID int64) (*CaptiveRecord, error)
	DeleteCaptive(ctx context.Context, serverID int32, heroID int64) error
}

// InjectCaptiveInput seeds a captive hero (GM/tests; battle产俘 follow-up).
type InjectCaptiveInput struct {
	CityID          int64
	TemplateCfgID   int32
	DisplayName     string
	Level           int32
	Force           int32
	Intel           int32
	Politics        int32
	Command         int32
	Loyalty         int
}

// CountOwnedHeroes excludes captives and coming offers from招贤馆容量 (legacy cityHasHeroPosition).
func CountOwnedHeroes(heroes []*Hero) int {
	n := 0
	for _, h := range heroes {
		if h.Status != StatusCaptive && h.Status != StatusComing {
			n++
		}
	}
	return n
}

// HeroSummonGold mirrors legacy getHeroSummonGold (salary basis × 50).
func HeroSummonGold(h *Hero) int64 {
	return HeroSalary(h) * 50
}

func summonItemNeed(level int32) (int32, int32) {
	if level < 50 {
		return 0, 0
	}
	qty := 1 + (level-50)/10
	if qty < 1 {
		qty = 1
	}
	return CaptiveSummonItemCfgID, qty
}

func ensureSummonRequirements(h *Hero, rec *CaptiveRecord) {
	if rec.SummonItemCfgID == 0 && rec.SummonItemQty == 0 {
		id, qty := summonItemNeed(h.Level)
		rec.SummonItemCfgID, rec.SummonItemQty = id, qty
	}
}

// InjectCaptive creates a captive player_hero row plus metadata.
func (s *Service) InjectCaptive(ctx context.Context, p PlayerRef, in InjectCaptiveInput) (*Hero, error) {
	if s.CaptiveStore == nil {
		return nil, errors.New("hero: captive store missing")
	}
	if in.CityID <= 0 {
		return nil, ErrInvalidRecruit
	}
	maxID, err := s.Store.MaxHeroID(ctx, p.ServerID)
	if err != nil {
		return nil, err
	}
	loyalty := in.Loyalty
	if loyalty <= 0 {
		loyalty = 50
	}
	now := s.now()
	h := &Hero{
		ServerID: p.ServerID, HeroID: maxID + 1, PlayerID: p.PlayerID,
		TemplateCfgID: in.TemplateCfgID, DisplayName: in.DisplayName,
		Level: in.Level, Loyalty: loyalty,
		Force: in.Force, Intel: in.Intel, Politics: in.Politics, Command: in.Command,
		Status: StatusCaptive, CreatedAt: now,
	}
	if h.Level < 1 {
		h.Level = 1
	}
	rec := CaptiveRecord{CityID: in.CityID}
	ensureSummonRequirements(h, &rec)
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return nil, err
	}
	if err := s.CaptiveStore.PutCaptive(ctx, p.ServerID, h.HeroID, rec); err != nil {
		return nil, err
	}
	return h, nil
}

func (s *Service) loadCaptiveHero(ctx context.Context, p PlayerRef, heroID int64) (*Hero, *CaptiveRecord, error) {
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, nil, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return nil, nil, ErrHeroNotFound
	}
	if h.Status != StatusCaptive {
		return nil, nil, ErrHeroNotCaptive
	}
	if s.CaptiveStore == nil {
		return nil, nil, errors.New("hero: captive store missing")
	}
	rec, err := s.CaptiveStore.GetCaptive(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, nil, err
	}
	if rec == nil {
		return nil, nil, ErrHeroNotCaptive
	}
	return h, rec, nil
}

// ListCaptiveHeroes returns all captives for a player.
func (s *Service) ListCaptiveHeroes(ctx context.Context, p PlayerRef) ([]*Hero, map[int64]CaptiveRecord, error) {
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return nil, nil, err
	}
	var captives []*Hero
	meta := map[int64]CaptiveRecord{}
	for _, h := range heroes {
		if h.Status != StatusCaptive {
			continue
		}
		captives = append(captives, h)
		if s.CaptiveStore != nil {
			rec, err := s.CaptiveStore.GetCaptive(ctx, p.ServerID, h.HeroID)
			if err != nil {
				return nil, nil, err
			}
			if rec != nil {
				meta[h.HeroID] = *rec
			}
		}
	}
	return captives, meta, nil
}

// TrySummonCaptiveResult is the precheck outcome for captive summon.
type TrySummonCaptiveResult struct {
	Hero     *Hero
	GoldCost int64
	Items    []ItemCost
	Summary  string
}

// TrySummonCaptive validates state and returns costs (legacy trySummonHero).
func (s *Service) TrySummonCaptive(ctx context.Context, p PlayerRef, cityID, heroID int64) (TrySummonCaptiveResult, error) {
	h, rec, err := s.loadCaptiveHero(ctx, p, heroID)
	if err != nil {
		return TrySummonCaptiveResult{}, err
	}
	if cityID > 0 && rec.CityID != cityID {
		return TrySummonCaptiveResult{}, ErrCaptiveCityMismatch
	}
	ensureSummonRequirements(h, rec)
	if err := s.CaptiveStore.PutCaptive(ctx, p.ServerID, heroID, *rec); err != nil {
		return TrySummonCaptiveResult{}, err
	}
	gold := HeroSummonGold(h)
	var items []ItemCost
	if rec.SummonItemCfgID > 0 && rec.SummonItemQty > 0 {
		items = []ItemCost{{ItemCfgID: rec.SummonItemCfgID, Quantity: rec.SummonItemQty}}
	}
	name := h.DisplayName
	if name == "" {
		name = fmt.Sprintf("将领#%d", h.HeroID)
	}
	summary := fmt.Sprintf("招降%s需要黄金%d", name, gold)
	for _, it := range items {
		summary += fmt.Sprintf("，道具%d×%d", it.ItemCfgID, it.Quantity)
	}
	summary += "。"
	return TrySummonCaptiveResult{Hero: h, GoldCost: gold, Items: items, Summary: summary}, nil
}

// SureSummonCaptiveResult is a successful recruit from captive.
type SureSummonCaptiveResult struct {
	Hero *Hero
}

// SureSummonCaptive spends costs and converts captive to owned idle hero (legacy sureSummonHero sans名将概率).
func (s *Service) SureSummonCaptive(ctx context.Context, p PlayerRef, city CityRef, heroID int64, cityPort HotelCityPort, inv InventoryPort) (SureSummonCaptiveResult, error) {
	if cityPort == nil || inv == nil {
		return SureSummonCaptiveResult{}, errors.New("hero: captive dependencies missing")
	}
	h, rec, err := s.loadCaptiveHero(ctx, p, heroID)
	if err != nil {
		return SureSummonCaptiveResult{}, err
	}
	if city.CityID > 0 && rec.CityID != city.CityID {
		return SureSummonCaptiveResult{}, ErrCaptiveCityMismatch
	}
	officeLevel, err := cityPort.OfficeLevel(ctx, p.ServerID, rec.CityID)
	if err != nil {
		return SureSummonCaptiveResult{}, err
	}
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return SureSummonCaptiveResult{}, err
	}
	if !HasHeroCapacity(officeLevel, CountOwnedHeroes(heroes)) {
		return SureSummonCaptiveResult{}, ErrHotelCapacityFull
	}
	pre, err := s.TrySummonCaptive(ctx, p, rec.CityID, heroID)
	if err != nil {
		return SureSummonCaptiveResult{}, err
	}
	wallet, items, err := inv.LoadWalletAndItems(ctx, p)
	if err != nil {
		return SureSummonCaptiveResult{}, err
	}
	for _, it := range pre.Items {
		if items[it.ItemCfgID] < it.Quantity {
			return SureSummonCaptiveResult{}, ErrInsufficientItem
		}
	}
	if wallet.Gold < pre.GoldCost {
		return SureSummonCaptiveResult{}, ErrInsufficientGold
	}
	if err := cityPort.SpendGold(ctx, p, pre.GoldCost); err != nil {
		return SureSummonCaptiveResult{}, err
	}
	for _, it := range pre.Items {
		if err := inv.SpendItemQty(ctx, p, it.ItemCfgID, it.Quantity); err != nil {
			return SureSummonCaptiveResult{}, err
		}
	}
	h.Status = StatusIdle
	h.Loyalty = 50
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return SureSummonCaptiveResult{}, err
	}
	if err := s.CaptiveStore.DeleteCaptive(ctx, p.ServerID, heroID); err != nil {
		return SureSummonCaptiveResult{}, err
	}
	return SureSummonCaptiveResult{Hero: h}, nil
}

// ReleaseCaptive removes a captive hero (legacy releaseHero).
func (s *Service) ReleaseCaptive(ctx context.Context, p PlayerRef, cityID, heroID int64) error {
	h, rec, err := s.loadCaptiveHero(ctx, p, heroID)
	if err != nil {
		return err
	}
	if cityID > 0 && rec.CityID != cityID {
		return ErrCaptiveCityMismatch
	}
	if err := s.CaptiveStore.DeleteCaptive(ctx, p.ServerID, heroID); err != nil {
		return err
	}
	return s.Store.DeleteHero(ctx, p.ServerID, h.HeroID)
}
