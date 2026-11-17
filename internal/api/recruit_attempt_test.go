package api

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

func TestRecruitAttemptPreflight(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	scope := march.RecruitScope{ServerID: 7, PlayerID: 2, CommandID: march.RecruitCommandID{1}}
	if err := recruitAttemptInput(ctx, 7, 1, scope); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []context.Context{nil, context.Background()} {
		if recruitAttemptInput(bad, 7, 1, scope) == nil {
			t.Fatal("unbounded context accepted")
		}
	}
	for _, bad := range []march.RecruitScope{{}, {ServerID: 8, PlayerID: 2, CommandID: scope.CommandID},
		{ServerID: 7, PlayerID: -1, CommandID: scope.CommandID}, {ServerID: 7, PlayerID: 2},
		{ServerID: 7, CommandID: scope.CommandID}} {
		if recruitAttemptInput(ctx, 7, 1, bad) == nil {
			t.Fatal("invalid scope accepted", bad)
		}
	}
	for _, account := range []int64{0, -1} {
		if recruitAttemptInput(ctx, 7, account, scope) == nil {
			t.Fatal("invalid account accepted")
		}
	}
	b, p, catalog := recruitSourceFixture(t)
	g, _ := newRecruitGeneration(b, p, catalog)
	copy := *g
	for _, source := range []*recruitGeneration{nil, {}, g, &copy} {
		if got := source.admit(ctx, 1, scope, march.RecruitIntent{Version: ^uint32(0)}); got.cause == nil || got.outcome != recruitNotStarted {
			t.Fatal("uninitialized source accepted", got)
		}
	}
	_ = copy.close()
	if !g.s.closed || g.s != copy.s || recruitAttemptInput(ctx, 0, 1, scope) == nil || g.admit(ctx, 1, scope, march.RecruitIntent{}).outcome != recruitNotStarted {
		t.Fatal("closed copy or invalid shard admitted")
	}
	cancel()
	if !errors.Is(recruitAttemptInput(ctx, 7, 1, scope), context.Canceled) {
		t.Fatal("cancellation lost")
	}
}

func TestRecruitAttemptCost(t *testing.T) {
	for _, cost := range []march.Resources{{}, {Food: 11, Wood: 22, Iron: 33, Stone: 44}, {Food: 1<<63 - 1}} {
		got, err := recruitDebitCost(cost)
		if err != nil || got != (domestic.Resources{Food: cost.Food, Wood: cost.Wood, Iron: cost.Iron, Stone: cost.Stone}) {
			t.Fatal("named field mapping changed", got, err)
		}
	}
	for _, cost := range []march.Resources{{Food: -1}, {Wood: -1}, {Iron: -1}, {Stone: -1}} {
		if _, err := recruitDebitCost(cost); err == nil {
			t.Fatal("negative cost accepted", cost)
		}
	}
}

func TestRecruitAttemptBookkeeping(t *testing.T) {
	for _, outcome := range []recruitAttemptOutcome{recruitKnownEnded, recruitConfirmed, recruitUnknown} {
		for loss := 0; loss < 3; loss++ {
			b, p, catalog := recruitSourceFixture(t)
			g, _ := newRecruitGeneration(b, p, catalog)
			lease, _ := g.s.admission.acquire(context.Background())
			a := &recruitAttempt{generation: g.s, accountID: 1, scope: march.RecruitScope{ServerID: 7, PlayerID: 2, CommandID: march.RecruitCommandID{1}}, intent: march.RecruitIntent{Version: ^uint32(0)}}
			other := *a // Identical command/intent, distinct attempt identity.
			g.s.attempts = map[*recruitAttempt]struct{}{a: {}, &other: {}}
			if loss == 1 {
				delete(g.s.attempts, a)
			}
			if loss == 2 {
				lease = freshLease{} // Lost bookkeeping must not rewrite acceptance.
			}
			r := recruitAttemptResult{outcome: outcome}
			if outcome == recruitConfirmed {
				r.confirmed = march.RecruitAcceptance{QueueID: 12, CityID: 13, Cost: march.Resources{Iron: 33, Stone: 44}}
			}
			want := r.confirmed
			a.finish(lease, "commit", &r, false, nil, nil)
			_, retained := g.s.attempts[a]
			if r.outcome != outcome || r.confirmed != want || a.result != r || retained != (loss != 0 || outcome == recruitUnknown) || (r.diagnostic != nil) != (loss != 0) {
				t.Fatal("outcome or diagnostic record lost", r, retained)
			}
			pending := uint64(0)
			if outcome == recruitUnknown || loss == 2 {
				pending = 1
			}
			if _, ok := g.s.attempts[&other]; !ok || g.s.admission.s.pending != pending || g.s.closed != (loss != 0 || outcome == recruitUnknown) {
				t.Fatal("other attempt erased or incorrect drain")
			}
		}
	}
}

func TestRecruitAttemptDiagnostics(t *testing.T) {
	for _, err := range []error{nil, march.ErrRecruitConflict, march.ErrRecruitUnsupportedVersion, domestic.ErrRecruitWalletFunds} {
		if recruitAttemptCloses(err) || !recruitAttemptCloses(errors.Join(err, march.ErrFreshCitySource)) {
			t.Fatal("source diagnostic classified as business rejection", err)
		}
	}
	b, p, catalog := recruitSourceFixture(t)
	g, _ := newRecruitGeneration(b, p, catalog)
	lease, _ := g.s.admission.acquire(context.Background())
	a := &recruitAttempt{generation: g.s}
	g.s.attempts = map[*recruitAttempt]struct{}{a: {}}
	primary, cleanup := errors.New("primary"), errors.New("cleanup")
	r := recruitAttemptResult{outcome: recruitUnknown, cause: primary, cleanup: cleanup}
	a.finish(lease, "debit", &r, true, primary, cleanup)
	if _, ok := g.s.attempts[a]; !ok || a.phase != "debit" || a.fault != primary || a.cleanupFault != cleanup || a.result != r || !g.s.closed || g.s.admission.s.pending != 1 {
		t.Fatal("panic diagnostics or unknown lease lost")
	}
}
