package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func recruitCompletionInput(ctx context.Context, server int32, c march.RecruitCandidate) error {
	if ctx == nil {
		return recruittx.ErrDeadline
	}
	if _, ok := ctx.Deadline(); !ok {
		return recruittx.ErrDeadline
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if server <= 0 || c.ServerID != server || c.PlayerID <= 0 || c.CityID <= 0 || c.QueueID < 1 || c.QueueID > 9007199254740991 {
		return errRecruitGeneration
	}
	return nil
}

func validRecruitCompletion(d march.RecruitCompletion) bool {
	switch d {
	case march.RecruitCompleted, march.RecruitAlreadyDone, march.RecruitEarly, march.RecruitWaiting:
		return true
	}
	return false
}

// complete is a private trusted one-candidate operation, not a scanner or route.
// It shares admission's source/lease/registry and never returns tentative effects.
func (g *recruitGeneration) complete(ctx context.Context, c march.RecruitCandidate) (r recruitAttemptResult) {
	if g == nil || g.s == nil {
		r.cause = errRecruitGeneration
		return
	}
	s := g.s
	if r.cause = recruitCompletionInput(ctx, s.profile.ServerID, c); r.cause != nil {
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
	a := &recruitAttempt{generation: s, isCompletion: true, candidate: c, queueID: c.QueueID, phase: "admitted"}
	if s.attempts == nil {
		s.attempts = make(map[*recruitAttempt]struct{})
	}
	s.attempts[a] = struct{}{}
	s.mu.Unlock()
	var owner *recruittx.Owner
	phase, began := "admitted", false
	defer func() {
		fault := recover() // Must be direct in this actual deferred function.
		a.end(lease, owner, phase, began, &r, fault)
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
	if accountID <= 0 {
		r.cause = errRecruitGeneration
		return
	}
	s.mu.Lock()
	a.accountID = accountID
	s.mu.Unlock()
	phase = "account lock"
	if r.cause = bundle.actor.Lock(ctx, &access, accountID, c.PlayerID); r.cause != nil {
		return
	}
	phase = "wallet lock"
	if _, r.cause = bundle.wallet.Lock(ctx, &access, c.PlayerID); r.cause != nil {
		return
	}
	phase = "completion hint"
	hint, err := bundle.military.CompletionHint(ctx, &access, c)
	if r.cause = err; err != nil {
		return
	}
	var disposition march.RecruitCompletion
	switch hint {
	case 2:
		phase = "done history"
		if r.cause = bundle.military.DoneHistory(ctx, &access, c); r.cause != nil {
			return
		}
		disposition = march.RecruitAlreadyDone
	case 0, 1:
		phase = "world lock"
		if r.cause = bundle.city.Lock(ctx, &access, c.PlayerID, c.CityID); r.cause != nil {
			return
		}
		phase = "military complete"
		if disposition, r.cause = bundle.military.Complete(ctx, &access, c); r.cause != nil {
			return
		}
	default:
		r.cause = errRecruitGeneration
		return
	}
	phase = "disposition"
	if !validRecruitCompletion(disposition) {
		r.cause = errRecruitGeneration
		return
	}
	phase = "commit"
	if r.cause = owner.Commit(ctx); r.cause == nil {
		r.outcome, r.completion = recruitConfirmed, disposition // Before bookkeeping.
	}
	return
}
