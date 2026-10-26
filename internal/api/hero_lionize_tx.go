package api

import (
	"context"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/jackc/pgx/v5/pgconn"
)

func (s *Server) persuadeAtomic(ctx context.Context, pc PlayerContext, cityID int64, npcID int32) (out hero.PersuadeHeroResult, err error) {
	if cityID <= 0 || npcID <= 0 {
		return out, hero.ErrInvalidRecruit
	}
	err = s.familyAtomic(ctx, pc, "persuade", func(f *familyTx) error {
		if _, e := f.city(ctx, cityID, false); e != nil {
			return e
		}
		rec, e := f.d.lionize.GetLionizeInTx(ctx, f.tx, f.actor, npcID, false)
		if e != nil {
			return e
		}
		preliminary, e := f.d.hotel.service.PlanPersuade(f.actor, hero.CityRef{CityID: cityID}, npcID, rec)
		if e != nil {
			return e
		}
		if e = f.debitItems(ctx, []hero.ItemCost{preliminary.ItemDebit}, 0); e != nil {
			return e
		}
		if _, e = f.heroes(ctx, true); e != nil {
			return e
		}
		locked, e := f.d.lionize.GetLionizeInTx(ctx, f.tx, f.actor, npcID, true)
		if e != nil {
			return e
		}
		// Reuse the single clock capture from the preliminary pure plan. Do not copy
		// Service's mutex/RNG or mutate the live service clock for concurrent requests.
		planner := &hero.Service{}
		planner.SetClock(func() time.Time { return preliminary.Record.LastPersuadeAt })
		plan, e := planner.PlanPersuade(f.actor, hero.CityRef{CityID: cityID}, npcID, locked)
		if e != nil {
			return e
		}
		if plan.ItemDebit != preliminary.ItemDebit {
			return hero.ErrInvalidFamilyState
		}
		if e = f.d.lionize.CompareAndSwapLionizeInTx(ctx, f.tx, f.actor, npcID, locked, plan.Record); e != nil {
			return e
		}
		out = plan.Result
		return nil
	})
	if err != nil {
		return hero.PersuadeHeroResult{}, err
	}
	return out, nil
}

func (s *Server) lionizeAtomic(ctx context.Context, pc PlayerContext, cityID int64, npcID int32) (out hero.LionizeHeroResult, err error) {
	if cityID <= 0 || npcID <= 0 {
		return out, hero.ErrInvalidRecruit
	}
	err = s.familyAtomic(ctx, pc, "lionize", func(f *familyTx) error {
		levels, e := f.city(ctx, cityID, true)
		if e != nil {
			return e
		}
		rows, e := f.heroes(ctx, true)
		if e != nil {
			return e
		}
		locked, e := f.d.lionize.GetLionizeInTx(ctx, f.tx, f.actor, npcID, true)
		if e != nil {
			return e
		}
		plan, e := f.d.hotel.service.PlanLionize(f.actor, hero.CityRef{CityID: cityID}, npcID, locked, levels.Office, rows)
		if e != nil {
			return e
		}
		if plan.Result.Befriended {
			if e = f.debitGold(ctx, plan.GoldDebit); e != nil {
				return e
			}
		}
		if plan.Result.Hero != nil {
			if e = f.d.hotel.heroes.CreateHeroInTx(ctx, f.tx, plan.Result.Hero); e != nil {
				var pgErr *pgconn.PgError
				if errors.As(e, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "uq_player_hero_template_once" {
					return hero.ErrAlreadyOwned
				}
				return e
			}
		}
		if e = f.d.lionize.CompareAndSwapLionizeInTx(ctx, f.tx, f.actor, npcID, locked, plan.Record); e != nil {
			return e
		}
		out = plan.Result
		return nil
	})
	if err != nil {
		return hero.LionizeHeroResult{}, err
	}
	return out, nil
}
