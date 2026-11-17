package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

func returnLifetimeCheck(t *testing.T, ok bool, message string, values ...any) {
	t.Helper()
	if !ok {
		t.Fatal(append([]any{message}, values...)...)
	}
}

// Test-only gates observe real pgx calls; they never replace an Owner or outcome.
type returnLifetimeTrace struct {
	returnPGTrace
	target         string
	fault          any
	reached        chan uint32
	resume         chan struct{}
	once, released sync.Once
	guard          sync.Mutex
	bounded        bool
}

func returnLifetimeTracer(target string) *returnLifetimeTrace {
	return &returnLifetimeTrace{target: target, reached: make(chan uint32, 1), resume: make(chan struct{})}
}
func (r *returnLifetimeTrace) release() { r.released.Do(func() { close(r.resume) }) }
func (r *returnLifetimeTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnPGTrace.TraceQueryStart(ctx, conn, data)
	sql := strings.ToLower(strings.TrimSpace(data.SQL))
	if sql == "rollback" {
		deadline, ok := ctx.Deadline()
		r.guard.Lock()
		r.bounded = ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second
		r.guard.Unlock()
	}
	if sql == r.target || r.target == "constructor" && !strings.HasPrefix(sql, "begin") && sql != "rollback" {
		r.once.Do(func() {
			r.reached <- conn.PgConn().PID()
			if r.fault != nil {
				panic(r.fault)
			}
			select {
			case <-r.resume:
			case <-ctx.Done():
			}
		})
	}
	return ctx
}

type returnLifetimeResult struct {
	err   error
	fault any
}

func returnLifetimeStart(t *testing.T, g *returnGeneration, trace *returnLifetimeTrace) (context.CancelFunc, <-chan returnLifetimeResult) {
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
			t.Error("initialize cleanup did not finish")
		}
	})
	return cancel, done
}
func returnLifetimeFinish(t *testing.T, done <-chan returnLifetimeResult) returnLifetimeResult {
	t.Helper()
	select {
	case result := <-done:
		return result
	case <-time.After(8 * time.Second):
		t.Fatal("initialization ending exceeded cleanup bound")
	}
	return returnLifetimeResult{}
}
func returnLifetimeReached(t *testing.T, trace *returnLifetimeTrace) uint32 {
	t.Helper()
	select {
	case pid := <-trace.reached:
		return pid
	case <-time.After(10 * time.Second):
		t.Fatal("test query gate not reached")
	}
	return 0
}
func returnLifetimeState(t *testing.T, g *returnGeneration, pending uint64, closed, bundle bool) {
	t.Helper()
	g.s.mu.Lock()
	defer g.s.mu.Unlock()
	a := g.s.admission.s
	a.mu.Lock()
	defer a.mu.Unlock()
	if !g.s.attempted || g.s.closed != closed || a.closed != closed || a.pending != pending || (g.s.bundle != nil) != bundle {
		t.Fatalf("generation state: attempted=%v closed=%v/%v pending=%d bundle=%v", g.s.attempted, g.s.closed, a.closed, a.pending, g.s.bundle != nil)
	}
}
func returnLifetimeRollback(t *testing.T, trace *returnLifetimeTrace, failed bool) {
	t.Helper()
	count := 0
	for _, query := range trace.events() {
		if strings.EqualFold(query.sql, "rollback") {
			count++
			returnLifetimeCheck(t, (query.err != nil) == failed, "unexpected actual rollback result", query.err)
		}
	}
	trace.guard.Lock()
	defer trace.guard.Unlock()
	returnLifetimeCheck(t, count == 1 && trace.bounded, "missing independent bounded rollback", count, trace.bounded)
}
func returnLifetimeQuarantined(t *testing.T, g *returnGeneration, trace *returnLifetimeTrace) {
	t.Helper()
	returnLifetimeState(t, g, 1, true, false)
	returnLifetimeCheck(t, g.s.cause != nil, "quarantine lost diagnostic")
	alias, count := *g, len(trace.events())
	returnLifetimeCheck(t, alias.s == g.s && alias.initialize(returnPGContext(t)) != nil && len(trace.events()) == count, "alias reopened quarantined generation")
	returnPGOK(t, alias.close())
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	returnLifetimeCheck(t, errors.Is(alias.s.admission.waitDrained(ctx), context.DeadlineExceeded), "unknown was reported drained")
	returnLifetimeState(t, g, 1, true, false)
}

func TestPGReturnGenerationClosedPoolQuarantine(t *testing.T) {
	trace := returnLifetimeTracer("")
	pool, observer, binding, profile := returnPGFixture(t, trace)
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	g, err := newReturnGeneration(binding, profile, returnPGCatalog(t))
	returnPGOK(t, err)
	pool.Close()
	err = g.initialize(ctx)
	returnLifetimeCheck(t, err != nil && g.s.phase == "begin" && len(trace.events()) == 0, "closed pool did not fail actual Begin", err)
	*binding = recruittx.Binding{} // Replacing the caller's handle cannot clear the retained generation.
	profile.ServerID++
	returnLifetimeQuarantined(t, g, trace)
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "Begin failure changed fixture")
}

func TestPGReturnGenerationConstructorPanic(t *testing.T) {
	trace := returnLifetimeTracer("constructor")
	trace.fault = errors.New("one-shot constructor tracer panic")
	_, observer, binding, profile := returnPGFixture(t, trace)
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	g, err := newReturnGeneration(binding, profile, returnPGCatalog(t))
	returnPGOK(t, err)
	_, done := returnLifetimeStart(t, g, trace)
	pid := returnLifetimeReached(t, trace)
	result := returnLifetimeFinish(t, done)
	returnLifetimeCheck(t, result.fault == trace.fault && g.s.phase == "account constructor" && g.s.cause != nil, "panic or diagnostic lost", result.fault, g.s.cause)
	returnLifetimeRollback(t, trace, false)
	returnLifetimeState(t, g, 0, true, false)
	returnPGOK(t, g.s.admission.waitDrained(ctx))
	returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
	alias := *g
	returnLifetimeCheck(t, alias.initialize(ctx) != nil, "panicked generation reopened")
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "panic changed fixture")
}

func TestPGReturnGenerationRollbackFailureQuarantine(t *testing.T) {
	trace := returnLifetimeTracer("rollback")
	_, observer, binding, profile := returnPGFixture(t, trace)
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	g, err := newReturnGeneration(binding, profile, returnPGCatalog(t))
	returnPGOK(t, err)
	_, done := returnLifetimeStart(t, g, trace)
	pid := returnLifetimeReached(t, trace)
	returnLifetimeState(t, g, 1, false, false)
	var terminated bool
	returnPGOK(t, observer.QueryRow(ctx, "SELECT pg_catalog.pg_terminate_backend($1)", pid).Scan(&terminated))
	returnLifetimeCheck(t, terminated, "owned backend termination not accepted")
	returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
	trace.release()
	result := returnLifetimeFinish(t, done)
	returnLifetimeCheck(t, result.err != nil && result.fault == nil && g.s.phase == "rollback", "actual rollback failure lost", result)
	returnLifetimeRollback(t, trace, true)
	returnLifetimeQuarantined(t, g, trace)
	returnPGReleased(t, ctx, observer, profile)
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "backend termination changed fixture")
}
