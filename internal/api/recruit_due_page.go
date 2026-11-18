package api

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// completeDuePage processes one bounded batch on the current generation. The
// scan never credits stock. Each candidate is revalidated under its own
// completion transaction, and only confirmed credits contribute to the count.
func (g *recruitGeneration) completeDuePage(ctx context.Context, limit int) (int, error) {
	jobs, err := g.scanRecruitDue(ctx, limit)
	if err != nil {
		return 0, err
	}
	completed := 0
	for _, job := range jobs {
		result := g.complete(ctx, job.RecruitCandidate)
		if result.outcome == recruitConfirmed && result.completion == march.RecruitCompleted {
			completed++
		}
		if result.outcome != recruitConfirmed || result.cause != nil || result.cleanup != nil || result.diagnostic != nil {
			return completed, errors.Join(errRecruitGeneration, result.cause, result.cleanup, result.diagnostic)
		}
	}
	return completed, nil
}

func (g *recruitGeneration) scanRecruitDue(ctx context.Context, limit int) (jobs []march.RecruitDueJob, err error) {
	if ctx == nil {
		return nil, recruittx.ErrDeadline
	}
	if _, ok := ctx.Deadline(); !ok {
		return nil, recruittx.ErrDeadline
	}
	if g == nil || g.s == nil || limit < 1 || limit > march.MaxDueRecruits {
		return nil, errRecruitGeneration
	}
	s := g.s
	s.mu.Lock()
	if s.closed || s.bundle == nil || s.binding == nil || s.admission == nil {
		s.mu.Unlock()
		return nil, errRecruitGeneration
	}
	lease, err := s.admission.acquire(ctx)
	military := s.bundle.military
	s.mu.Unlock()
	if err != nil {
		return nil, err
	}

	var owner *recruittx.Owner
	defer func() {
		fault := recover()
		var cleanup error
		var cleanupFault any
		if owner != nil {
			cleanup, cleanupFault = rollbackRecruitValidation(owner)
		}
		if fault != nil {
			err = errors.Join(err, fmt.Errorf("recruit due scan panic: %v", fault))
		}
		s.mu.Lock()
		if owner == nil || cleanup != nil {
			err = errors.Join(err, cleanup, lease.unknown())
		} else {
			err = errors.Join(err, lease.ended())
		}
		if err != nil {
			s.closed, s.bundle = true, nil
			err = errors.Join(err, s.admission.close())
		}
		if s.closed {
			jobs, err = nil, errors.Join(errRecruitGeneration, err)
		} else if cause := ctx.Err(); cause != nil {
			jobs, err = nil, cause
		}
		s.mu.Unlock()
		panicRecruitAttempt(fault, cleanupFault)
	}()
	if owner, err = s.binding.Begin(ctx); err != nil {
		return nil, err
	}
	access := owner.Access()
	if err = military.Pin(ctx, access); err != nil {
		return nil, err
	}
	var now time.Time
	if err = access.Scan(ctx, s.binding, "SELECT pg_catalog.clock_timestamp()", nil, &now); err != nil {
		return nil, err
	}
	return military.DueRecruits(ctx, access, march.RecruitDueScope{ServerID: s.profile.ServerID},
		now, march.RecruitDueCursor{}, limit)
}
