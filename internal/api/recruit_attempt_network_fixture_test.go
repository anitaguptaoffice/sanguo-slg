package api

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5/pgconn"
)

func newRecruitNetworkPG(t *testing.T, n *returnNetwork) *recruitFailurePG {
	t.Helper()
	trace := new(recruitFailureTrace) // Record actual SQL only; no hook or panic injection.
	observer, binding, profile := recruitPGFixture(t, &trace.returnPGTrace, n.configure)
	ctx := returnPGContext(t)
	returnPGExec(t, ctx, observer, "SELECT setval('work_queue_id_seq',100,false)")
	g, err := newRecruitGeneration(binding, profile, recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	t.Cleanup(func() { returnPGOK(t, g.close()) })
	trace.mu.Lock()
	trace.queries = nil
	trace.mu.Unlock()
	n.mu.Lock()
	count, transports := len(n.connections), len(n.transports)
	n.mu.Unlock()
	if count != 1 || transports != 1 || n.pid.Load() == 0 || n.pid.Load() == observer.PgConn().PID() {
		t.Fatal("wire fixture requires one captured independent owned backend")
	}
	return &recruitFailurePG{ctx: ctx, observer: observer, profile: profile, trace: trace, g: g,
		scope:  march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{9}},
		intent: march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 3, Count: 2}}
}

type recruitNetworkCall struct {
	done   chan struct{}
	result recruitAttemptResult
	fault  any
}

// The reviewed Return proxy owns only protocol interception. Recruit owns its
// actual call/result and bounded joins. No Return business attempt is invoked.
func startRecruitNetwork(t *testing.T, f *recruitFailurePG, n *returnNetwork, armed bool) *recruitNetworkCall {
	t.Helper()
	var cancel, stop context.CancelFunc
	n.ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	n.guard, stop = context.WithTimeout(context.Background(), 20*time.Second)
	call := &recruitNetworkCall{done: make(chan struct{})}
	watched := make(chan struct{})
	t.Cleanup(func() { // LIFO: transport and joins finish before fixture pool.Close.
		cancel()
		stop()
		n.abort() // Exact recorded transport objects only, never PID-targeted action.
		ctx, finish := context.WithTimeout(context.Background(), 18*time.Second)
		defer finish()
		for _, joined := range []<-chan struct{}{call.done, watched} {
			select {
			case <-joined:
			case <-ctx.Done():
				t.Error("Recruit network fixture goroutine did not join")
				return
			}
		}
		n.mu.Lock()
		connections := append([]*pgconn.PgConn(nil), n.connections...)
		n.mu.Unlock()
		for _, c := range connections {
			_ = c.Close(ctx) // APP has joined: no concurrent PgConn use.
			select {
			case <-c.CleanupDone():
			case <-ctx.Done():
				t.Error("Recruit pgx asynchronous cleanup did not finish")
				return
			}
			recruitNetworkEnded(t, f, c.PID())
		}
	})
	n.armed.Store(armed) // Initialization is never intercepted; normal control passes through.
	go func() {
		defer close(watched)
		select {
		case <-n.ctx.Done():
		case <-n.guard.Done():
		case <-call.done:
		}
		n.abort()
	}()
	go func() {
		defer close(call.done)
		defer func() { call.fault = recover() }()
		call.result = f.g.admit(n.ctx, 1, f.scope, f.intent)
	}()
	return call
}

func recruitNetworkJoin(t *testing.T, n *returnNetwork, call *recruitNetworkCall) {
	t.Helper()
	select {
	case <-call.done:
	case <-n.guard.Done():
		t.Fatal("Recruit caller did not join before transport guard expired")
	}
	if call.fault != nil {
		t.Fatal("unexpected actual Recruit panic", call.fault)
	}
}

func recruitNetworkEnded(t *testing.T, f *recruitFailurePG, pid uint32) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	for {
		var ended bool
		returnPGOK(t, f.observer.QueryRow(ctx, "SELECT NOT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1) AND NOT EXISTS(SELECT FROM pg_catalog.pg_locks WHERE pid=$1)", pid).Scan(&ended))
		if ended {
			recruitPGReleased(t, ctx, f.observer, f.profile)
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal("owned Recruit backend or locks remain")
		case <-time.After(10 * time.Millisecond):
		}
	}
}
