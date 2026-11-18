package api

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync/atomic"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
)

type preparedMarchRuntime struct {
	source  *militaryGeneration
	route   gateway.RouteHandler
	ctx     context.Context
	cancel  context.CancelFunc
	started atomic.Bool
}

// WirePreparedMarch assembles the isolated gateway lifecycle after staged
// restore and before publishing routes or starting workers. The runtime owner
// holds exclusive writer access and discards the Server if setup fails.
func (s *Server) WirePreparedMarch(ctx context.Context, profile freshsource.Profile, catalog *march.RecruitCatalog) (err error) {
	if !s.MarchRestoreReady() || ctx == nil || s.preparedRecruit != nil || s.preparedMarch != nil ||
		s.firstCityPrepared == nil || s.milDurable == nil || s.firstCityPrepared.Binding != s.milDurable.Binding() {
		return errMilitaryGeneration
	}
	pool, military := s.PlayersPool(), s.milDurable.Profile()
	if pool == nil || !reflect.DeepEqual(military, s.firstCityPrepared.Profile) ||
		!reflect.DeepEqual(military, recruitSourceProjection(profile, recruitSourceInventories()[3])) {
		return errMilitaryGeneration
	}
	source, err := newMilitaryGeneration(s.firstCityPrepared.Binding, profile, catalog)
	if err != nil {
		return err
	}
	runCtx, stop := context.WithCancel(ctx)
	defer func() {
		if err != nil || s.preparedMarch == nil {
			stop()
			_ = source.close()
			s.preparedRecruit = nil
		}
	}()
	startup, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	pair, err := source.initialize(startup)
	if err != nil {
		return err
	}
	s.preparedRecruit = pair.recruit
	route, err := s.preparedMarchHandler(startup)
	if err != nil {
		return err
	}
	reports := report.NewService(report.NewPGStore(pool))
	transition, err := march.NewMarchTransition(reports, pair.returns.s.profile)
	if err != nil {
		return err
	}
	resolver := combat.NewResolver(profile.ServerID, reports, combat.M2FixtureGarrisons(), nil)
	if err = resolver.EnableDurableArrival(pool.BeginTx, transition); err != nil {
		return err
	}
	r := &preparedMarchRuntime{source: source, route: route, ctx: runCtx, cancel: stop}
	if err = s.military.SetDurableMarchReturnHandler(s.preparedReturn(r, pair.returns)); err != nil {
		return err
	}
	if err = s.military.SetPreparedMarchArrivalHandler(s.preparedArrival(r, resolver.HubHandler())); err != nil {
		return err
	}
	s.military.SetMarchFinishedHandler(func(id int64) {
		if err := s.releasePreparedMarchHeroes(r.ctx, military.SchemaName, id); err != nil {
			s.stopPreparedMarch(r, id, "hero release", err)
		}
	})
	if err = startup.Err(); err != nil {
		return err
	}
	if err = s.military.ActivateRestore(); err != nil {
		return err
	}
	s.reports, s.preparedMarch = reports, r
	return nil
}

func (s *Server) preparedArrival(r *preparedMarchRuntime, resolve march.MarchArrivalHandler) march.MarchArrivalHandler {
	return func(_ context.Context, ev march.MarchArrivalEvent) (out march.MarchArrivalOutcome, err error) {
		ctx, cancel := context.WithTimeout(r.ctx, 10*time.Second)
		defer cancel()
		lease, err := r.source.s.admission.acquire(ctx)
		defer func() {
			if fault := recover(); fault != nil {
				err = fmt.Errorf("arrival panic: %v", fault)
			}
			if err != nil {
				if lease.s != nil {
					err = errors.Join(err, lease.unknown())
				}
				s.stopPreparedMarch(r, ev.MarchID, "arrival", err)
			}
		}()
		if err != nil {
			return out, err
		}
		if out, err = resolve(ctx, ev); err == nil {
			err = lease.ended()
		}
		return out, err
	}
}

func (s *Server) preparedReturn(r *preparedMarchRuntime, generation *returnGeneration) march.DurableMarchReturnHandler {
	return func(ev march.DurableMarchReturnEvent) (out march.ReturnObservation, err error) {
		ctx, cancel := context.WithTimeout(r.ctx, 10*time.Second)
		defer cancel()
		defer func() {
			if fault := recover(); fault != nil {
				err = fmt.Errorf("return panic: %v", fault)
			}
			if err != nil {
				s.stopPreparedMarch(r, ev.MarchID, "return", err)
			}
		}()
		c := march.ReturnCandidate{ServerID: generation.s.profile.ServerID, PlayerID: ev.PlayerID,
			CityID: ev.CityID, MarchID: ev.MarchID, ArmyID: ev.ArmyID}
		result := generation.complete(ctx, c)
		if result.outcome != returnConfirmed || !result.confirmed.ReturnAt.Equal(ev.ReturnAt) {
			return out, errors.Join(march.ErrReturnUnavailable, result.cause, result.cleanup, result.diagnostic)
		}
		if result.diagnostic != nil {
			s.stopPreparedMarch(r, ev.MarchID, "return bookkeeping", result.diagnostic)
		}
		return result.confirmed, nil
	}
}

func (s *Server) stopPreparedMarch(r *preparedMarchRuntime, id int64, phase string, err error) {
	r.cancel()
	s.log.Error("prepared march stopped", "march_id", id, "phase", phase, "error", errors.Join(err, r.source.close()))
}

func (s *Server) releasePreparedMarchHeroes(parent context.Context, schema string, id int64) (err error) {
	defer func() {
		if fault := recover(); fault != nil {
			err = fmt.Errorf("terminal march hero release panic: %v", fault)
		}
	}()
	b, ok := s.lookupMarchHero(id)
	if !ok {
		return march.ErrMarchNotFound
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(parent), 5*time.Second)
	defer cancel()
	pc := PlayerContext{ServerID: b.serverID, PlayerID: b.playerID}
	for _, heroID := range append([]int64{b.heroID}, b.otherHeroIDs...) {
		if !s.beginMarchStart(pc, heroID) {
			return fmt.Errorf("terminal march hero %d has an active claim request", heroID)
		}
		err := func() error {
			defer s.endMarchStart(pc, heroID)
			return s.heroSvc.ReleaseMarchOrphan(ctx, schema, hero.PlayerRef{ServerID: b.serverID, PlayerID: b.playerID}, heroID)
		}()
		if err != nil {
			return fmt.Errorf("terminal march hero %d: %w", heroID, err)
		}
	}
	s.takeMarchHero(id)
	return nil
}

// RunPreparedMarchScheduler runs the single prepared worker until shutdown or
// an unresolved arrival/return. Local startup owns its join before pool close.
func (s *Server) RunPreparedMarchScheduler(ctx context.Context) {
	r := s.preparedMarch
	if r == nil || !r.started.CompareAndSwap(false, true) {
		return
	}
	stop := context.AfterFunc(ctx, r.cancel)
	defer stop()
	defer r.cancel()
	defer func() { _ = r.source.close() }()
	s.military.RunScheduler(r.ctx)
}
