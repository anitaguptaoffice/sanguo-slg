package hero

import (
	"errors"
	"fmt"
)

var ErrInvalidFamilyState = errors.New("hero: invalid family snapshot")

// Family plans are disposable copies, not reservations. API supplies authenticated,
// wallet-protected snapshots; it owns authorization, assets and the sole commit.
// Legacy routes are intentionally unchanged until coordinated replacement.
type ComingTransitionPlan struct {
	Hero   *Hero
	Delete bool
}

func familyHero(p PlayerRef, h *Hero, status int16) error {
	if p.ServerID <= 0 || p.PlayerID <= 0 {
		return ErrInvalidFamilyState
	}
	if h == nil || h.ServerID != p.ServerID || h.PlayerID != p.PlayerID || h.HeroID <= 0 {
		return ErrHeroNotFound
	}
	if h.Status != status {
		if status == StatusComing {
			return ErrHeroNotComing
		}
		return ErrHeroNotCaptive
	}
	return nil
}

func familyCapacity(p PlayerRef, officeLevel int32, owned []*Hero) error {
	for _, h := range owned {
		if h == nil || h.ServerID != p.ServerID || h.PlayerID != p.PlayerID {
			return ErrInvalidFamilyState
		}
	}
	if !HasHeroCapacity(officeLevel, CountOwnedHeroes(owned)) {
		return ErrHotelCapacityFull
	}
	return nil
}

func PlanComingReject(p PlayerRef, cityID int64, h *Hero, rec *ComingRecord) (ComingTransitionPlan, error) {
	if err := familyHero(p, h, StatusComing); err != nil {
		return ComingTransitionPlan{}, err
	}
	if rec == nil {
		return ComingTransitionPlan{}, ErrHeroNotComing
	}
	if cityID > 0 && rec.CityID != cityID {
		return ComingTransitionPlan{}, ErrComingCityMismatch
	}
	copy := *h
	return ComingTransitionPlan{Hero: &copy, Delete: true}, nil
}

func PlanComingAccept(p PlayerRef, cityID int64, h *Hero, rec *ComingRecord, officeLevel int32, owned []*Hero) (ComingTransitionPlan, error) {
	plan, err := PlanComingReject(p, cityID, h, rec)
	if err != nil {
		return ComingTransitionPlan{}, err
	}
	if err := familyCapacity(p, officeLevel, owned); err != nil {
		return ComingTransitionPlan{}, err
	}
	plan.Delete, plan.Hero.Status = false, StatusIdle
	if plan.Hero.Loyalty <= 0 {
		plan.Hero.Loyalty = 70
	}
	return plan, nil
}

// CaptiveTransitionPlan carries exact current costs and inferred requirements.
// Preview persists Record conditionally; summon consumes metadata instead. Both
// must recheck locked state after item locks, and never reuse an old preview.
type CaptiveTransitionPlan struct {
	Hero       *Hero
	Record     CaptiveRecord
	GoldDebit  int64
	ItemDebits []ItemCost
	Summary    string
	Delete     bool
}

func PlanCaptiveRelease(p PlayerRef, cityID int64, h *Hero, rec *CaptiveRecord) (CaptiveTransitionPlan, error) {
	if err := familyHero(p, h, StatusCaptive); err != nil {
		return CaptiveTransitionPlan{}, err
	}
	if rec == nil {
		return CaptiveTransitionPlan{}, ErrHeroNotCaptive
	}
	if cityID > 0 && rec.CityID != cityID {
		return CaptiveTransitionPlan{}, ErrCaptiveCityMismatch
	}
	copy := *h
	return CaptiveTransitionPlan{Hero: &copy, Record: *rec, Delete: true}, nil
}

func PlanCaptivePreview(p PlayerRef, cityID int64, h *Hero, rec *CaptiveRecord) (CaptiveTransitionPlan, error) {
	plan, err := PlanCaptiveRelease(p, cityID, h, rec)
	if err != nil {
		return CaptiveTransitionPlan{}, err
	}
	plan.Delete = false
	ensureSummonRequirements(plan.Hero, &plan.Record)
	plan.GoldDebit = HeroSummonGold(h)
	if plan.Record.SummonItemCfgID > 0 && plan.Record.SummonItemQty > 0 {
		plan.ItemDebits = []ItemCost{{ItemCfgID: plan.Record.SummonItemCfgID, Quantity: plan.Record.SummonItemQty}}
	}
	name := h.DisplayName
	if name == "" {
		name = fmt.Sprintf("将领#%d", h.HeroID)
	}
	plan.Summary = fmt.Sprintf("招降%s需要黄金%d", name, plan.GoldDebit)
	for _, it := range plan.ItemDebits {
		plan.Summary += fmt.Sprintf("，道具%d×%d", it.ItemCfgID, it.Quantity)
	}
	plan.Summary += "。"
	return plan, nil
}

func PlanCaptiveSummon(p PlayerRef, cityID int64, h *Hero, rec *CaptiveRecord, officeLevel int32, owned []*Hero) (CaptiveTransitionPlan, error) {
	if _, err := PlanCaptiveRelease(p, cityID, h, rec); err != nil {
		return CaptiveTransitionPlan{}, err
	}
	if err := familyCapacity(p, officeLevel, owned); err != nil {
		return CaptiveTransitionPlan{}, err
	}
	plan, err := PlanCaptivePreview(p, cityID, h, rec)
	if err != nil {
		return CaptiveTransitionPlan{}, err
	}
	plan.Hero.Status, plan.Hero.Loyalty = StatusIdle, 50
	return plan, nil
}
