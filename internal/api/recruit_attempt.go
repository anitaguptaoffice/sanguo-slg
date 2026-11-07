package api

import (
	"context"
	"errors"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

type recruitAttemptOutcome uint8

const (
	recruitNotStarted recruitAttemptOutcome = iota
	recruitKnownEnded
	recruitConfirmed
	recruitUnknown
)

type recruitAttemptResult struct {
	outcome                    recruitAttemptOutcome
	confirmed                  march.RecruitAcceptance
	cause, cleanup, diagnostic error
}
type recruitAttempt struct {
	generation          *recruitGenerationState
	accountID, queueID  int64
	scope               march.RecruitScope
	intent              march.RecruitIntent
	phase               string
	result              recruitAttemptResult
	fault, cleanupFault any
}

// New-admission intent validation must not precede historical comparison.
func recruitAttemptInput(ctx context.Context, server int32, accountID int64, scope march.RecruitScope) error {
	if ctx == nil {
		return recruittx.ErrDeadline
	}
	if _, ok := ctx.Deadline(); !ok {
		return recruittx.ErrDeadline
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if server <= 0 || scope.ServerID != server || accountID <= 0 || scope.PlayerID <= 0 || scope.CommandID == (march.RecruitCommandID{}) {
		return errRecruitGeneration
	}
	return nil
}

func recruitDebitCost(cost march.Resources) (domestic.Resources, error) {
	debit := domestic.Resources{Food: cost.Food, Wood: cost.Wood, Iron: cost.Iron, Stone: cost.Stone}
	if debit.Food < 0 || debit.Wood < 0 || debit.Iron < 0 || debit.Stone < 0 ||
		debit.Food != cost.Food || debit.Wood != cost.Wood || debit.Iron != cost.Iron || debit.Stone != cost.Stone {
		return domestic.Resources{}, errRecruitGeneration
	}
	return debit, nil
}

// Exact sentinels only: wrapped/coarse failures may include source diagnostics.
func recruitAttemptCloses(err error) bool {
	return err != nil && err != march.ErrRecruitConflict && err != march.ErrRecruitUnsupportedVersion && err != domestic.ErrRecruitWalletFunds
}

// No SQL here; state -> admission lock order. Diagnostics never rewrite outcome.
func (a *recruitAttempt) finish(lease freshLease, phase string, r *recruitAttemptResult, retire bool, fault, cleanupFault any) {
	s := a.generation
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.attempts[a]; !ok {
		r.diagnostic = errRecruitGeneration
	}
	var err error
	if r.outcome == recruitUnknown {
		err = lease.unknown()
	} else {
		err = lease.ended()
	}
	r.diagnostic = errors.Join(r.diagnostic, err)
	if retire || r.outcome == recruitUnknown || r.diagnostic != nil {
		s.closed, s.bundle = true, nil
		r.diagnostic = errors.Join(r.diagnostic, s.admission.close())
	}
	a.phase, a.result = phase, *r
	a.fault, a.cleanupFault = fault, cleanupFault
	if !retire && r.outcome != recruitUnknown && r.diagnostic == nil {
		delete(s.attempts, a)
	} else {
		if s.attempts == nil {
			s.attempts = make(map[*recruitAttempt]struct{})
		}
		s.attempts[a] = struct{}{}
	}
}

// admit is private and unconnected to Server/routes/workers. Confirmed acceptance
// has no conventional error return that could erase a successfully ended commit.
func (g *recruitGeneration) admit(ctx context.Context, accountID int64, scope march.RecruitScope, intent march.RecruitIntent) (r recruitAttemptResult) {
	if g == nil || g.s == nil {
		r.cause = errRecruitGeneration
		return
	}
	s := g.s
	if r.cause = recruitAttemptInput(ctx, s.profile.ServerID, accountID, scope); r.cause != nil {
		return
	}
	s.mu.Lock()
	if s.closed || s.bundle == nil || s.binding == nil || s.admission == nil {
		s.mu.Unlock()
		r.cause = errRecruitGeneration
		return
	}
	lease, err := s.admission.acquire(ctx)
	if err != nil {
		s.mu.Unlock()
		r.cause = err
		return
	}
	bundle := *s.bundle
	a := &recruitAttempt{generation: s, accountID: accountID, scope: scope, intent: intent, phase: "admitted"}
	if s.attempts == nil {
		s.attempts = make(map[*recruitAttempt]struct{})
	}
	s.attempts[a] = struct{}{}
	s.mu.Unlock()
	var owner *recruittx.Owner
	phase, began := "admitted", false
	defer func() {
		fault := recover()
		var cleanupFault any
		if fault != nil {
			r.cause = errors.Join(r.cause, fmt.Errorf("recruit attempt panic at %s: %v", phase, fault))
		}
		retire := recruitAttemptCloses(r.cause)
		if r.outcome != recruitConfirmed {
			unknown := errors.Is(r.cause, recruittx.ErrOutcomeUnknown) || phase == "commit" && fault != nil
			if owner != nil {
				r.cleanup, cleanupFault = rollbackRecruitValidation(owner)
			}
			r.outcome = recruitKnownEnded
			if unknown || began && (owner == nil || r.cleanup != nil) {
				r.outcome = recruitUnknown
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
	phase = "account lock"
	if r.cause = bundle.actor.Lock(ctx, &access, accountID, scope.PlayerID); r.cause != nil {
		return
	}
	phase = "wallet lock"
	wallet, err := bundle.wallet.Lock(ctx, &access, scope.PlayerID)
	if r.cause = err; err != nil {
		return
	}
	phase = "find"
	queueID, found, err := bundle.military.Find(ctx, &access, scope)
	if r.cause = err; err != nil {
		return
	}
	var acceptance march.RecruitAcceptance
	if found {
		s.mu.Lock()
		a.queueID = queueID
		s.mu.Unlock()
		phase = "history"
		if acceptance, r.cause = bundle.military.History(ctx, &access, scope, intent, queueID); r.cause != nil {
			return
		}
	} else {
		phase = "reverse absent"
		absent, err := bundle.military.ReverseAbsent(ctx, &access, scope)
		if r.cause = err; err != nil {
			return
		}
		if !absent {
			r.cause = march.ErrRecruitUnavailable
			return
		}
		phase = "world lock"
		if r.cause = bundle.city.Lock(ctx, &access, scope.PlayerID, intent.CityID); r.cause != nil {
			return
		}
		phase = "prepare"
		admission, err := bundle.military.Prepare(ctx, &access, scope, intent)
		if r.cause = err; err != nil {
			return
		}
		phase = "cost"
		cost, err := admission.Cost(ctx, &access)
		if r.cause = err; err != nil {
			return
		}
		debit, err := recruitDebitCost(cost)
		if r.cause = err; err != nil {
			return
		}
		phase = "debit"
		if r.cause = wallet.Debit(ctx, &access, debit); r.cause != nil {
			return
		}
		phase = "write"
		if acceptance, r.cause = admission.Write(ctx, &access); r.cause != nil {
			return
		}
		s.mu.Lock()
		a.queueID = acceptance.QueueID
		s.mu.Unlock()
	}
	phase = "commit"
	if r.cause = owner.Commit(ctx); r.cause == nil {
		r.outcome, r.confirmed = recruitConfirmed, acceptance // Before bookkeeping.
	}
	return
}
