package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
)

type comingOperation string

const (
	comingPreview comingOperation = "try-accept"
	comingAccept  comingOperation = "accept"
	comingReject  comingOperation = "reject"
)

func (s *Server) comingAtomic(ctx context.Context, pc PlayerContext, cityID, heroID int64, op comingOperation) (out hero.TryAcceptComingResult, err error) {
	if cityID < 0 || heroID <= 0 {
		return out, hero.ErrInvalidRecruit
	}
	err = s.familyAtomic(ctx, pc, string(op), func(f *familyTx) error {
		rows, e := f.heroes(ctx, false)
		if e != nil {
			return e
		}
		rec, e := f.d.coming.GetComingInTx(ctx, f.tx, f.actor, heroID, false)
		if e != nil {
			return e
		}
		// Validate the existing offer before resolving omitted city; no cached owner.
		if _, e = hero.PlanComingReject(f.actor, cityID, familyHeroByID(rows, heroID), rec); e != nil {
			return e
		}
		levels, e := f.city(ctx, rec.CityID, op == comingAccept)
		if e != nil {
			return e
		}
		rows, e = f.heroes(ctx, true)
		if e != nil {
			return e
		}
		locked, e := f.d.coming.GetComingInTx(ctx, f.tx, f.actor, heroID, true)
		if e != nil {
			return e
		}
		if locked != nil && locked.CityID != rec.CityID {
			return hero.ErrInvalidFamilyState
		}
		h := familyHeroByID(rows, heroID)
		if op == comingPreview {
			out, e = hero.PlanComingPreview(f.actor, cityID, h, locked)
			return e
		}
		var plan hero.ComingTransitionPlan
		switch op {
		case comingAccept:
			plan, e = hero.PlanComingAccept(f.actor, cityID, h, locked, levels.Office, rows)
		case comingReject:
			plan, e = hero.PlanComingReject(f.actor, cityID, h, locked)
		default:
			return hero.ErrInvalidFamilyState
		}
		if e != nil {
			return e
		}
		// Metadata's still-coming owner predicate requires consumption FIRST.
		if e = f.d.coming.ConsumeComingInTx(ctx, f.tx, f.actor, heroID, *locked); e != nil {
			return e
		}
		if plan.Delete {
			e = f.d.hotel.heroes.DeleteFamilyHeroInTx(ctx, f.tx, f.actor, heroID, hero.StatusComing)
		} else {
			e = f.d.hotel.heroes.SetFamilyHeroIdleInTx(ctx, f.tx, f.actor, heroID, hero.StatusComing, plan.Hero.Loyalty)
		}
		out.Hero = plan.Hero
		return e
	})
	if err != nil {
		return hero.TryAcceptComingResult{}, err
	}
	return out, nil
}
