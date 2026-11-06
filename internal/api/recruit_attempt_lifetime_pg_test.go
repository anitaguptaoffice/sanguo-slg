package api

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

func TestPGRecruitAttemptConfirmedLifetime(t *testing.T) {
	for _, mode := range []string{"close", "missing_record"} {
		t.Run(mode, func(t *testing.T) {
			f, trace := newRecruitAttemptLifetimePG(t, mode)
			before := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			queueOne := recruitAttemptLifetimeQueueOne(t, f)
			var earliest time.Time
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&earliest))
			call := startRecruitAttemptLifetime(t, f, trace)
			pid := returnLifetimeReached(t, trace.returnLifetimeTrace)
			b := trace.owned.get(pid)
			if b == nil || pid == f.observer.PgConn().PID() {
				t.Fatal("missing independent owned backend identity")
			}
			var active bool
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND xact_start IS NOT NULL)", pid, b.started).Scan(&active))
			if active != (mode == "close") {
				t.Fatal("gate did not bracket actual COMMIT", mode, active)
			}
			a := recruitAttemptLifetimeRecord(t, f, 1)
			if a.generation != f.g.s || a.accountID != 1 || a.scope != f.scope || a.intent != f.intent || a.queueID != 100 ||
				a.phase != "admitted" || a.result != (recruitAttemptResult{}) || a.fault != nil || a.cleanupFault != nil {
				t.Fatal("admitted identity changed before APP end classification", a)
			}
			recruitLifetimeState(t, f.g, 1, false, true)
			var accepted march.RecruitAcceptance
			gated := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			if mode == "close" {
				// Owner has ended Access; pgx COMMIT SQL has not executed yet.
				recruitSerialChanges(t, before, gated, false)
				alias := *f.g
				returnPGOK(t, alias.close())
				recruitAttemptLifetimeReject(t, f)
				recruitLifetimeState(t, f.g, 1, true, false)
			} else {
				// Actual nil-error COMMIT callback, before Owner.Commit returns to
				// APP. This changes bookkeeping only, not the commit or its result.
				accepted = recruitAttemptPGObserved(t, f.ctx, f.observer)
				recruitSerialChanges(t, before, gated, true)
				f.g.s.mu.Lock()
				delete(f.g.s.attempts, a)
				f.g.s.mu.Unlock()
				recruitAttemptLifetimeRecord(t, f, 0)
			}
			recruitLifetimeNotDrained(t, f.g)
			select {
			case <-call.done:
				t.Fatal("caller returned while its real COMMIT tracer was gated")
			default:
			}
			trace.release()
			if !returnBackendJoin(call.done, 8*time.Second) {
				t.Fatal("admitted Recruit did not finish after gate release")
			}
			if call.fault != nil {
				t.Fatal("unexpected Recruit panic", call.fault)
			}
			r := call.result
			wantDiagnostic := mode == "missing_record"
			if (r.diagnostic != nil) != wantDiagnostic || wantDiagnostic && !errors.Is(r.diagnostic, errRecruitGeneration) {
				t.Fatal("successful commit lost bookkeeping diagnostic", r)
			}
			clean := r
			clean.diagnostic = nil
			recruitAttemptPGConfirmed(t, clean)
			observed := recruitAttemptPGObserved(t, f.ctx, f.observer)
			if r.confirmed != observed || wantDiagnostic && accepted != observed || observed.AcceptedAt.Before(earliest.UTC().Truncate(time.Millisecond)) {
				t.Fatal("confirmed outcome disagrees with complete durable acceptance", r, observed)
			}
			if a.generation != f.g.s || a.accountID != 1 || a.scope != f.scope || a.intent != f.intent || a.queueID != 100 ||
				a.phase != "commit" || a.result != r || a.fault != nil || a.cleanupFault != nil {
				t.Fatal("original attempt identity or confirmed result was rewritten", a)
			}
			recruitAttemptPGRecorded(t, trace.events(), f.observer, f.profile, false) // Exactly one COMMIT, zero ROLLBACK/retry.
			recruitLifetimeState(t, f.g, 0, true, false)
			retained := 0
			if wantDiagnostic {
				retained = 1
			}
			if got := recruitAttemptLifetimeRecord(t, f, retained); wantDiagnostic && got != a {
				t.Fatal("bookkeeping diagnostic replaced original confirmed attempt")
			}
			returnPGOK(t, f.g.s.admission.waitDrained(f.ctx))
			trace.owned.noLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
			recruitPGReleased(t, f.ctx, f.observer, f.profile)
			after := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			recruitSerialChanges(t, before, after, true)
			if gated["work_queue_id_seq"] != after["work_queue_id_seq"] || wantDiagnostic && !reflect.DeepEqual(gated, after) {
				t.Fatal("commit bookkeeping changed allocator or already committed ledger")
			}
			if queueOne != recruitAttemptLifetimeQueueOne(t, f) {
				t.Fatal("admission changed bootstrap queue1 or its MVCC identity")
			}
			recruitAttemptLifetimeReject(t, f)
			recruitLifetimeState(t, f.g, 0, true, false)
			returnPGOK(t, f.g.s.admission.waitDrained(f.ctx))
			if got := recruitAttemptLifetimeRecord(t, f, retained); wantDiagnostic && got != a || a.result != r ||
				!reflect.DeepEqual(after, returnPGSnapshot(t, f.ctx, f.observer, f.profile)) {
				t.Fatal("close or rejected local retry changed confirmed identity or full ledger")
			}
		})
	}
}
