package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
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

// Gates observe actual SQL. They do not substitute a participant or transaction.
type returnAttemptLifetimeTrace struct {
	*returnLifetimeTrace
	owned                        returnBackendSet
	mode                         string
	armed                        bool
	generation                   *returnGeneration
	rollbackEnds, rollbackBounds int
}

func (r *returnAttemptLifetimeTrace) gate(ctx context.Context, conn *pgx.Conn) {
	r.reached <- conn.PgConn().PID()
	select {
	case <-r.resume:
	case <-ctx.Done():
	}
	if r.fault != nil {
		panic(r.fault)
	}
}

func (r *returnAttemptLifetimeTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnLifetimeTrace.TraceQueryStart(ctx, conn, data)
	if r.armed && strings.EqualFold(strings.TrimSpace(data.SQL), "rollback") {
		deadline, ok := ctx.Deadline()
		if ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second {
			r.guard.Lock()
			r.rollbackBounds++
			r.guard.Unlock()
		}
	}
	if r.armed && strings.EqualFold(strings.TrimSpace(data.SQL), "commit") && (r.mode == "commit_start" || r.mode == "close") {
		r.gate(ctx, conn)
	}
	return ctx
}

func (r *returnAttemptLifetimeTrace) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {
	r.returnPGTrace.TraceQueryEnd(ctx, conn, data)
	if !r.armed || data.Err != nil {
		return
	}
	q := r.events()[ctx.Value(returnPGTraceKey{}).(int)]
	sql := strings.ToLower(strings.TrimSpace(q.sql))
	if sql == "rollback" && data.CommandTag.String() == "ROLLBACK" {
		r.guard.Lock()
		r.rollbackEnds++
		r.guard.Unlock()
	}
	if r.mode == "precommit" && strings.HasPrefix(sql, "update ") && strings.Contains(sql, `"field_army" set status = 1`) && data.CommandTag.RowsAffected() == 1 ||
		(r.mode == "commit_end" || r.mode == "missing_record") && sql == "commit" && data.CommandTag.String() == "COMMIT" {
		r.gate(ctx, conn)
		if r.mode == "missing_record" {
			// Targeted private diagnostic corruption, not a production-reachable path.
			s := r.generation.s
			s.mu.Lock()
			for a := range s.attempts {
				delete(s.attempts, a)
			}
			s.mu.Unlock()
		}
	}
}

func returnAttemptLifetimeFixture(t *testing.T, mode string, fault any) (*returnAttemptPG, *returnAttemptLifetimeTrace) {
	t.Helper()
	r := &returnAttemptLifetimeTrace{returnLifetimeTrace: returnLifetimeTracer(""), mode: mode}
	r.reached = make(chan uint32, 2)
	f := newReturnAttemptPG(t, r, r.owned.configure)
	r.queries = nil // Initialization has finished; retain only actual attempts below.
	r.armed, r.fault, r.generation, r.bounded = true, fault, f.generation, false
	return f, r
}

type returnAttemptLifetimeResult struct {
	candidate march.ReturnCandidate
	result    returnAttemptResult
	fault     any
}

func returnAttemptLifetimeStart(t *testing.T, f *returnAttemptPG, trace *returnAttemptLifetimeTrace, candidates ...march.ReturnCandidate) <-chan returnAttemptLifetimeResult {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	results, finished := make(chan returnAttemptLifetimeResult, len(candidates)), make(chan struct{})
	var workers sync.WaitGroup
	for _, candidate := range candidates {
		workers.Add(1)
		go func(c march.ReturnCandidate) {
			defer workers.Done()
			r := returnAttemptLifetimeResult{candidate: c}
			defer func() { r.fault = recover(); results <- r }()
			r.result = f.generation.complete(ctx, c)
		}(candidate)
	}
	go func() { workers.Wait(); close(finished) }()
	t.Cleanup(func() {
		cancel()
		trace.release()
		trace.owned.cleanup(t, f, finished)
	})
	return results
}

func returnAttemptLifetimeFinish(t *testing.T, results <-chan returnAttemptLifetimeResult) returnAttemptLifetimeResult {
	t.Helper()
	select {
	case r := <-results:
		return r
	case <-time.After(8 * time.Second):
		t.Fatal("attempt did not finish within cleanup bound")
	}
	return returnAttemptLifetimeResult{}
}

func returnAttemptLifetimeRecords(t *testing.T, f *returnAttemptPG, n int) map[march.ReturnCandidate]*returnAttempt {
	t.Helper()
	s := f.generation.s
	s.mu.Lock()
	defer s.mu.Unlock()
	returnLifetimeCheck(t, len(s.attempts) == n, "attempt identity count", len(s.attempts), n)
	byCandidate := map[march.ReturnCandidate]*returnAttempt{}
	for a := range s.attempts {
		returnLifetimeCheck(t, a.generation == s && byCandidate[a.candidate] == nil, "attempt identity collision")
		byCandidate[a.candidate] = a
	}
	return byCandidate
}

func returnAttemptLifetimeBackend(t *testing.T, f *returnAttemptPG, pid uint32, active bool) {
	t.Helper()
	b := f.pool.Config().ConnConfig.Tracer.(*returnAttemptLifetimeTrace).owned.get(pid)
	if b == nil {
		t.Fatal("missing original lifetime identity", pid)
	}
	var inTransaction bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND xact_start IS NOT NULL)", pid, b.started).Scan(&inTransaction))
	returnLifetimeCheck(t, pid != f.observer.PgConn().PID() && inTransaction == active, "independent backend state", pid, active, inTransaction)
	t.Logf("before tracer release/cleanup: owned backend=%d observer=%d active=%v", pid, f.observer.PgConn().PID(), inTransaction)
}

func returnAttemptLifetimeEffects(t *testing.T, f *returnAttemptPG, stable map[string]string) {
	t.Helper()
	var ready []int32
	var status, army, x, y int32
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop WHERE city_id=$1", f.candidate.CityID).Scan(&ready))
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT m.status,a.status,a.x,a.y FROM march_order m JOIN field_army a USING(server_id,army_id) WHERE m.march_id=$1", f.candidate.MarchID).Scan(&status, &army, &x, &y))
	returnLifetimeCheck(t, reflect.DeepEqual(ready, []int32{18, 20, 19, 23}) && status == 4 && army == 1 && x == 0 && y == 0 &&
		reflect.DeepEqual(stable, snapshotReturnAttemptPG(t, f, true)), "committed credit or retained graph changed", ready, status, army, x, y)
}
