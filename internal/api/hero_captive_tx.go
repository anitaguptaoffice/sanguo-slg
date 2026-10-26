package api

import (
	"context"
	"slices"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
)

type captiveOperation string

const (
	captivePreview captiveOperation = "try-summon"
	captiveSummon  captiveOperation = "summon"
	captiveRelease captiveOperation = "release"
)

func (s *Server) captiveAtomic(ctx context.Context, pc PlayerContext, cityID, heroID int64, op captiveOperation) (out hero.TrySummonCaptiveResult, err error) {
	if cityID < 0 || heroID <= 0 {
		return out, hero.ErrInvalidRecruit
	}
	err = s.familyAtomic(ctx, pc, string(op), func(f *familyTx) error {
		rows, e := f.heroes(ctx, false)
		if e != nil {
			return e
		}
		rec, e := f.d.captive.GetCaptiveInTx(ctx, f.tx, f.actor, heroID, false)
		if e != nil {
			return e
		}
		h := familyHeroByID(rows, heroID)
		if _, e = hero.PlanCaptiveRelease(f.actor, cityID, h, rec); e != nil {
			return e
		}
		levels, e := f.city(ctx, rec.CityID, op == captiveSummon)
		if e != nil {
			return e
		}
		var preliminary hero.CaptiveTransitionPlan
		if op == captiveSummon {
			preliminary, e = hero.PlanCaptiveSummon(f.actor, cityID, h, rec, levels.Office, rows)
			if e != nil {
				return e
			}
			if e = f.debitItems(ctx, preliminary.ItemDebits, preliminary.GoldDebit); e != nil {
				return e
			}
		}
		// Item acquisition must finish before any ordered hero/metadata row lock.
		rows, e = f.heroes(ctx, true)
		if e != nil {
			return e
		}
		locked, e := f.d.captive.GetCaptiveInTx(ctx, f.tx, f.actor, heroID, true)
		if e != nil {
			return e
		}
		if locked != nil && locked.CityID != rec.CityID {
			return hero.ErrInvalidFamilyState
		}
		h = familyHeroByID(rows, heroID)
		var plan hero.CaptiveTransitionPlan
		switch op {
		case captivePreview:
			plan, e = hero.PlanCaptivePreview(f.actor, cityID, h, locked)
		case captiveSummon:
			plan, e = hero.PlanCaptiveSummon(f.actor, cityID, h, locked, levels.Office, rows)
		case captiveRelease:
			plan, e = hero.PlanCaptiveRelease(f.actor, cityID, h, locked)
		default:
			return hero.ErrInvalidFamilyState
		}
		if e != nil {
			return e
		}
		if op == captivePreview {
			// A preview never UPSERTs missing metadata or recreates a released offer.
			e = f.d.captive.UpdateCaptiveInTx(ctx, f.tx, f.actor, heroID, *locked, plan.Record)
		} else {
			if op == captiveSummon {
				if preliminary.GoldDebit != plan.GoldDebit || !slices.Equal(preliminary.ItemDebits, plan.ItemDebits) {
					return hero.ErrInvalidFamilyState
				}
				if e = f.debitGold(ctx, plan.GoldDebit); e != nil {
					return e
				}
			}
			if e = f.d.captive.ConsumeCaptiveInTx(ctx, f.tx, f.actor, heroID, *locked); e != nil {
				return e
			}
			if plan.Delete {
				e = f.d.hotel.heroes.DeleteFamilyHeroInTx(ctx, f.tx, f.actor, heroID, hero.StatusCaptive)
			} else {
				e = f.d.hotel.heroes.SetFamilyHeroIdleInTx(ctx, f.tx, f.actor, heroID, hero.StatusCaptive, plan.Hero.Loyalty)
			}
		}
		out = hero.TrySummonCaptiveResult{Hero: plan.Hero, GoldCost: plan.GoldDebit, Items: plan.ItemDebits, Summary: plan.Summary}
		return e
	})
	if err != nil {
		return hero.TrySummonCaptiveResult{}, err
	}
	return out, nil
}
