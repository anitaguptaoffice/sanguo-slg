package api

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type recruitAttemptLifetimeTrace struct {
	*returnLifetimeTrace
	owned       returnBackendSet
	connections []*pgconn.PgConn // Protected by guard, captured before first BEGIN.
	mode        string
	armed       bool
}

func (r *recruitAttemptLifetimeTrace) gate(ctx context.Context, conn *pgx.Conn) {
	r.reached <- conn.PgConn().PID()
	select {
	case <-r.resume:
	case <-ctx.Done():
	}
}
func (r *recruitAttemptLifetimeTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnPGTrace.TraceQueryStart(ctx, conn, data)
	if r.armed && r.mode == "close" && data.SQL == "commit" {
		r.gate(ctx, conn) // Owner's end linearization precedes this actual pgx call.
	}
	return ctx
}
func (r *recruitAttemptLifetimeTrace) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {
	r.returnPGTrace.TraceQueryEnd(ctx, conn, data)
	if r.armed && r.mode == "missing_record" && data.Err == nil && data.CommandTag.String() == "COMMIT" &&
		r.events()[ctx.Value(returnPGTraceKey{}).(int)].sql == "commit" {
		r.gate(ctx, conn) // Successful SQL, but Owner.Commit has not returned to APP.
	}
}

type recruitAttemptLifetimePG struct {
	ctx      context.Context
	observer *pgx.Conn
	profile  freshsource.Profile
	g        *recruitGeneration
	trace    *recruitAttemptLifetimeTrace
	scope    march.RecruitScope
	intent   march.RecruitIntent
}

func newRecruitAttemptLifetimePG(t *testing.T, mode string) (*recruitAttemptLifetimePG, *recruitAttemptLifetimeTrace) {
	t.Helper()
	r := &recruitAttemptLifetimeTrace{returnLifetimeTrace: returnLifetimeTracer(""), mode: mode}
	observer, binding, p := recruitPGFixture(t, &r.returnPGTrace, func(cfg *pgxpool.Config) {
		cfg.ConnConfig.Tracer, cfg.MaxConns = r, 1
		r.owned.configure(cfg)
		capture := cfg.AfterConnect
		cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
			if err := capture(ctx, conn); err != nil {
				return err
			}
			r.guard.Lock()
			r.connections = append(r.connections, conn.PgConn())
			r.guard.Unlock()
			return nil
		}
	})
	ctx := returnPGContext(t)
	returnPGExec(t, ctx, observer, "SELECT setval('work_queue_id_seq',100,false)")
	g, err := newRecruitGeneration(binding, p, recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	t.Cleanup(func() { returnPGOK(t, g.close()) })
	r.mu.Lock()
	r.queries = nil
	r.mu.Unlock()
	r.guard.Lock()
	count := len(r.connections)
	r.guard.Unlock()
	if count != 1 {
		t.Fatal("lifetime fixture requires exactly one captured owned connection", count)
	}
	r.armed = true // Initialization is complete before the goroutine starts.
	return &recruitAttemptLifetimePG{ctx: ctx, observer: observer, profile: p, g: g, trace: r,
		scope:  march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{9}},
		intent: march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 3, Count: 2}}, r
}

type recruitAttemptLifetimeCall struct {
	done   chan struct{}
	result recruitAttemptResult
	fault  any
}

func startRecruitAttemptLifetime(t *testing.T, f *recruitAttemptLifetimePG, r *recruitAttemptLifetimeTrace) *recruitAttemptLifetimeCall {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	call := &recruitAttemptLifetimeCall{done: make(chan struct{})}
	t.Cleanup(func() { // LIFO: join and transport cleanup precede fixture pool.Close.
		cancel()
		r.release()
		joined := returnBackendJoin(call.done, 8*time.Second)
		r.guard.Lock()
		connections := append([]*pgconn.PgConn(nil), r.connections...)
		r.guard.Unlock()
		for _, conn := range connections {
			if err := r.owned.get(conn.PID()).close(); err != nil {
				t.Error("exact Recruit transport cleanup", err)
			}
		}
		if !joined && !returnBackendJoin(call.done, 8*time.Second) {
			t.Error("Recruit caller did not join after exact transport close")
			return
		}
		clean, stop := context.WithTimeout(context.Background(), 8*time.Second)
		defer stop()
		for _, conn := range connections {
			_ = conn.Close(clean) // No concurrent pgx use after APP joined.
			select {
			case <-conn.CleanupDone():
			case <-clean.Done():
				t.Error("Recruit pgx asynchronous cleanup exceeded bound")
				return
			}
			r.owned.noLocks(t, clean, f.observer, conn.PID(), f.profile.SchemaOID)
		}
	})
	go func() {
		defer close(call.done)
		defer func() { call.fault = recover() }()
		call.result = f.g.admit(ctx, 1, f.scope, f.intent)
	}()
	return call
}

func recruitAttemptLifetimeRecord(t *testing.T, f *recruitAttemptLifetimePG, n int) *recruitAttempt {
	t.Helper()
	f.g.s.mu.Lock()
	defer f.g.s.mu.Unlock()
	if len(f.g.s.attempts) != n {
		t.Fatal("unexpected admitted/retained attempt count", len(f.g.s.attempts), n)
	}
	for a := range f.g.s.attempts {
		return a
	}
	return nil
}

func recruitAttemptLifetimeReject(t *testing.T, f *recruitAttemptLifetimePG) {
	t.Helper()
	alias, queries := *f.g, len(f.trace.events())
	for _, key := range []byte{9, 10} {
		scope := f.scope
		scope.CommandID = march.RecruitCommandID{key}
		r := alias.admit(f.ctx, 1, scope, f.intent)
		if r.outcome != recruitNotStarted || r.cause != errRecruitGeneration || r.cleanup != nil ||
			r.diagnostic != nil || r.confirmed != (march.RecruitAcceptance{}) {
			t.Fatal("closed generation accepted same/fresh key", r)
		}
	}
	if alias.initialize(f.ctx) != errRecruitGeneration {
		t.Fatal("closed generation reinitialized")
	}
	returnPGOK(t, alias.close())
	returnPGOK(t, alias.close())
	if len(f.trace.events()) != queries {
		t.Fatal("closed generation sent SQL while rejecting local calls")
	}
}

func recruitAttemptLifetimeQueueOne(t *testing.T, f *recruitAttemptLifetimePG) string {
	t.Helper()
	var row string
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT jsonb_build_array(q,q.xmin::text,q.ctid::text)::text FROM work_queue q WHERE server_id=1 AND queue_id=1").Scan(&row))
	return row
}
