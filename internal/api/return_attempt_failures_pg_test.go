package api

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgconn/ctxwatch"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Only test SQL is injected; Owner, participant calls and transaction endings are real.
type returnFailureTrace struct {
	*returnLifetimeTrace
	hookSQL string
	hook    func(context.Context, *pgx.Conn) error
	hookErr error
}

func (r *returnFailureTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnLifetimeTrace.TraceQueryStart(ctx, conn, data)
	if r.hook != nil && strings.EqualFold(strings.TrimSpace(data.SQL), r.hookSQL) {
		hook := r.hook
		r.hook = nil // Disable before nested SQL; the trace mutex is already released.
		r.hookErr = hook(ctx, conn)
	}
	return ctx
}

func returnFailureReset(trace *returnLifetimeTrace) {
	trace.mu.Lock()
	trace.queries = nil // Initialization has finished; inspect only the actual attempt.
	trace.mu.Unlock()
	trace.guard.Lock()
	trace.bounded = false
	trace.guard.Unlock()
}

func returnFailureEnds(t *testing.T, f *returnAttemptPG, trace *returnLifetimeTrace, commits, rollbacks int) uint32 {
	t.Helper()
	begin, commit, rollback := 0, 0, 0
	var pid uint32
	for _, q := range trace.events() {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid != pid || q.pid == f.observer.PgConn().PID() {
			t.Fatal("attempt did not use one independent backend", q)
		}
		switch strings.ToLower(strings.TrimSpace(q.sql)) {
		case "begin isolation level read committed":
			begin++
		case "commit":
			commit++
		case "rollback":
			rollback++
		}
	}
	if begin != 1 || commit != commits || rollback != rollbacks || pid == 0 {
		t.Fatal("unexpected actual transaction endings", begin, commit, rollback, pid)
	}
	t.Logf("attempt backend=%d observer=%d commit=%d rollback=%d", pid, f.observer.PgConn().PID(), commit, rollback)
	return pid
}

func returnFailureState(t *testing.T, f *returnAttemptPG, trace *returnLifetimeTrace, result returnAttemptResult, phase string, unknown bool) {
	t.Helper()
	want, pending := returnKnownEnded, uint64(0)
	if unknown {
		want, pending = returnUnknown, 1
	}
	if result.outcome != want || result.cause == nil || result.confirmed != (march.ReturnObservation{}) ||
		result.diagnostic != nil || (result.cleanup != nil) != unknown {
		t.Fatal("failure classification lost", result)
	}
	returnLifetimeState(t, f.generation, pending, true, false)
	s := f.generation.s
	s.mu.Lock()
	var retained *returnAttempt
	count := len(s.attempts)
	for attempt := range s.attempts {
		retained = attempt
	}
	s.mu.Unlock()
	if count != int(pending) || unknown && (retained.generation != s || retained.candidate != f.candidate ||
		retained.phase != phase || !reflect.DeepEqual(retained.result, result) || retained.fault != nil || retained.cleanupFault != nil) {
		t.Fatal("retained original attempt identity or outcome lost", retained, result)
	}
	alias, queries := *f.generation, len(trace.events())
	returnPGOK(t, alias.close())
	returnPGOK(t, alias.close())
	if next := alias.complete(f.ctx, f.candidate); next.outcome != returnNotStarted || !errors.Is(next.cause, errReturnGeneration) ||
		alias.initialize(f.ctx) == nil || len(trace.events()) != queries {
		t.Fatal("closed alias attempted another transaction", next)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	err := s.admission.waitDrained(ctx)
	if unknown && !errors.Is(err, context.DeadlineExceeded) || !unknown && err != nil {
		t.Fatal("drain confused observer knowledge with caller outcome", err)
	}
	s.mu.Lock()
	_, stillRetained := s.attempts[retained]
	unchanged := len(s.attempts) == count && (!unknown || stillRetained && reflect.DeepEqual(retained.result, result))
	s.mu.Unlock()
	if !unchanged {
		t.Fatal("close or rejected retry altered retained outcome")
	}
	returnLifetimeState(t, f.generation, pending, true, false)
}

type returnFailureResult struct {
	result returnAttemptResult
	fault  any
}

func returnFailureStart(t *testing.T, f *returnAttemptPG) (context.CancelFunc, <-chan returnFailureResult) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	done, finished := make(chan returnFailureResult, 1), make(chan struct{})
	go func() {
		var out returnFailureResult
		defer close(finished)
		defer func() { out.fault = recover(); done <- out }()
		out.result = f.generation.complete(ctx, f.candidate)
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case <-finished:
		case <-time.After(8 * time.Second):
			t.Error("attempt cleanup did not finish")
		}
	})
	return cancel, done
}

func TestPGReturnAttemptDeferredCommitFailure(t *testing.T) {
	trace := &returnFailureTrace{returnLifetimeTrace: returnLifetimeTracer("")}
	f := newReturnAttemptPG(t, trace)
	returnPGExec(t, f.ctx, f.observer, `CREATE TABLE return_failure_deferred (id integer,
CONSTRAINT return_failure_unique UNIQUE(id) DEFERRABLE INITIALLY DEFERRED)`)
	before := snapshotReturnAttemptPG(t, f, false)
	returnFailureReset(trace.returnLifetimeTrace)
	provisional := false
	trace.hookSQL = "commit"
	trace.hook = func(ctx context.Context, conn *pgx.Conn) error {
		var ready []int32
		var status, army, x, y int32
		if err := conn.QueryRow(ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop").Scan(&ready); err != nil {
			return err
		}
		if err := conn.QueryRow(ctx, "SELECT m.status,a.status,a.x,a.y FROM march_order m,field_army a").Scan(&status, &army, &x, &y); err != nil {
			return err
		}
		provisional = reflect.DeepEqual(ready, []int32{18, 20, 19, 23}) && status == 4 && army == 1 && x == 0 && y == 0
		_, err := conn.Exec(ctx, "INSERT INTO return_failure_deferred VALUES(1),(1)")
		return err
	}
	result := f.generation.complete(f.ctx, f.candidate)
	returnPGOK(t, trace.hookErr)
	var pgerr *pgconn.PgError
	if !provisional || !errors.Is(result.cause, recruittx.ErrOutcomeUnknown) || !errors.As(result.cause, &pgerr) ||
		pgerr.Code != "23505" || pgerr.SchemaName != f.profile.SchemaName || pgerr.TableName != "return_failure_deferred" ||
		pgerr.ConstraintName != "return_failure_unique" || !errors.Is(result.cleanup, recruittx.ErrInactive) {
		t.Fatal("actual deferred COMMIT failure not witnessed", provisional, result)
	}
	pid := returnFailureEnds(t, f, trace.returnLifetimeTrace, 1, 0)
	for _, q := range trace.events() {
		if strings.EqualFold(q.sql, "commit") && !errors.Is(q.err, pgerr) {
			t.Fatal("deferred error was not the actual COMMIT result", q.err)
		}
	}
	returnLifetimeNoLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
	if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
		t.Fatal("deferred COMMIT failure persisted partial business effects")
	}
	// The observer now knows rollback; this does not resolve the caller's unknown.
	returnFailureState(t, f, trace.returnLifetimeTrace, result, "commit", true)
}

func TestPGReturnAttemptCanceledBeforeAdmission(t *testing.T) {
	trace := returnLifetimeTracer("")
	f := newReturnAttemptPG(t, trace)
	before := snapshotReturnAttemptPG(t, f, false)
	returnFailureReset(trace)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	cancel()
	result := f.generation.complete(ctx, f.candidate)
	if result.outcome != returnNotStarted || !errors.Is(result.cause, context.Canceled) || result.cleanup != nil ||
		result.diagnostic != nil || result.confirmed != (march.ReturnObservation{}) || len(trace.events()) != 0 {
		t.Fatal("pre-admission cancellation attempted SQL or cleanup", result)
	}
	returnAttemptClean(t, f)
	returnLifetimeState(t, f.generation, 0, false, true)
	if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
		t.Fatal("pre-admission cancellation changed persisted state")
	}
}

func TestPGReturnAttemptCanceledPin(t *testing.T) {
	for _, ended := range []bool{false, true} {
		t.Run(fmt.Sprintf("cancel_request_%t", ended), func(t *testing.T) {
			trace := returnLifetimeTracer("")
			f := newReturnAttemptPG(t, trace, func(cfg *pgxpool.Config) {
				if ended {
					cfg.ConnConfig.BuildContextWatcherHandler = func(conn *pgconn.PgConn) ctxwatch.Handler {
						return &pgconn.CancelRequestContextWatcherHandler{Conn: conn, DeadlineDelay: 3 * time.Second}
					}
				}
			})
			before := snapshotReturnAttemptPG(t, f, false)
			blocker := returnPinBlocker(t, f.ctx, f.observer, f.profile, "player_wallet")
			returnFailureReset(trace)
			cancel, done := returnFailureStart(t, f)
			pid := returnPinWitness(t, f.ctx, f.observer, trace, f.profile, 2, blocker.PgConn().PID())
			returnLifetimeState(t, f.generation, 1, false, true)
			cancel()
			var out returnFailureResult
			select {
			case out = <-done:
			case <-time.After(8 * time.Second):
				t.Fatal("canceled attempt exceeded cleanup bound")
			}
			var pgerr *pgconn.PgError
			if out.fault != nil || !(errors.Is(out.result.cause, context.Canceled) || errors.As(out.result.cause, &pgerr) && pgerr.Code == "57014") {
				t.Fatal("actual query cancellation lost", out)
			}
			returnFailureEnds(t, f, trace, 0, 1)
			returnLifetimeRollback(t, trace, !ended)
			returnLifetimeNoLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
			returnPGExec(t, f.ctx, blocker, "ROLLBACK")
			if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
				t.Fatal("canceled attempt changed persisted state")
			}
			returnFailureState(t, f, trace, out.result, "wallet pin", !ended)
		})
	}
}

func TestPGReturnAttemptFailedRollback(t *testing.T) {
	trace := &returnFailureTrace{returnLifetimeTrace: returnLifetimeTracer("")}
	f := newReturnAttemptPG(t, trace)
	returnPGExec(t, f.ctx, f.observer, "UPDATE city_troop SET count=2147483647")
	before := snapshotReturnAttemptPG(t, f, false)
	returnFailureReset(trace.returnLifetimeTrace)
	trace.hookSQL = "rollback"
	trace.hook = func(_ context.Context, conn *pgx.Conn) error {
		pid := conn.PgConn().PID()
		if pid == 0 || pid == f.observer.PgConn().PID() {
			return errors.New("invalid owned backend identity")
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		var terminated bool
		if err := f.observer.QueryRow(ctx, "SELECT pg_catalog.pg_terminate_backend($1,2000)", pid).Scan(&terminated); err != nil {
			return err
		}
		if !terminated {
			return errors.New("owned backend did not terminate before rollback")
		}
		return nil
	}
	result := f.generation.complete(f.ctx, f.candidate)
	returnPGOK(t, trace.hookErr)
	if !errors.Is(result.cause, march.ErrReturnUnavailable) || errors.Is(result.cause, recruittx.ErrOutcomeUnknown) || result.cleanup == nil {
		t.Fatal("original capacity failure and actual rollback failure conflated", result)
	}
	pid := returnFailureEnds(t, f, trace.returnLifetimeTrace, 0, 1)
	returnLifetimeRollback(t, trace.returnLifetimeTrace, true)
	returnLifetimeNoLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
	if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
		t.Fatal("failed rollback changed persisted state")
	}
	returnFailureState(t, f, trace.returnLifetimeTrace, result, "military complete", true)
}
