package api

import (
	"context"
	"errors"
	"time"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

type preparedCityMilitaryView struct {
	garrison *domesticv1.CityGarrisonSnapshot
	queue    *domesticv1.CurrentRecruitQueue
}

// readCityMilitary is called after session and WORLD authorization. Hold the
// same WORLD ownership barrier used by stock writers until rollback.
func (g *recruitGeneration) readCityMilitary(ctx context.Context, pc PlayerContext, cityID int64) (out preparedCityMilitaryView, err error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	s := g.s
	s.mu.Lock()
	if s.closed || s.bundle == nil || pc.ServerID != s.profile.ServerID {
		s.mu.Unlock()
		return out, errRecruitGeneration
	}
	lease, err := s.admission.acquire(ctx)
	bundle := s.bundle
	s.mu.Unlock()
	if err != nil {
		return out, err
	}

	var owner *recruittx.Owner
	began := false
	defer func() {
		fault := recover()
		var cleanup error
		var cleanupFault any
		if owner != nil {
			cleanup, cleanupFault = rollbackRecruitValidation(owner)
		}
		s.mu.Lock()
		if began && (owner == nil || cleanup != nil) {
			// Keep an unresolved lease visible to runtime drain. Auth and
			// snapshot results are unusable until transaction end is known.
			err = errors.Join(errRecruitGeneration, err, cleanup, lease.unknown())
			s.closed, s.bundle = true, nil
		} else {
			err = errors.Join(err, lease.ended())
		}
		if err == nil && s.closed {
			err = errRecruitGeneration
		}
		s.mu.Unlock()
		if err == nil {
			err = ctx.Err()
		}
		if err != nil {
			out = preparedCityMilitaryView{}
		}
		panicRecruitAttempt(fault, cleanupFault)
	}()
	if err = ctx.Err(); err != nil {
		return out, err
	}
	began = true
	if owner, err = s.binding.Begin(ctx); err != nil {
		return out, err
	}
	access := owner.Access()
	if err = bundle.city.Pin(ctx, access); err != nil {
		return out, err
	}
	if err = bundle.military.Pin(ctx, access); err != nil {
		return out, err
	}
	if err = bundle.city.Lock(ctx, access, pc.PlayerID, cityID); err != nil {
		return out, err
	}
	ready, err := bundle.military.ReadReadyGarrison(ctx, access, pc.ServerID, pc.PlayerID, cityID)
	if err != nil {
		return out, err
	}
	out.garrison = &domesticv1.CityGarrisonSnapshot{}
	for i, count := range ready {
		if count > 0 {
			out.garrison.Troops = append(out.garrison.Troops, &domesticv1.ReadyTroopCount{UnitCfgId: int32(i + 1), Count: count})
		}
	}
	current, queueErr := bundle.military.ReadCurrentRecruitQueue(ctx, access, pc.ServerID, pc.PlayerID, cityID)
	if queueErr == nil {
		out.queue = &domesticv1.CurrentRecruitQueue{HasMore: current.HasMore}
		for _, job := range current.Jobs {
			out.queue.Jobs = append(out.queue.Jobs, &domesticv1.CurrentRecruitJob{
				QueueId: job.QueueID, UnitCfgId: job.UnitCfgID, Count: job.Count,
				Status: int32(job.Status), FinishAtMs: job.FinishAt.UnixMilli(),
			})
		}
	}
	return out, nil
}
