package api

import (
	"context"
	"errors"
	"time"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// readReadyGarrison is called after session and WORLD authorization. Hold the
// same WORLD ownership barrier used by stock writers until rollback.
func (g *recruitGeneration) readReadyGarrison(ctx context.Context, pc PlayerContext, cityID int64) (out *domesticv1.CityGarrisonSnapshot, err error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	s := g.s
	s.mu.Lock()
	if s.closed || s.bundle == nil || pc.ServerID != s.profile.ServerID {
		s.mu.Unlock()
		return nil, errRecruitGeneration
	}
	lease, err := s.admission.acquire(ctx)
	bundle := s.bundle
	s.mu.Unlock()
	if err != nil {
		return nil, err
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
			out = nil
		}
		panicRecruitAttempt(fault, cleanupFault)
	}()
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	began = true
	if owner, err = s.binding.Begin(ctx); err != nil {
		return nil, err
	}
	access := owner.Access()
	if err = bundle.city.Pin(ctx, access); err != nil {
		return nil, err
	}
	if err = bundle.military.Pin(ctx, access); err != nil {
		return nil, err
	}
	if err = bundle.city.Lock(ctx, access, pc.PlayerID, cityID); err != nil {
		return nil, err
	}
	ready, err := bundle.military.ReadReadyGarrison(ctx, access, pc.ServerID, pc.PlayerID, cityID)
	if err != nil {
		return nil, err
	}
	out = &domesticv1.CityGarrisonSnapshot{}
	for i, count := range ready {
		if count > 0 {
			out.Troops = append(out.Troops, &domesticv1.ReadyTroopCount{UnitCfgId: int32(i + 1), Count: count})
		}
	}
	return out, nil
}
