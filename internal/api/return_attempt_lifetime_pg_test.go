package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestPGReturnAttemptPanicLifetime(t *testing.T) {
	for _, tc := range []struct {
		mode string
		n    int
	}{{"precommit", 1}, {"commit_start", 1}, {"commit_end", 1}, {"commit_start", 2}} {
		name := tc.mode
		if tc.n == 2 {
			name = "distinct_concurrent_unknowns"
		}
		t.Run(name, func(t *testing.T) {
			fault := errors.New("original attempt lifetime tracer panic")
			f, trace := returnAttemptLifetimeFixture(t, tc.mode, fault)
			candidates := []march.ReturnCandidate{f.candidate}
			if tc.n == 2 {
				candidates = append(candidates, returnAttemptSeed(t, f.ctx, f.observer, 2))
			}
			before, stable := snapshotReturnAttemptPG(t, f, false), snapshotReturnAttemptPG(t, f, true)
			done := returnAttemptLifetimeStart(t, f, trace, candidates...)
			var pids []uint32
			for i := 0; i < tc.n; i++ {
				pid := returnLifetimeReached(t, trace.returnLifetimeTrace)
				returnAttemptLifetimeBackend(t, f, pid, tc.mode != "commit_end")
				pids = append(pids, pid)
			}
			if tc.n == 2 {
				returnLifetimeCheck(t, pids[0] != pids[1], "independent candidates did not overlap on separate backends")
			}
			returnLifetimeState(t, f.generation, uint64(tc.n), false, true)
			records := returnAttemptLifetimeRecords(t, f, tc.n)
			if tc.mode == "commit_end" {
				returnAttemptLifetimeEffects(t, f, stable)
			} else {
				returnLifetimeCheck(t, reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)), "provisional writes became visible")
			}
			trace.release()
			unknown := tc.mode != "precommit"
			for i := 0; i < tc.n; i++ {
				got := returnAttemptLifetimeFinish(t, done)
				a := records[got.candidate]
				returnLifetimeCheck(t, got.fault == fault && a != nil && a.fault == fault && a.cleanupFault == nil, "original panic or identity lost", got)
				want, phase := returnKnownEnded, "military complete"
				if unknown {
					want, phase = returnUnknown, "commit"
				}
				returnLifetimeCheck(t, a.phase == phase && a.result.outcome == want && a.result.cause != nil &&
					strings.Contains(a.result.cause.Error(), fault.Error()) && a.result.confirmed == (march.ReturnObservation{}) && a.result.diagnostic == nil,
					"panic outcome or diagnostic changed", a.result, a.phase)
				returnLifetimeCheck(t, !unknown && a.result.cleanup == nil || unknown && errors.Is(a.result.cleanup, recruittx.ErrInactive), "APP cleanup classification", a.result.cleanup)
			}
			pending, retained := uint64(0), 0
			if unknown {
				pending, retained = uint64(tc.n), tc.n
			}
			returnLifetimeState(t, f.generation, pending, true, false)
			final := returnAttemptLifetimeRecords(t, f, retained)
			for candidate, a := range final {
				returnLifetimeCheck(t, records[candidate] == a, "unknown record replaced")
			}
			begins, commits, rollbacks, writes := 0, 0, 0, 0
			for _, q := range trace.events() {
				sql := strings.ToLower(strings.TrimSpace(q.sql))
				returnLifetimeCheck(t, q.err == nil && !strings.Contains(sql, "nextval(") && !strings.Contains(sql, "setval("), "unexpected SQL failure or sequence allocation", q)
				switch sql {
				case "begin isolation level read committed":
					begins++
				case "commit":
					commits++
				case "rollback":
					rollbacks++
				}
				if strings.HasPrefix(sql, "update ") {
					writes++
				}
			}
			wantCommits := 0
			if unknown {
				wantCommits = tc.n
			}
			trace.guard.Lock()
			ends, bounds := trace.rollbackEnds, trace.rollbackBounds
			trace.guard.Unlock()
			returnLifetimeCheck(t, begins == tc.n && commits == wantCommits && rollbacks == tc.n && writes == 6*tc.n && ends == tc.n && bounds == tc.n,
				"actual transaction/write/independent rollback counts", begins, commits, rollbacks, writes, ends, bounds)
			for _, pid := range pids {
				returnLifetimeNoLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
			}
			if tc.mode == "commit_end" {
				returnAttemptLifetimeEffects(t, f, stable)
			} else {
				returnLifetimeCheck(t, reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)), "rollback changed graph")
			}
			alias, count := *f.generation, len(trace.events())
			returnPGOK(t, alias.close())
			rejected := alias.complete(f.ctx, f.candidate)
			returnLifetimeCheck(t, rejected.outcome == returnNotStarted && errors.Is(rejected.cause, errReturnGeneration) && len(trace.events()) == count, "closed alias admitted SQL")
			ctx, cancel := context.WithTimeout(f.ctx, 20*time.Millisecond)
			defer cancel()
			err := alias.s.admission.waitDrained(ctx)
			returnLifetimeCheck(t, !unknown && err == nil || unknown && errors.Is(err, context.DeadlineExceeded), "unknown drain was resolved", err)
			returnLifetimeState(t, f.generation, pending, true, false)
		})
	}
}

func TestPGReturnAttemptConfirmedLifetime(t *testing.T) {
	for _, mode := range []string{"close", "missing_record"} {
		t.Run(mode, func(t *testing.T) {
			f, trace := returnAttemptLifetimeFixture(t, mode, nil)
			stable := snapshotReturnAttemptPG(t, f, true)
			done := returnAttemptLifetimeStart(t, f, trace, f.candidate)
			pid := returnLifetimeReached(t, trace.returnLifetimeTrace)
			returnAttemptLifetimeBackend(t, f, pid, mode == "close")
			a := returnAttemptLifetimeRecords(t, f, 1)[f.candidate]
			returnLifetimeState(t, f.generation, 1, false, true)
			alias := *f.generation
			if mode == "close" {
				returnPGOK(t, alias.close())
				returnLifetimeState(t, f.generation, 1, true, false)
				count := len(trace.events())
				rejected := alias.complete(f.ctx, f.candidate)
				returnLifetimeCheck(t, rejected.outcome == returnNotStarted && errors.Is(rejected.cause, errReturnGeneration) && len(trace.events()) == count, "close admitted later work")
			} else {
				returnAttemptLifetimeEffects(t, f, stable)
			}
			trace.release()
			got := returnAttemptLifetimeFinish(t, done)
			returnLifetimeCheck(t, got.fault == nil && a != nil && a.phase == "commit" && reflect.DeepEqual(a.result, got.result), "confirmed record/result mismatch", got)
			wantDiagnostic := mode == "missing_record"
			returnLifetimeCheck(t, (got.result.diagnostic != nil) == wantDiagnostic && (!wantDiagnostic || errors.Is(got.result.diagnostic, errReturnGeneration)), "bookkeeping diagnostic lost", got.result)
			confirmed := got.result
			confirmed.diagnostic = nil // Assert every ordinary success field independently.
			returnAttemptConfirmed(t, f, confirmed, march.ReturnApplied, f.due)
			returnAttemptTrace(t, f, trace.events(), true, 1) // No rollback after nil Commit.
			returnLifetimeState(t, f.generation, 0, true, false)
			retained := 0
			if wantDiagnostic {
				retained = 1
			}
			records := returnAttemptLifetimeRecords(t, f, retained)
			returnLifetimeCheck(t, !wantDiagnostic || records[f.candidate] == a, "diagnostic changed confirmed identity")
			returnPGOK(t, alias.s.admission.waitDrained(f.ctx))
			returnLifetimeNoLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
			returnAttemptLifetimeEffects(t, f, stable)
		})
	}
}
