package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type recruitFailureTraceKey struct{}

// The context marker excludes only explicitly nested test SQL, never actual port
// SQL. The hook runs synchronously once, with no substituted transaction or result.
type recruitFailureTrace struct {
	returnPGTrace
	profile freshsource.Profile
	stage   string
	hook    func(context.Context, *pgx.Conn) error
	hookErr error
}

func (r *recruitFailureTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if ctx.Value(recruitFailureTraceKey{}) != nil {
		return ctx
	}
	ctx = r.returnPGTrace.TraceQueryStart(ctx, conn, data)
	if stage, ok := recruitAttemptPGStage(data.SQL, r.profile); ok && stage == r.stage && r.hook != nil {
		hook := r.hook
		r.hook = nil
		r.hookErr = hook(context.WithValue(ctx, recruitFailureTraceKey{}, true), conn)
	}
	return ctx
}

func (r *recruitFailureTrace) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {
	if ctx.Value(recruitFailureTraceKey{}) == nil {
		r.returnPGTrace.TraceQueryEnd(ctx, conn, data)
	}
}

type recruitFailurePG struct {
	ctx      context.Context
	observer *pgx.Conn
	profile  freshsource.Profile
	trace    *recruitFailureTrace
	g        *recruitGeneration
	scope    march.RecruitScope
	intent   march.RecruitIntent
}

func newRecruitFailurePG(t *testing.T) *recruitFailurePG {
	t.Helper()
	trace := new(recruitFailureTrace)
	observer, binding, p := recruitPGFixture(t, &trace.returnPGTrace, func(c *pgxpool.Config) {
		c.ConnConfig.Tracer, c.MaxConns = trace, 1
	})
	ctx := returnPGContext(t)
	returnPGExec(t, ctx, observer, "SELECT setval('work_queue_id_seq',100,false)")
	g, err := newRecruitGeneration(binding, p, recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	t.Cleanup(func() { returnPGOK(t, g.close()) })
	trace.profile = p
	trace.mu.Lock()
	trace.queries = nil
	trace.mu.Unlock()
	return &recruitFailurePG{ctx: ctx, observer: observer, profile: p, trace: trace, g: g,
		scope:  march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{9}},
		intent: march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 3, Count: 2}}
}

func (f *recruitFailurePG) unchanged(t *testing.T, before map[string]string, allocated bool) {
	t.Helper()
	after := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
	var last, logged int64
	var called bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT last_value,log_cnt,is_called FROM work_queue_id_seq").Scan(&last, &logged, &called))
	if last != 100 || called != allocated || logged < 0 ||
		(after["work_queue_id_seq"] != before["work_queue_id_seq"]) != allocated {
		t.Fatal("nontransactional allocator evidence mismatched", last, logged, called)
	}
	// Only this allocator may differ. No rolled-back debit, job, origin, receipt,
	// unrelated row, visible xmin/ctid, or other sequence may change.
	after["work_queue_id_seq"] = before["work_queue_id_seq"]
	if !reflect.DeepEqual(before, after) {
		t.Fatal("failure persisted a partial business effect or changed unrelated state")
	}
}

func (f *recruitFailurePG) recorded(t *testing.T, failed string, cause error, allocated bool) {
	t.Helper()
	want := []string{"begin isolation level read committed"}
	for _, name := range recruitPGPinNames {
		want = append(want, "pin:"+name)
	}
	want = append(want, strings.Fields("account-proof actor player wallet-proof wallet military-proof find military-proof reverse city-proof city military-proof marker stock pending")...)
	if allocated {
		want = append(want, "clock", "allocate")
	}
	if failed != "" {
		want = append(want, "debit", "wallet-read", "job")
	}
	if failed == "commit" {
		want = append(want, "origin", "receipt", "readback", "commit")
	} else {
		want = append(want, "rollback")
	}
	var got []string
	var pid uint32
	metadata, failures := 0, 0
	for _, q := range f.trace.events() {
		if pid == 0 {
			pid = q.pid
		}
		if pid == 0 || q.pid != pid || pid == f.observer.PgConn().PID() {
			t.Fatal("attempt did not use one independent backend", q)
		}
		stage, ok := recruitAttemptPGStage(q.sql, f.profile)
		if q.sql == "rollback" {
			stage, ok = "rollback", true
		}
		if !ok {
			t.Fatal("unexpected actual SQL outside the frozen reviewed set", q.sql)
		}
		if q.err != nil {
			failures++
			if stage != failed || !errors.Is(q.err, cause) {
				t.Fatal("failure did not belong to the actual target SQL", stage, q.err)
			}
		}
		if stage == "metadata" {
			metadata++
		} else {
			got = append(got, stage)
		}
	}
	if !reflect.DeepEqual(got, want) || metadata == 0 || (failures == 1) != (cause != nil) || failures > 1 {
		t.Fatal("actual stage order/end/error count mismatched", got, want, metadata, failures)
	}
}

func (f *recruitFailurePG) closed(t *testing.T, result recruitAttemptResult, phase string, queue int64, unknown bool) {
	t.Helper()
	if result.confirmed != (march.RecruitAcceptance{}) || result.diagnostic != nil || (!unknown && result.cleanup != nil) {
		t.Fatal("failed attempt published acceptance or lost clean rollback", result)
	}
	pending := uint64(0)
	if unknown {
		pending = 1
	}
	recruitPGReleased(t, f.ctx, f.observer, f.profile)
	recruitLifetimeState(t, f.g, pending, true, false)
	f.g.s.mu.Lock()
	var retained *recruitAttempt
	count := len(f.g.s.attempts)
	for a := range f.g.s.attempts {
		retained = a
	}
	f.g.s.mu.Unlock()
	if count != 1 || retained.generation != f.g.s || retained.accountID != 1 || retained.scope != f.scope ||
		retained.intent != f.intent || retained.queueID != queue || retained.phase != phase ||
		retained.result != result || retained.fault != nil || retained.cleanupFault != nil {
		t.Fatal("original failed attempt and diagnostic identity lost", retained)
	}
	alias, queries := *f.g, len(f.trace.events())
	returnPGOK(t, alias.close())
	returnPGOK(t, alias.close())
	retry := alias.admit(f.ctx, 1, f.scope, f.intent)
	if retry.outcome != recruitNotStarted || retry.cause != errRecruitGeneration || alias.initialize(f.ctx) == nil || len(f.trace.events()) != queries {
		t.Fatal("closed generation copy attempted a fresh transaction", retry)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	err := f.g.s.admission.waitDrained(ctx)
	if unknown && !errors.Is(err, context.DeadlineExceeded) || !unknown && err != nil {
		t.Fatal("independent server rollback was confused with caller drain", err)
	}
	f.g.s.mu.Lock()
	_, stillRetained := f.g.s.attempts[retained]
	unchanged := len(f.g.s.attempts) == 1 && stillRetained && retained.result == result
	f.g.s.mu.Unlock()
	if !unchanged {
		t.Fatal("close, observer or rejected retry rewrote the original outcome")
	}
	recruitLifetimeState(t, f.g, pending, true, false)
}
