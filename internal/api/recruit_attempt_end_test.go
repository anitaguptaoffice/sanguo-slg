package api

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitAttemptEndClassification(t *testing.T) {
	primary := errors.New("original panic")
	wrapped := errors.Join(march.ErrRecruitConflict, errRecruitGeneration)
	for _, tc := range []struct {
		name      string
		began     bool
		owner     *recruittx.Owner
		phase     string
		cause     error
		fault     any
		confirmed bool
		outcome   recruitAttemptOutcome
		closed    bool
		cleanup   bool
	}{
		{name: "before_begin", phase: "admitted", outcome: recruitKnownEnded},
		{name: "exact_business_error", phase: "admitted", cause: march.ErrRecruitConflict, outcome: recruitKnownEnded},
		{name: "wrapped_business_error", phase: "admitted", cause: wrapped, outcome: recruitKnownEnded, closed: true},
		{name: "begin_without_owner", began: true, phase: "begin", outcome: recruitUnknown, closed: true},
		{name: "begin_failure", began: true, phase: "begin", cause: recruittx.ErrBinding, outcome: recruitUnknown, closed: true},
		{name: "cleanup_error", began: true, owner: &recruittx.Owner{}, phase: "write", cause: march.ErrRecruitConflict, outcome: recruitUnknown, closed: true, cleanup: true},
		{name: "unknown_cause", phase: "commit", cause: errors.Join(recruittx.ErrOutcomeUnknown, primary), outcome: recruitUnknown, closed: true},
		{name: "phase_alone_not_unknown", phase: "commit", cause: context.Canceled, outcome: recruitKnownEnded, closed: true},
		{name: "pre_begin_panic", phase: "admitted", fault: primary, outcome: recruitKnownEnded, closed: true},
		{name: "commit_panic", phase: "commit", fault: primary, outcome: recruitUnknown, closed: true},
		{name: "panic_and_cleanup_error", began: true, owner: &recruittx.Owner{}, phase: "write", cause: wrapped, fault: primary, outcome: recruitUnknown, closed: true, cleanup: true},
		{name: "confirmed_skips_cleanup", began: true, owner: &recruittx.Owner{}, phase: "commit", confirmed: true, outcome: recruitConfirmed},
		{name: "confirmed_survives_fault", began: true, owner: &recruittx.Owner{}, phase: "commit", fault: primary, confirmed: true, outcome: recruitConfirmed, closed: true},
		{name: "confirmed_survives_unknown_cause", began: true, phase: "commit", cause: recruittx.ErrOutcomeUnknown, confirmed: true, outcome: recruitConfirmed, closed: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, p, catalog := recruitSourceFixture(t)
			g, err := newRecruitGeneration(b, p, catalog)
			if err != nil {
				t.Fatal(err)
			}
			lease, err := g.s.admission.acquire(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			bundle := &recruitParticipants{}
			g.s.bundle = bundle
			a := &recruitAttempt{generation: g.s, accountID: 1, queueID: 12,
				scope:  march.RecruitScope{ServerID: 7, PlayerID: 2, CommandID: march.RecruitCommandID{1}},
				intent: march.RecruitIntent{CityID: 13}}
			identity := *a
			other := *a
			g.s.attempts = map[*recruitAttempt]struct{}{a: {}, &other: {}}
			r := recruitAttemptResult{cause: tc.cause}
			if tc.confirmed {
				r.outcome = recruitConfirmed
				r.confirmed = march.RecruitAcceptance{QueueID: 12, CityID: 13, Cost: march.Resources{Food: 4}}
			}
			acceptance := r.confirmed
			var gotFault any
			func() {
				defer func() { gotFault = recover() }()
				func() {
					defer func() {
						fault := recover()
						a.end(lease, tc.owner, tc.phase, tc.began, &r, fault)
					}()
					if tc.fault != nil {
						panic(tc.fault)
					}
				}()
			}()
			if gotFault != tc.fault || a.fault != tc.fault || a.cleanupFault != nil {
				t.Fatal("original panic changed or was recorded after propagation", gotFault, a)
			}
			if r.outcome != tc.outcome || r.confirmed != acceptance || r.diagnostic != nil || a.result != r || a.phase != tc.phase {
				t.Fatal("outcome, confirmed acceptance or diagnostic changed", r, a)
			}
			if tc.fault == nil && r.cause != tc.cause || tc.cause != nil && !errors.Is(r.cause, tc.cause) {
				t.Fatal("original cause was lost", r.cause)
			}
			if tc.fault != nil && (r.cause == nil || !strings.Contains(r.cause.Error(), "recruit attempt panic at "+tc.phase+": original panic")) {
				t.Fatal("panic phase or cause was lost", r.cause)
			}
			if (r.cleanup != nil) != tc.cleanup || tc.cleanup && !errors.Is(r.cleanup, recruittx.ErrInactive) {
				t.Fatal("concrete rollback result changed", r.cleanup)
			}
			pending := uint64(0)
			if tc.outcome == recruitUnknown {
				pending = 1
			}
			_, retained := g.s.attempts[a]
			_, otherRetained := g.s.attempts[&other]
			if retained != tc.closed || !otherRetained || g.s.closed != tc.closed || g.s.admission.s.closed != tc.closed || g.s.admission.s.pending != pending {
				t.Fatal("retention, closure or unresolved lease changed", retained, g.s.admission.s)
			}
			if tc.closed && g.s.bundle != nil || !tc.closed && g.s.bundle != bundle {
				t.Fatal("generation bundle lifetime changed")
			}
			if a.generation != identity.generation || a.accountID != identity.accountID || a.queueID != identity.queueID || a.scope != identity.scope || a.intent != identity.intent {
				t.Fatal("attempt identity changed")
			}
			select {
			case <-g.s.admission.s.drained:
				if !tc.closed || pending != 0 {
					t.Fatal("open or unknown work was declared drained")
				}
			default:
				if tc.closed && pending == 0 {
					t.Fatal("known-ended closed work did not drain")
				}
			}
		})
	}
}

func TestRecruitAttemptEndConfirmedBookkeeping(t *testing.T) {
	for _, loss := range []string{"record", "lease"} {
		t.Run(loss, func(t *testing.T) {
			b, p, catalog := recruitSourceFixture(t)
			g, err := newRecruitGeneration(b, p, catalog)
			if err != nil {
				t.Fatal(err)
			}
			lease, err := g.s.admission.acquire(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			a := &recruitAttempt{generation: g.s}
			if loss == "lease" {
				g.s.attempts = map[*recruitAttempt]struct{}{a: {}}
				lease = freshLease{}
			}
			accepted := march.RecruitAcceptance{QueueID: 12, CityID: 13}
			r := recruitAttemptResult{outcome: recruitConfirmed, confirmed: accepted}
			a.end(lease, &recruittx.Owner{}, "commit", true, &r, nil)
			if r.outcome != recruitConfirmed || r.confirmed != accepted || r.cause != nil || r.cleanup != nil || r.diagnostic == nil || a.result != r || !g.s.closed {
				t.Fatal("bookkeeping erased committed success or attempted cleanup", r)
			}
			want := errRecruitGeneration
			pending := uint64(0)
			if loss == "lease" {
				want, pending = errFreshAdmission, 1
			}
			if _, retained := g.s.attempts[a]; !retained || !errors.Is(r.diagnostic, want) || g.s.admission.s.pending != pending {
				t.Fatal("diagnostic or lease retention changed", r)
			}
		})
	}
}

func TestRecruitAttemptEndPanicPriority(t *testing.T) {
	original, cleanup := errors.New("original"), errors.New("cleanup")
	for _, tc := range []struct{ original, cleanup, want any }{
		{}, {original: original, want: original}, {cleanup: cleanup, want: cleanup},
		{original: original, cleanup: cleanup, want: original},
	} {
		var got any
		func() {
			defer func() { got = recover() }()
			panicRecruitAttempt(tc.original, tc.cleanup)
		}()
		if got != tc.want {
			t.Fatal("cleanup replaced original panic", got, tc.want)
		}
	}
}
