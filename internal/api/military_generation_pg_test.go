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
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// Only observes actual pgx operations, targeting Return after Recruit ends.
type militaryPGTrace struct {
	*returnLifetimeTrace
	transaction int
	bounds      []bool
}

func militaryPGTracer(target string) *militaryPGTrace {
	return &militaryPGTrace{returnLifetimeTrace: returnLifetimeTracer(target)}
}
func (r *militaryPGTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnPGTrace.TraceQueryStart(ctx, conn, data)
	sql := strings.ToLower(strings.TrimSpace(data.SQL))
	r.guard.Lock()
	if strings.HasPrefix(sql, "begin") {
		r.transaction++
	}
	if sql == "rollback" {
		deadline, ok := ctx.Deadline()
		r.bounds = append(r.bounds, ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second)
	}
	match := r.transaction == 2 && (sql == r.target || r.target == "constructor" && !strings.HasPrefix(sql, "begin") && sql != "rollback")
	r.guard.Unlock()
	if match {
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

type militaryPGResult struct {
	pair  *militarySourcePair
	err   error
	fault any
}

func militaryPGStart(t *testing.T, g *militaryGeneration, trace *militaryPGTrace) (context.CancelFunc, <-chan militaryPGResult) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	done, finished := make(chan militaryPGResult, 1), make(chan struct{})
	go func() {
		var result militaryPGResult
		defer close(finished)
		defer func() { result.fault = recover(); done <- result }()
		result.pair, result.err = g.initialize(ctx)
	}()
	t.Cleanup(func() {
		cancel()
		trace.release()
		select {
		case <-finished:
		case <-time.After(8 * time.Second):
			t.Error("group initialization cleanup exceeded bound")
		}
	})
	return cancel, done
}
func militaryPGFinish(t *testing.T, done <-chan militaryPGResult) militaryPGResult {
	t.Helper()
	select {
	case result := <-done:
		return result
	case <-time.After(8 * time.Second):
		t.Fatal("group initialization did not finish")
	}
	return militaryPGResult{}
}
func militaryPGState(t *testing.T, g *militaryGeneration, pending uint64, closed, published bool) {
	t.Helper()
	g.s.mu.Lock()
	defer g.s.mu.Unlock()
	r, v := g.s.children.recruit.s, g.s.children.returns.s
	r.mu.Lock()
	defer r.mu.Unlock()
	v.mu.Lock()
	defer v.mu.Unlock()
	a := g.s.admission.s
	a.mu.Lock()
	defer a.mu.Unlock()
	returnLifetimeCheck(t, g.s.attempted && g.s.closed == closed && a.closed == closed && a.pending == pending && (g.s.pair != nil) == published, "wrong group lifetime")
	returnLifetimeCheck(t, r.binding == v.binding && r.binding == a.binding && r.admission == v.admission && r.admission == g.s.admission, "split source identity")
	if closed {
		returnLifetimeCheck(t, r.closed && v.closed && r.bundle == nil && v.bundle == nil, "closed group retained a child")
	}
}
func militaryPGTransactions(t *testing.T, trace *militaryPGTrace, observer *pgx.Conn, profile freshsource.Profile, complete, failedRollback bool) {
	t.Helper()
	events, split, rollbacks := trace.events(), -1, 0
	for i, q := range events {
		if strings.HasPrefix(q.sql, "begin") && i != 0 {
			returnLifetimeCheck(t, split == -1, "unexpected third transaction")
			split = i
		}
		if q.sql == "rollback" {
			rollbacks++
			returnLifetimeCheck(t, (q.err != nil) == (failedRollback && rollbacks == 2), "unexpected rollback outcome", q.err)
		}
	}
	returnLifetimeCheck(t, split > 0 && rollbacks == 2, "missing both actual transactions")
	recruitPGRecorded(t, &returnPGTrace{queries: events[:split]}, observer, profile, 9)
	var pins, want []string
	for _, q := range events[:split] {
		if strings.HasPrefix(q.sql, "LOCK TABLE ") {
			pins = append(pins, q.sql)
		}
	}
	for i, name := range recruitPGPinNames {
		prefix, mode := "LOCK TABLE ", "ROW EXCLUSIVE"
		if i >= 4 {
			prefix = "LOCK TABLE ONLY "
		}
		if i < 2 || i == 3 {
			mode = "ROW SHARE"
		}
		want = append(want, prefix+pgx.Identifier{profile.SchemaName, name}.Sanitize()+" IN "+mode+" MODE")
	}
	returnLifetimeCheck(t, reflect.DeepEqual(pins, want), "wrong Recruit pin order")
	if complete {
		returnPGRecorded(t, &returnPGTrace{queries: events[split:]}, profile, true)
	}
	trace.guard.Lock()
	defer trace.guard.Unlock()
	returnLifetimeCheck(t, reflect.DeepEqual(trace.bounds, []bool{true, true}), "rollback used canceled or unbounded context", trace.bounds)
}

func TestPGMilitaryGenerationCaptureAndAssembly(t *testing.T) {
	trace := militaryPGTracer("")
	_, observer, binding, profile := returnPGFixture(t, trace)
	ctx, catalog := returnPGContext(t), returnPGCatalog(t)
	saved, err := freshsource.Snapshot(profile)
	returnPGOK(t, err)
	before := returnPGSnapshot(t, ctx, observer, saved)
	g, err := newMilitaryGeneration(binding, profile, catalog)
	returnPGOK(t, err)
	*binding, *catalog = recruittx.Binding{}, march.RecruitCatalog{}
	for name := range profile.Objects {
		profile.Objects[name] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1}
	}
	profile = freshsource.Profile{}
	pair, err := g.initialize(ctx)
	returnPGOK(t, err)
	returnLifetimeCheck(t, pair != nil && pair == g.s.pair, "pair was not published")
	r, v := pair.recruit.s.bundle, pair.returns.s.bundle
	returnLifetimeCheck(t, r != nil && v != nil && r.actor != nil && r.wallet != nil && r.city != nil && r.military != nil && v.actor != nil && v.wallet != nil && v.city != nil && v.military != nil, "incomplete concrete assembly")
	militaryPGState(t, g, 0, false, true)
	militaryPGTransactions(t, trace, observer, saved, true, false)
	alias, count := *g, len(trace.events())
	again, err := alias.initialize(ctx)
	returnLifetimeCheck(t, again == nil && err != nil && len(trace.events()) == count, "successful alias retried")
	returnPGOK(t, alias.close())
	militaryPGState(t, g, 0, true, false)
	returnPGOK(t, g.waitDrained(ctx))
	returnPGReleased(t, ctx, observer, saved)
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, saved)), "assembly changed tables or sequences")
}

func TestPGMilitaryGenerationReturnIdentityFailure(t *testing.T) {
	trace := militaryPGTracer("")
	_, observer, binding, profile := returnPGFixture(t, trace)
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	expected, err := freshsource.Snapshot(profile)
	returnPGOK(t, err)
	object := expected.Objects["march_order"]
	object.OID = 1 // Return-only mismatch: Recruit must finish first.
	expected.Objects["march_order"] = object
	g, err := newMilitaryGeneration(binding, expected, returnPGCatalog(t))
	returnPGOK(t, err)
	pair, err := g.initialize(ctx)
	returnLifetimeCheck(t, pair == nil && err != nil && g.s.children.recruit.s.cause == nil && g.s.children.returns.s.phase == "military constructor", "wrong failure boundary", err)
	militaryPGState(t, g, 0, true, false)
	militaryPGTransactions(t, trace, observer, profile, false, false)
	returnPGOK(t, g.waitDrained(ctx))
	returnPGReleased(t, ctx, observer, profile)
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "identity failure changed fixture")
}

func TestPGMilitaryGenerationSecondLifetime(t *testing.T) {
	for _, mode := range []string{"close", "cancel-constructor", "cancel-rollback", "unknown", "panic"} {
		t.Run(mode, func(t *testing.T) {
			target := "rollback"
			if mode == "cancel-constructor" || mode == "panic" {
				target = "constructor"
			}
			trace := militaryPGTracer(target)
			if mode == "panic" {
				trace.fault = errors.New("second concrete initializer panic")
			}
			_, observer, binding, profile := returnPGFixture(t, trace)
			ctx := returnPGContext(t)
			before := returnPGSnapshot(t, ctx, observer, profile)
			g, err := newMilitaryGeneration(binding, profile, returnPGCatalog(t))
			returnPGOK(t, err)
			cancel, done := militaryPGStart(t, g, trace)
			pid := returnLifetimeReached(t, trace.returnLifetimeTrace)
			alias := *g
			if mode != "panic" {
				militaryPGState(t, g, 1, false, false)
				count := len(trace.events())
				pair, err := alias.initialize(ctx)
				returnLifetimeCheck(t, pair == nil && err != nil && len(trace.events()) == count, "concurrent alias started more SQL")
			}
			if mode == "close" || mode == "unknown" {
				returnPGOK(t, alias.close())
				militaryPGState(t, g, 1, true, false)
				_, err := g.s.admission.acquire(ctx)
				returnLifetimeCheck(t, err != nil, "closed source admitted new work")
				short, stop := context.WithTimeout(ctx, 20*time.Millisecond)
				returnLifetimeCheck(t, errors.Is(g.waitDrained(short), context.DeadlineExceeded), "first completion drained second")
				stop()
			}
			if mode == "unknown" {
				var terminated bool
				returnPGOK(t, observer.QueryRow(ctx, "SELECT pg_catalog.pg_terminate_backend($1)", pid).Scan(&terminated))
				returnLifetimeCheck(t, terminated, "owned second backend termination failed")
				returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			}
			if strings.HasPrefix(mode, "cancel") || mode == "unknown" {
				cancel()
			}
			trace.release()
			result := militaryPGFinish(t, done)
			if mode == "panic" {
				returnLifetimeCheck(t, result.fault == trace.fault && result.pair == nil, "original panic lost", result)
			} else if mode == "cancel-rollback" {
				returnLifetimeCheck(t, result.err == nil && result.fault == nil && result.pair != nil, "caller cancellation canceled independent rollback", result)
				returnPGOK(t, g.close())
			} else {
				returnLifetimeCheck(t, result.err != nil && result.fault == nil && result.pair == nil, "failure published a pair", result)
			}
			if mode == "cancel-constructor" {
				returnLifetimeCheck(t, errors.Is(result.err, context.Canceled) && g.s.children.returns.s.phase == "account constructor", "lost second-constructor cancellation", result.err)
			}
			pending := uint64(0)
			if mode == "unknown" {
				pending = 1
			}
			militaryPGState(t, g, pending, true, false)
			militaryPGTransactions(t, trace, observer, profile, mode == "close" || mode == "cancel-rollback", mode == "unknown")
			for attempt := 0; attempt < 2; attempt++ {
				returnPGOK(t, alias.close())
				short, stop := context.WithTimeout(ctx, 20*time.Millisecond)
				err := alias.waitDrained(short)
				stop()
				returnLifetimeCheck(t, pending == 0 && err == nil || pending == 1 && errors.Is(err, context.DeadlineExceeded), "wrong drain outcome", err)
			}
			count := len(trace.events())
			pair, err := alias.initialize(ctx)
			returnLifetimeCheck(t, pair == nil && err != nil && len(trace.events()) == count, "failed alias reopened")
			militaryPGState(t, g, pending, true, false)
			returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			returnPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "lifetime fault changed fixture")
		})
	}
}

func TestPGMilitaryGenerationCancelBeforeBegin(t *testing.T) {
	trace := militaryPGTracer("")
	_, observer, binding, profile := returnPGFixture(t, trace)
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	g, err := newMilitaryGeneration(binding, profile, returnPGCatalog(t))
	returnPGOK(t, err)
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	pair, err := g.initialize(canceled)
	returnLifetimeCheck(t, pair == nil && errors.Is(err, context.Canceled) && len(trace.events()) == 0, "canceled source began work", err)
	militaryPGState(t, g, 0, true, false)
	returnPGOK(t, g.waitDrained(ctx))
	returnPGReleased(t, ctx, observer, profile)
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "pre-Begin cancellation changed fixture")
}
