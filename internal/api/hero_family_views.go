package api

import (
	"context"
	"sort"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
)

// List returns the locked hero/metadata snapshot, not a postcommit pool reload.
// Nonlocking metadata discovery under wallet locates the cities to authorize
// before final ordered hero/metadata locks. Missing legacy metadata stays missing.
func (s *Server) familyOffers(ctx context.Context, pc PlayerContext, status int16) (rows []*hero.Hero, meta map[int64]int64, err error) {
	meta = map[int64]int64{}
	err = s.familyAtomic(ctx, pc, "list-offers", func(f *familyTx) error {
		preliminary, e := f.heroes(ctx, false)
		if e != nil {
			return e
		}
		cities := map[int64]bool{}
		discovered := map[int64]int64{}
		readCity := func(h *hero.Hero, lock bool) (int64, error) {
			if status == hero.StatusComing {
				rec, e := f.d.coming.GetComingInTx(ctx, f.tx, f.actor, h.HeroID, lock)
				if e != nil || rec == nil {
					return 0, e
				}
				return rec.CityID, nil
			}
			rec, e := f.d.captive.GetCaptiveInTx(ctx, f.tx, f.actor, h.HeroID, lock)
			if e != nil || rec == nil {
				return 0, e
			}
			return rec.CityID, nil
		}
		for _, h := range preliminary {
			if h.Status != status {
				continue
			}
			city, e := readCity(h, false)
			if e != nil {
				return e
			}
			discovered[h.HeroID] = city
			if city > 0 {
				cities[city] = true
			}
		}
		ordered := make([]int64, 0, len(cities))
		for id := range cities {
			ordered = append(ordered, id)
		}
		sort.Slice(ordered, func(i, j int) bool { return ordered[i] < ordered[j] })
		for _, id := range ordered {
			if _, e := f.city(ctx, id, false); e != nil {
				return e
			}
		}
		locked, e := f.heroes(ctx, true)
		if e != nil {
			return e
		}
		for _, h := range locked {
			if h.Status != status {
				continue
			}
			city, e := readCity(h, true)
			if e != nil {
				return e
			}
			old, ok := discovered[h.HeroID]
			if !ok || old != city {
				return hero.ErrInvalidFamilyState
			}
			rows = append(rows, h)
			if city != 0 {
				meta[h.HeroID] = city
			}
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return rows, meta, nil
}

func (s *Server) familyTargets(ctx context.Context, pc PlayerContext) (out []hero.PersuadeTargetView, err error) {
	err = s.familyAtomic(ctx, pc, "list-targets", func(f *familyTx) error {
		if _, e := f.heroes(ctx, true); e != nil {
			return e
		}
		progress, e := f.d.lionize.ListLionizeInTx(ctx, f.tx, f.actor)
		if e != nil {
			return e
		}
		ids := make([]int, 0, len(progress))
		for id := range progress {
			ids = append(ids, int(id))
		}
		sort.Ints(ids)
		for _, id := range ids {
			rec, e := f.d.lionize.GetLionizeInTx(ctx, f.tx, f.actor, int32(id), true)
			if e != nil {
				return e
			}
			if rec == nil {
				return hero.ErrInvalidFamilyState
			}
			progress[int32(id)] = *rec
		}
		out, e = f.d.hotel.service.PlanPersuadeTargets(progress)
		return e
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
