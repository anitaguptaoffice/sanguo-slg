package api

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

type returnAttemptOutcome uint8

const (
	returnNotStarted returnAttemptOutcome = iota
	returnKnownEnded
	returnConfirmed
	returnUnknown
)
type returnAttemptResult struct {
	outcome                    returnAttemptOutcome
	confirmed                  march.ReturnObservation
	cause, cleanup, diagnostic error
}
type returnAttempt struct {
	generation          *returnGenerationState
	candidate           march.ReturnCandidate
	phase               string
	result              returnAttemptResult
	fault, cleanupFault any
}

func returnAttemptInput(ctx context.Context, server int32, c march.ReturnCandidate) error {
	if ctx == nil {
		return recruittx.ErrDeadline
	}
	if _, ok := ctx.Deadline(); !ok {
		return recruittx.ErrDeadline
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if server <= 0 || c.ServerID != server {
		return errReturnGeneration
	}
	for _, id := range []int64{c.PlayerID, c.CityID, c.MarchID, c.ArmyID} {
		if id <= 0 || id > 9007199254740991 {
			return errReturnGeneration
		}
	}
	return nil
}

func validReturnObservation(c march.ReturnCandidate, o march.ReturnObservation) bool {
	if o.Candidate != c {
		return false
	}
	switch o.Disposition {
	case march.ReturnAnnihilatedTerminal:
		return o.ReturnAt.IsZero()
	case march.ReturnApplied, march.ReturnCreditedTerminal, march.ReturnEarly:
		return !o.ReturnAt.IsZero() && o.ReturnAt.Location() == time.UTC && o.ReturnAt.Year() >= 1 && o.ReturnAt.Year() <= 9999
	}
	return false
}

func returnAttemptCloses(phase string, err error) bool {
	switch phase {
	case "military pin", "military complete":
		return errors.Is(err, march.ErrReturnSource) // Unavailable wraps ALL Complete errors.
	case "wallet lock":
		return errors.Is(err, domestic.ErrRecruitWalletSource) || !errors.Is(err, domestic.ErrRecruitWalletUnavailable)
	}
	return err != nil // Ambiguous upstream failure, not a claim of metadata drift.
}

// No SQL here. Keep state -> admission lock order; diagnostics cannot rewrite outcome.
func (a *returnAttempt) finish(lease freshLease, phase string, r *returnAttemptResult, retire bool, fault, cleanupFault any) {
	s := a.generation
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.attempts[a]; !ok {
		r.diagnostic = errReturnGeneration
	}
	var err error
	if r.outcome == returnUnknown {
		err = lease.unknown()
	} else {
		err = lease.ended()
	}
	r.diagnostic = errors.Join(r.diagnostic, err)
	if retire || r.outcome == returnUnknown || r.diagnostic != nil {
		s.closed, s.bundle = true, nil
		r.diagnostic = errors.Join(r.diagnostic, s.admission.close())
	}
	a.phase, a.result = phase, *r
	a.fault, a.cleanupFault = fault, cleanupFault
	if r.outcome != returnUnknown && r.diagnostic == nil {
		delete(s.attempts, a)
	} else {
		if s.attempts == nil {
			s.attempts = make(map[*returnAttempt]struct{})
		}
		s.attempts[a] = struct{}{}
	}
}

// complete is deliberately unconnected to any Server, Hub, worker or route.
// A result has no ordinary error channel: confirmed commit and diagnostics coexist.
func (g *returnGeneration) complete(ctx context.Context, c march.ReturnCandidate) (r returnAttemptResult) {
	if g == nil || g.s == nil {
		r.cause = errReturnGeneration
		return
	}
	s := g.s
	if r.cause = returnAttemptInput(ctx, s.profile.ServerID, c); r.cause != nil {
		return
	}
	s.mu.Lock()
	if s.closed || s.bundle == nil {
		s.mu.Unlock()
		r.cause = errReturnGeneration
		return
	}
	lease, err := s.admission.acquire(ctx)
	if err != nil {
		s.mu.Unlock()
		r.cause = err
		return
	}
	bundle := *s.bundle
	a := &returnAttempt{generation: s, candidate: c, phase: "admitted"}
	if s.attempts == nil {
		s.attempts = make(map[*returnAttempt]struct{})
	}
	s.attempts[a] = struct{}{}
	s.mu.Unlock()
	var owner *recruittx.Owner
	phase, began := "admitted", false
	defer func() {
		fault := recover()
		var cleanupFault any
		if fault != nil {
			r.cause = errors.Join(r.cause, fmt.Errorf("return attempt panic at %s: %v", phase, fault))
		}
		retire := fault != nil || returnAttemptCloses(phase, r.cause)
		if r.outcome != returnConfirmed {
			unknown := errors.Is(r.cause, recruittx.ErrOutcomeUnknown) || phase == "commit" && fault != nil
			if owner != nil {
				r.cleanup, cleanupFault = rollbackReturnValidation(owner)
			}
			r.outcome = returnKnownEnded
			if unknown || began && (owner == nil || r.cleanup != nil) {
				r.outcome = returnUnknown
			}
		}
		a.finish(lease, phase, &r, retire, fault, cleanupFault)
		if fault != nil {
			panic(fault)
		}
		if cleanupFault != nil {
			panic(cleanupFault)
		}
	}()
	phase, began = "begin", true
	if owner, r.cause = s.binding.Begin(ctx); r.cause != nil {
		return
	}
	access := *owner.Access()
	phase = "account pin"
	if r.cause = bundle.actor.Pin(ctx, &access); r.cause != nil {
		return
	}
	phase = "wallet pin"
	if r.cause = bundle.wallet.Pin(ctx, &access); r.cause != nil {
		return
	}
	phase = "world pin"
	if r.cause = bundle.city.Pin(ctx, &access); r.cause != nil {
		return
	}
	phase = "military pin"
	if r.cause = bundle.military.Pin(ctx, &access); r.cause != nil {
		return
	}
	phase = "account hint"
	accountID, err := bundle.actor.AccountHint(ctx, &access, c.PlayerID)
	if r.cause = err; err != nil {
		return
	}
	if accountID <= 0 || accountID > 9007199254740991 {
		r.cause = errReturnGeneration
		return
	}
	phase = "account lock"
	if r.cause = bundle.actor.Lock(ctx, &access, accountID, c.PlayerID); r.cause != nil {
		return
	}
	phase = "wallet lock"
	if _, r.cause = bundle.wallet.Lock(ctx, &access, c.PlayerID); r.cause != nil {
		return
	}
	phase = "world lock"
	origin, err := bundle.city.LockReturnOrigin(ctx, &access, c.PlayerID, c.CityID)
	if r.cause = err; err != nil {
		return
	}
	if origin.ServerID != c.ServerID || origin.PlayerID != c.PlayerID || origin.CityID != c.CityID || origin.X < 0 || origin.Y < 0 || origin.X >= world.MapSize || origin.Y >= world.MapSize {
		r.cause = errReturnGeneration
		return
	}
	phase = "military complete"
	observation, err := bundle.military.Complete(ctx, &access, c, march.ReturnOrigin{
		ServerID: origin.ServerID, PlayerID: origin.PlayerID, CityID: origin.CityID, X: origin.X, Y: origin.Y})
	if r.cause = err; err != nil {
		return
	}
	phase = "observation"
	if !validReturnObservation(c, observation) {
		r.cause = errReturnGeneration
		return
	}
	phase = "commit"
	if r.cause = owner.Commit(ctx); r.cause == nil {
		r.outcome, r.confirmed = returnConfirmed, observation // Before any bookkeeping.
	}
	return
}
