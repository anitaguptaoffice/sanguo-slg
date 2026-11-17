package api

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
)

func recruitConfirmedState(t *testing.T, g *recruitGeneration, pending uint64, closed bool, attempts int) {
	t.Helper()
	s := g.s
	s.mu.Lock()
	defer s.mu.Unlock()
	a := s.admission.s
	a.mu.Lock()
	defer a.mu.Unlock()
	if !s.attempted || s.closed != closed || a.closed != closed || a.pending != pending || len(s.attempts) != attempts || (s.bundle == nil) != closed {
		t.Fatal("confirmed completion generation/lease/registry state differs")
	}
	select {
	case <-a.drained:
		if !closed || pending != 0 {
			t.Fatal("open or unfinished completion drained")
		}
	default:
		if closed && pending == 0 {
			t.Fatal("closed known completion did not drain")
		}
	}
}

func TestPGRecruitCompletionConfirmedLifetime(t *testing.T) {
	for _, mode := range []string{"control", "missing_record"} {
		t.Run(mode, func(t *testing.T) {
			var observed *recruitReturnObservedTrace
			var end *recruitConfirmedTrace
			f := newRecruitCompleteReturnPG(t, func(base *recruitPromotionTrace) pgx.QueryTracer {
				observed = &recruitReturnObservedTrace{inner: base}
				end = &recruitConfirmedTrace{inner: observed, gate: returnLifetimeTracer("")}
				return end
			})
			recruitConfirmedControls(t, f)
			state := recruitReturnRowsPaid(t, f, observed)
			copy := *f.recruit
			var call *recruitNoeffectCall
			t.Cleanup(func() {
				if call != nil {
					f.owned.cleanup(t, f.returnAttemptPG, call.done)
				}
			}) // Starter's cancel/release/join precedes exact-owned fallback.
			selected, _ := observed.snapshot()
			full := len(f.trace.events())
			var lower, upper time.Time
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&lower))
			call = startRecruitNoeffect(t, f.recruit, &f.trace.recruitNoeffectTrace, state.candidate)
			t.Cleanup(end.gate.release) // Must run before the starter's bounded join.
			pending := func() {
				t.Helper()
				select {
				case <-call.done:
					t.Fatal("actual completion returned before gate release")
				default:
				}
			}
			pid := returnLifetimeReached(t, call.clock)
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&upper))
			pending()
			if !reflect.DeepEqual(state.paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
				t.Fatal("completion changed paid ledger before clock release")
			}
			call.clock.release()
			if pid == 0 || pid == f.observer.PgConn().PID() || returnLifetimeReached(t, call.commit) != pid {
				t.Fatal("actual completion clock/Commit connection changed")
			}
			pending()
			if !reflect.DeepEqual(state.paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
				t.Fatal("completion provisional effects became visible before Commit")
			}
			end.mu.Lock()
			c := end.last
			end.expected = c // Only this completion's real Commit may enter End gate.
			end.mu.Unlock()
			owned := f.owned.get(pid)
			if c == nil || c.PgConn().PID() != pid || owned == nil || owned.transport != c.PgConn().Conn() {
				t.Fatal("pre-Commit connection is not its captured original transport")
			}
			call.commit.release()
			if returnLifetimeReached(t, end.gate) != pid {
				t.Fatal("confirmed End backend differs")
			}
			pending()
			observed.check(t, f, len(selected), full, nil)
			returnPGOK(t, recruitPromotionRecorded(f.trace.events()[full:], f.observer.PgConn().PID(), f.profileR))
			after := recruitReturnRowsCheckpoint(t, f, state, lower, upper)
			recruitConfirmedState(t, f.recruit, 1, false, 1)
			var original *recruitAttempt
			var before recruitAttempt
			f.recruit.s.mu.Lock()
			for a := range f.recruit.s.attempts {
				original = a
			}
			if original != nil {
				before = *original
			}
			f.recruit.s.mu.Unlock()
			want := recruitAttempt{generation: f.recruit.s, accountID: 1, queueID: state.candidate.QueueID,
				isCompletion: true, candidate: state.candidate, phase: "admitted"}
			if original == nil || !reflect.DeepEqual(before, want) {
				t.Fatal("original completion record identity or provisional result differs")
			}
			lost := mode == "missing_record"
			if lost {
				f.recruit.s.mu.Lock()
				delete(f.recruit.s.attempts, original)
				f.recruit.s.mu.Unlock()
			}
			end.gate.release()
			if !returnBackendJoin(call.done, 8*time.Second) {
				t.Fatal("actual confirmed completion caller did not join")
			}
			r := call.result
			if call.fault != nil || r.outcome != recruitConfirmed || r.completion != march.RecruitCompleted ||
				r.confirmed != (march.RecruitAcceptance{}) || r.cause != nil || r.cleanup != nil ||
				(lost && !errors.Is(r.diagnostic, errRecruitGeneration)) || (!lost && r.diagnostic != nil) {
				t.Fatal("real successful Commit lost its confirmed result", r, call.fault)
			}
			count := 0
			if lost {
				count = 1
			}
			recruitConfirmedState(t, f.recruit, 0, lost, count)
			want.phase, want.result = "commit", r
			f.recruit.s.mu.Lock()
			_, retained := f.recruit.s.attempts[original]
			recorded := *original
			f.recruit.s.mu.Unlock()
			if retained != lost || !reflect.DeepEqual(recorded, want) {
				t.Fatal("final original pointer or full confirmed record changed")
			}
			trace := f.trace.events()
			if lost {
				scope := march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{99}}
				for _, rejected := range []recruitAttemptResult{copy.complete(f.ctx, state.candidate),
					copy.admit(f.ctx, 1, scope, march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 1, Count: 2})} {
					if rejected != (recruitAttemptResult{cause: errRecruitGeneration}) {
						t.Fatal("retired copy started work or changed rejection", rejected)
					}
				}
				if !errors.Is(copy.initialize(f.ctx), errRecruitGeneration) || copy.s != f.recruit.s {
					t.Fatal("retired copy reinitialized or lost shared state")
				}
			}
			if !reflect.DeepEqual(trace, f.trace.events()) || !reflect.DeepEqual(after, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
				t.Fatal("bookkeeping or rejected calls changed SQL/durable ledger")
			}
			recruitConfirmedState(t, f.recruit, 0, lost, count)
			returnPGOK(t, recruitPromotionRecorded(f.trace.events()[full:], f.observer.PgConn().PID(), f.profileR))
			observed.check(t, f, len(selected), full, nil)
			returnAttemptClean(t, f.returnAttemptPG)
			returnPGOK(t, f.recruit.close())
			returnPGOK(t, f.generation.close())
			returnPGOK(t, f.recruit.s.admission.waitDrained(f.ctx))
			returnPGOK(t, f.generation.s.admission.waitDrained(f.ctx))
			returnPGReleased(t, f.ctx, f.observer, f.profile)
			recruitReturnPoolReusable(t, f.ctx, f.pool, f.observer.PgConn().PID())
			if f.pool.Stat().AcquiredConns() != 0 || !reflect.DeepEqual(after, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
				t.Fatal("final drain/lock release/two-slot reuse changed ledger or leaked slot")
			}
		})
	}
}
