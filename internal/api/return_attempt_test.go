package api

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

var returnAttemptCandidate = march.ReturnCandidate{ServerID: 7, PlayerID: 1, CityID: 2, MarchID: 3, ArmyID: 4}

func TestReturnAttemptPreflight(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	c := returnAttemptCandidate
	if returnAttemptInput(ctx, 7, c) != nil {
		t.Fatal("valid candidate rejected")
	}
	for _, bad := range []context.Context{nil, context.Background()} {
		if returnAttemptInput(bad, 7, c) == nil {
			t.Fatal("unbounded context accepted")
		}
	}
	for i := 0; i < 4; i++ {
		for _, id := range []int64{0, -1, 9007199254740992} {
			bad := c
			*[]*int64{&bad.PlayerID, &bad.CityID, &bad.MarchID, &bad.ArmyID}[i] = id
			if returnAttemptInput(ctx, 7, bad) == nil {
				t.Fatal("unsafe identity accepted", bad)
			}
		}
	}
	if returnAttemptInput(ctx, 0, c) == nil || returnAttemptInput(ctx, 8, c) == nil {
		t.Fatal("wrong shard accepted")
	}
	for _, g := range []*returnGeneration{nil, {}} {
		if got := g.complete(ctx, c); got.cause == nil || got.outcome != returnNotStarted {
			t.Fatal("invalid generation accepted", got)
		}
	}
	cancel()
	if !errors.Is(returnAttemptInput(ctx, 7, c), context.Canceled) {
		t.Fatal("cancellation lost")
	}
}

func TestReturnAttemptObservation(t *testing.T) {
	c := returnAttemptCandidate
	at := time.Date(2026, 1, 2, 3, 4, 5, 123456000, time.UTC)
	for _, disposition := range []march.ReturnDisposition{march.ReturnApplied, march.ReturnCreditedTerminal, march.ReturnEarly} {
		o := march.ReturnObservation{Candidate: c, Disposition: disposition, ReturnAt: at}
		if !validReturnObservation(c, o) || o.ReturnAt != at {
			t.Fatal("valid microsecond observation changed or rejected")
		}
		for _, bad := range []time.Time{{}, at.In(time.FixedZone("offset", 3600)), time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC)} {
			o.ReturnAt = bad
			if validReturnObservation(c, o) {
				t.Fatal("invalid instant accepted")
			}
		}
	}
	for _, o := range []march.ReturnObservation{
		{Candidate: c, Disposition: march.ReturnStillReturning, ReturnAt: at},
		{Candidate: c, Disposition: 0, ReturnAt: at},
		{Candidate: c, Disposition: march.ReturnAnnihilatedTerminal, ReturnAt: at},
		{Disposition: march.ReturnAnnihilatedTerminal},
	} {
		if validReturnObservation(c, o) {
			t.Fatal("contradictory observation accepted", o)
		}
	}
	if !validReturnObservation(c, march.ReturnObservation{Candidate: c, Disposition: march.ReturnAnnihilatedTerminal}) {
		t.Fatal("annihilation rejected")
	}
}

func TestReturnAttemptBookkeeping(t *testing.T) {
	for _, outcome := range []returnAttemptOutcome{returnKnownEnded, returnConfirmed, returnUnknown} {
		for _, lost := range []bool{false, true} {
			b, p, catalog := returnSourceFixture(t)
			g, _ := newReturnGeneration(b, p, catalog)
			lease, _ := g.s.admission.acquire(context.Background())
			a := &returnAttempt{generation: g.s, candidate: returnAttemptCandidate}
			g.s.attempts = map[*returnAttempt]struct{}{a: {}}
			other := &returnAttempt{generation: g.s, candidate: returnAttemptCandidate}
			g.s.attempts[other] = struct{}{} // Same candidate, independent identity.
			if lost {
				delete(g.s.attempts, a)
			}
			r := returnAttemptResult{outcome: outcome}
			if outcome == returnConfirmed {
				r.confirmed = march.ReturnObservation{Candidate: a.candidate, Disposition: march.ReturnAnnihilatedTerminal}
			}
			want := r.confirmed
			a.finish(lease, "commit", &r, false, nil, nil)
			_, retained := g.s.attempts[a]
			if r.outcome != outcome || r.confirmed != want || retained != (lost || outcome == returnUnknown) || (r.diagnostic != nil) != lost {
				t.Fatal("outcome or record lost", r, retained)
			}
			pending := uint64(0)
			if outcome == returnUnknown {
				pending = 1
			}
			if _, ok := g.s.attempts[other]; !ok || g.s.admission.s.pending != pending || g.s.closed != (lost || outcome == returnUnknown) {
				t.Fatal("other attempt erased or incorrect drain")
			}
		}
	}
}

func TestReturnAttemptErrorPolicy(t *testing.T) {
	for _, tc := range []struct {
		phase string
		err   error
		close bool
	}{
		{"military complete", errors.Join(march.ErrReturnUnavailable, march.ErrReturnSource), true},
		{"military complete", errors.Join(march.ErrReturnUnavailable, context.Canceled), false},
		{"wallet lock", domestic.ErrRecruitWalletSource, true},
		{"wallet lock", domestic.ErrRecruitWalletUnavailable, false},
		{"account lock", context.Canceled, true},
		{"world lock", errors.New("ambiguous"), true},
	} {
		if returnAttemptCloses(tc.phase, tc.err) != tc.close {
			t.Fatal("wrong retirement policy", tc)
		}
	}
}
