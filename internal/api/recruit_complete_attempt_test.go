package api

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitCompletionPreflight(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	c := march.RecruitCandidate{ServerID: 7, PlayerID: 2, CityID: 3, QueueID: 4}
	for _, queue := range []int64{1, 9007199254740991} {
		copy := c
		copy.QueueID = queue
		if err := recruitCompletionInput(ctx, 7, copy); err != nil {
			t.Fatal("legal queue boundary rejected", err)
		}
	}
	for _, bad := range []context.Context{nil, context.Background()} {
		if !errors.Is(recruitCompletionInput(bad, 7, c), recruittx.ErrDeadline) {
			t.Fatal("unbounded context accepted")
		}
	}
	b, p, catalog := recruitSourceFixture(t)
	g, err := newRecruitGeneration(b, p, catalog)
	if err != nil {
		t.Fatal(err)
	}
	bundle := &recruitParticipants{} // No transaction may be reached by invalid input.
	g.s.bundle = bundle
	for _, bad := range []context.Context{nil, context.Background()} {
		if got := g.complete(bad, c); got.outcome != recruitNotStarted || !errors.Is(got.cause, recruittx.ErrDeadline) {
			t.Fatal("unbounded attempt admitted", got)
		}
	}
	for _, bad := range []march.RecruitCandidate{{}, {ServerID: 8, PlayerID: 2, CityID: 3, QueueID: 4},
		{ServerID: 7, CityID: 3, QueueID: 4}, {ServerID: 7, PlayerID: -1, CityID: 3, QueueID: 4},
		{ServerID: 7, PlayerID: 2, QueueID: 4}, {ServerID: 7, PlayerID: 2, CityID: -1, QueueID: 4},
		{ServerID: 7, PlayerID: 2, CityID: 3}, {ServerID: 7, PlayerID: 2, CityID: 3, QueueID: -1},
		{ServerID: 7, PlayerID: 2, CityID: 3, QueueID: 9007199254740992}} {
		if got := g.complete(ctx, bad); got.outcome != recruitNotStarted || got.cause == nil || got.completion != 0 || got.confirmed != (march.RecruitAcceptance{}) {
			t.Fatal("invalid candidate admitted", bad, got)
		}
	}
	if g.s.closed || g.s.bundle != bundle || g.s.admission.s.pending != 0 || len(g.s.attempts) != 0 || recruitCompletionInput(ctx, 0, c) == nil {
		t.Fatal("preflight touched source or accepted invalid shard")
	}
	binding, admission := g.s.binding, g.s.admission
	g.s.binding = nil
	if got := g.complete(ctx, c); got.outcome != recruitNotStarted || got.cause == nil {
		t.Fatal("missing binding admitted", got)
	}
	g.s.binding, g.s.admission = binding, nil
	if got := g.complete(ctx, c); got.outcome != recruitNotStarted || got.cause == nil {
		t.Fatal("missing admission owner admitted", got)
	}
	g.s.admission = admission
	g.s.bundle = nil
	copy := *g
	for _, source := range []*recruitGeneration{nil, {}, g, &copy} {
		if got := source.complete(ctx, c); got.outcome != recruitNotStarted || got.cause == nil {
			t.Fatal("uninitialized source admitted", got)
		}
	}
	if err := copy.close(); err != nil || !g.s.closed || copy.s != g.s || g.complete(ctx, c).outcome != recruitNotStarted {
		t.Fatal("closed copy admitted", err)
	}
	cancel()
	if !errors.Is(recruitCompletionInput(ctx, 7, c), context.Canceled) {
		t.Fatal("cancellation lost")
	}
	expired, stop := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer stop()
	if !errors.Is(recruitCompletionInput(expired, 7, c), context.DeadlineExceeded) {
		t.Fatal("expired deadline accepted")
	}
}

func TestRecruitCompletionDisposition(t *testing.T) {
	for value := 0; value <= 255; value++ {
		if validRecruitCompletion(march.RecruitCompletion(value)) != (value >= 1 && value <= 4) {
			t.Fatal("undeclared disposition accepted or legal disposition rejected", value)
		}
	}
}

// This tests shared bookkeeping only, not a substitute application transaction.
func TestRecruitCompletionBookkeeping(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	for _, tc := range []struct {
		name        string
		outcome     recruitAttemptOutcome
		disposition march.RecruitCompletion
		cause       error
	}{
		{"completed", recruitConfirmed, march.RecruitCompleted, nil},
		{"done", recruitConfirmed, march.RecruitAlreadyDone, nil},
		{"early", recruitConfirmed, march.RecruitEarly, nil},
		{"waiting", recruitConfirmed, march.RecruitWaiting, nil},
		{"unknown", recruitUnknown, 0, recruittx.ErrOutcomeUnknown},
		{"unavailable", recruitKnownEnded, 0, march.ErrRecruitUnavailable},
	} {
		for _, loss := range []string{"none", "record", "lease"} {
			t.Run(tc.name+"/"+loss, func(t *testing.T) {
				b, p, catalog := recruitSourceFixture(t)
				g, err := newRecruitGeneration(b, p, catalog)
				if err != nil {
					t.Fatal(err)
				}
				lease, err := g.s.admission.acquire(context.Background())
				if err != nil {
					t.Fatal(err)
				}
				c := march.RecruitCandidate{ServerID: 7, PlayerID: 2, CityID: 3, QueueID: 4}
				a := &recruitAttempt{generation: g.s, accountID: 1, queueID: c.QueueID, isCompletion: true, candidate: c}
				other := *a // Same candidate, distinct retained attempt pointer.
				g.s.attempts = map[*recruitAttempt]struct{}{a: {}, &other: {}}
				if loss == "record" {
					delete(g.s.attempts, a)
				}
				if loss == "lease" {
					lease = freshLease{}
				}
				r := recruitAttemptResult{outcome: tc.outcome, completion: tc.disposition, cause: tc.cause}
				a.end(lease, nil, "commit", false, &r, nil)
				closed := loss != "none" || tc.cause != nil
				_, retained := g.s.attempts[a]
				if r.outcome != tc.outcome || r.completion != tc.disposition || r.confirmed != (march.RecruitAcceptance{}) || r.cause != tc.cause || r.cleanup != nil || a.result != r {
					t.Fatal("completion outcome changed or admission acceptance manufactured", r)
				}
				if retained != closed || g.s.closed != closed || (r.diagnostic != nil) != (loss != "none") || !a.isCompletion || a.candidate != c || a.accountID != 1 || a.queueID != c.QueueID {
					t.Fatal("completion identity, retirement or diagnostic lost", a)
				}
				pending := uint64(0)
				if tc.outcome == recruitUnknown || loss == "lease" {
					pending = 1
				}
				if _, ok := g.s.attempts[&other]; !ok || g.s.admission.s.pending != pending || g.s.admission.s.closed != closed {
					t.Fatal("sibling attempt or unresolved work lost")
				}
				if closed {
					copy := *g
					scope := march.RecruitScope{ServerID: 7, PlayerID: 2, CommandID: march.RecruitCommandID{1}}
					if copy.complete(ctx, c).outcome != recruitNotStarted || g.admit(ctx, 1, scope, march.RecruitIntent{}).outcome != recruitNotStarted {
						t.Fatal("retired completion allowed new completion/admission")
					}
				}
				select {
				case <-g.s.admission.s.drained:
					if !closed || pending != 0 {
						t.Fatal("open or unknown work drained")
					}
				default:
					if closed && pending == 0 {
						t.Fatal("closed known-ended work did not drain")
					}
				}
			})
		}
	}
}
