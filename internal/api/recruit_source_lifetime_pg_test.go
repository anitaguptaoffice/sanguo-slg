package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Only fixture-owned pool connections are closed; await pgx async destruction
// after initialization finishes and before the underlying fixture closes its pool.
func recruitLifetimeFixture(t *testing.T, trace *returnLifetimeTrace, changes ...func(*pgxpool.Config)) (*pgx.Conn, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	var mu sync.Mutex
	var conns []*pgx.Conn
	configure := func(cfg *pgxpool.Config) {
		cfg.ConnConfig.Tracer = trace
		for _, change := range changes {
			change(cfg)
		}
		cfg.MaxConns = 1
		cfg.AfterConnect = func(_ context.Context, conn *pgx.Conn) error {
			mu.Lock()
			defer mu.Unlock()
			conns = append(conns, conn)
			return nil
		}
	}
	observer, binding, profile := recruitPGFixture(t, &trace.returnPGTrace, configure)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		mu.Lock()
		owned := append([]*pgx.Conn(nil), conns...)
		mu.Unlock()
		for _, conn := range owned {
			if err := conn.Close(ctx); err != nil {
				t.Error("owned connection close", err)
			}
			select {
			case <-conn.PgConn().CleanupDone():
			case <-ctx.Done():
				t.Error("owned pgx cleanup exceeded bound")
			}
		}
	})
	return observer, binding, profile
}

func recruitLifetimeStart(t *testing.T, g *recruitGeneration, trace *returnLifetimeTrace) (context.CancelFunc, <-chan returnLifetimeResult) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	done, finished := make(chan returnLifetimeResult, 1), make(chan struct{})
	go func() {
		var result returnLifetimeResult
		defer close(finished)
		defer func() {
			result.fault = recover()
			done <- result
		}()
		result.err = g.initialize(ctx)
	}()
	t.Cleanup(func() {
		cancel()
		trace.release()
		select {
		case <-finished:
		case <-time.After(8 * time.Second):
			t.Error("Recruit initialization cleanup exceeded bound")
		}
	})
	return cancel, done
}

func recruitLifetimeState(t *testing.T, g *recruitGeneration, pending uint64, closed, bundle bool) {
	t.Helper()
	g.s.mu.Lock()
	defer g.s.mu.Unlock()
	a := g.s.admission.s
	a.mu.Lock()
	defer a.mu.Unlock()
	complete := g.s.bundle != nil && g.s.bundle.actor != nil && g.s.bundle.wallet != nil && g.s.bundle.city != nil && g.s.bundle.military != nil
	returnLifetimeCheck(t, g.s.attempted && g.s.closed == closed && a.closed == closed && a.pending == pending && (g.s.bundle != nil) == bundle && complete == bundle,
		"Recruit state mismatch", g.s.attempted, g.s.closed, a.closed, a.pending, g.s.bundle != nil, complete)
}

func recruitLifetimeNotDrained(t *testing.T, g *recruitGeneration) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	returnLifetimeCheck(t, errors.Is(g.s.admission.waitDrained(ctx), context.DeadlineExceeded), "pending work falsely drained")
}

func recruitLifetimeClosed(t *testing.T, g *recruitGeneration, trace *returnLifetimeTrace, pending uint64) {
	t.Helper()
	recruitLifetimeState(t, g, pending, true, false)
	for _, query := range trace.events() {
		returnLifetimeCheck(t, recruitPGSQLKind(query.sql, g.s.profile) != 0, "unexpected failure-path SQL", query.sql)
	}
	returnLifetimeCheck(t, g.s.cause != nil, "closed generation lost diagnostic")
	alias, count := *g, len(trace.events())
	returnLifetimeCheck(t, alias.s == g.s && alias.initialize(returnPGContext(t)) != nil && len(trace.events()) == count, "copied generation retried or reopened")
	returnPGOK(t, alias.close())
	if pending == 0 {
		returnPGOK(t, g.s.admission.waitDrained(returnPGContext(t)))
	} else {
		recruitLifetimeNotDrained(t, g)
	}
	recruitLifetimeState(t, g, pending, true, false)
}

func TestPGRecruitGenerationBeginFailureQuarantine(t *testing.T) {
	trace := returnLifetimeTracer("")
	failure := errors.New("owned pool connection refused before actual connect")
	observer, binding, profile := recruitLifetimeFixture(t, trace, func(cfg *pgxpool.Config) {
		cfg.BeforeConnect = func(context.Context, *pgx.ConnConfig) error { return failure }
	})
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	g, err := newRecruitGeneration(binding, profile, returnPGCatalog(t))
	returnPGOK(t, err)
	err = g.initialize(ctx)
	returnLifetimeCheck(t, errors.Is(err, failure) && g.s.phase == "begin" && len(trace.events()) == 0, "actual Binding.Begin failure lost", err)
	recruitLifetimeClosed(t, g, trace, 1)
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "Begin failure changed fixture")
}

type recruitPanicTrace struct {
	*returnLifetimeTrace
	fault any
	once  sync.Once
}

func (r *recruitPanicTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnLifetimeTrace.TraceQueryStart(ctx, conn, data)
	if !strings.HasPrefix(strings.ToLower(data.SQL), "begin") {
		r.once.Do(func() { panic(r.fault) })
	}
	return ctx
}

func TestPGRecruitGenerationConstructorPanic(t *testing.T) {
	for _, failed := range []bool{false, true} {
		t.Run(map[bool]string{false: "confirmed_cleanup", true: "failed_cleanup"}[failed], func(t *testing.T) {
			trace := returnLifetimeTracer("constructor")
			fault := errors.New("Recruit constructor tracer panic")
			observer, binding, profile := recruitLifetimeFixture(t, trace, func(cfg *pgxpool.Config) {
				cfg.ConnConfig.Tracer = &recruitPanicTrace{returnLifetimeTrace: trace, fault: fault}
			})
			ctx := returnPGContext(t)
			before := returnPGSnapshot(t, ctx, observer, profile)
			g, err := newRecruitGeneration(binding, profile, returnPGCatalog(t))
			returnPGOK(t, err)
			_, done := recruitLifetimeStart(t, g, trace)
			pid := returnLifetimeReached(t, trace)
			pending := uint64(0)
			if failed {
				var terminated bool
				returnPGOK(t, observer.QueryRow(ctx, "SELECT pg_catalog.pg_terminate_backend($1)", pid).Scan(&terminated))
				returnLifetimeCheck(t, terminated, "owned backend termination rejected")
				returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
				pending = 1
			}
			trace.release()
			result := returnLifetimeFinish(t, done)
			returnLifetimeCheck(t, result.fault == fault && g.s.phase == "account constructor" && g.s.cause != nil, "original panic/phase/cause lost", result.fault, g.s.cause)
			returnLifetimeCheck(t, strings.Contains(g.s.cause.Error(), "panic at account constructor") && strings.Contains(g.s.cause.Error(), "recruit validation rollback") == failed, "primary versus cleanup diagnostic lost", g.s.cause)
			returnLifetimeRollback(t, trace, failed)
			recruitLifetimeClosed(t, g, trace, pending)
			returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			recruitPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "constructor panic changed fixture")
		})
	}
}

func TestPGRecruitGenerationRollbackBoundary(t *testing.T) {
	for _, mode := range []string{"close_during_validation", "rollback_failure"} {
		t.Run(mode, func(t *testing.T) {
			trace := returnLifetimeTracer("rollback")
			observer, binding, profile := recruitLifetimeFixture(t, trace)
			ctx := returnPGContext(t)
			before := returnPGSnapshot(t, ctx, observer, profile)
			g, err := newRecruitGeneration(binding, profile, returnPGCatalog(t))
			returnPGOK(t, err)
			_, done := recruitLifetimeStart(t, g, trace)
			pid := returnLifetimeReached(t, trace)
			recruitLifetimeState(t, g, 1, false, false)
			failed := mode == "rollback_failure"
			if failed {
				var terminated bool
				returnPGOK(t, observer.QueryRow(ctx, "SELECT pg_catalog.pg_terminate_backend($1)", pid).Scan(&terminated))
				returnLifetimeCheck(t, terminated, "owned backend termination rejected")
				returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			} else {
				alias := *g
				returnPGOK(t, alias.close())
				recruitLifetimeState(t, g, 1, true, false)
				recruitLifetimeNotDrained(t, g)
			}
			trace.release()
			result := returnLifetimeFinish(t, done)
			returnLifetimeCheck(t, result.err != nil && result.fault == nil && g.s.phase == "rollback", "rollback/close outcome lost", result)
			returnLifetimeRollback(t, trace, failed)
			pending := uint64(0)
			if failed {
				pending = 1
			}
			recruitLifetimeClosed(t, g, trace, pending)
			returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			recruitPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "rollback boundary changed fixture")
		})
	}
}
