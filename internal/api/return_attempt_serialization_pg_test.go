package api

import (
	"context"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type returnSerialKey struct{}
type returnSerialCall struct {
	cancel context.CancelFunc
	done   chan struct{}
	pid    atomic.Uint32
	result returnAttemptResult
	fault  any
}
type returnSerialTrace struct{ returnPGTrace }

func (r *returnSerialTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if call, ok := ctx.Value(returnSerialKey{}).(*returnSerialCall); ok {
		call.pid.CompareAndSwap(0, conn.PgConn().PID())
	}
	return r.returnPGTrace.TraceQueryStart(ctx, conn, data)
}

type returnSerialPG struct {
	f        *returnAttemptPG
	trace    *returnSerialTrace
	owned    returnBackendSet
	calls    []*returnSerialCall
	blockers []*pgx.Conn
	offset   int
}

func newReturnSerialPG(t *testing.T) *returnSerialPG {
	t.Helper()
	r := &returnSerialPG{trace: new(returnSerialTrace)}
	r.f = newReturnAttemptPG(t, r.trace, r.owned.configure, func(cfg *pgxpool.Config) { cfg.MaxConns = 3 })
	r.offset = len(r.trace.events())
	t.Cleanup(func() {
		for _, call := range r.calls {
			call.cancel()
		}
		for _, blocker := range r.blockers {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := blocker.Close(ctx); err != nil {
				t.Error("owned blocker cleanup", err)
			}
			cancel()
		}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		done := make(chan struct{})
		go func() {
			if r.join(ctx) {
				close(done)
			}
		}()
		r.owned.cleanup(t, r.f, done)
	})
	return r
}

func (r *returnSerialPG) join(ctx context.Context) bool {
	for _, call := range r.calls {
		select {
		case <-call.done:
		case <-ctx.Done():
			return false
		}
	}
	return true
}

func (r *returnSerialPG) start(candidate march.ReturnCandidate) *returnSerialCall {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	call := &returnSerialCall{cancel: cancel, done: make(chan struct{})}
	r.calls = append(r.calls, call)
	go func() {
		defer close(call.done)
		defer func() { call.fault = recover() }()
		call.result = r.f.generation.complete(context.WithValue(ctx, returnSerialKey{}, call), candidate)
	}()
	return call
}

func (r *returnSerialPG) block(t *testing.T, table, key string) *pgx.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(r.f.ctx, 5*time.Second)
	defer cancel()
	conn, err := pgx.ConnectConfig(ctx, r.f.observer.Config().Copy())
	returnPGOK(t, err)
	r.blockers = append(r.blockers, conn)
	returnPGExec(t, ctx, conn, "BEGIN")
	var id int64
	returnPGOK(t, conn.QueryRow(ctx, "SELECT "+key+" FROM "+pgx.Identifier{r.f.profile.SchemaName, table}.Sanitize()+
		" WHERE server_id=1 AND "+key+"=1 FOR UPDATE NOWAIT").Scan(&id))
	if id != 1 {
		t.Fatal("wrong blocker identity", table, id)
	}
	return conn
}

func (r *returnSerialPG) waiting(t *testing.T, call *returnSerialCall, table string, blocker uint32) uint32 {
	t.Helper()
	ctx, cancel := context.WithTimeout(r.f.ctx, 10*time.Second)
	defer cancel()
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	var query string
	var blockers []int32
	for {
		pid := call.pid.Load()
		if pid != 0 {
			var lockWait bool
			returnPGOK(t, r.f.observer.QueryRow(ctx, `SELECT query,COALESCE(wait_event_type='Lock',false),pg_catalog.pg_blocking_pids(pid)
FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz`, pid, r.owned.get(pid).started).Scan(&query, &lockWait, &blockers))
			if lockWait && strings.Contains(query, pgx.Identifier{r.f.profile.SchemaName, table}.Sanitize()) &&
				strings.HasSuffix(query, "FOR UPDATE") && reflect.DeepEqual(blockers, []int32{int32(blocker)}) {
				t.Logf("actual return pid=%d waits on %s, blocker=%d observer=%d", pid, table, blocker, r.f.observer.PgConn().PID())
				return pid
			}
		}
		select {
		case <-call.done:
			t.Fatal("complete ended before witnessed barrier", call.result, call.fault)
		case <-ctx.Done():
			t.Fatal("missing actual lock witness", table, query, blockers)
		case <-ticker.C:
		}
	}
}

func (r *returnSerialPG) finish(t *testing.T, call *returnSerialCall, candidate march.ReturnCandidate, want march.ReturnDisposition, due time.Time, clocks int) {
	t.Helper()
	select {
	case <-call.done:
	case <-time.After(10 * time.Second):
		t.Fatal("actual complete did not finish", call.pid.Load())
	}
	if call.fault != nil {
		t.Fatal("actual complete panicked", call.fault)
	}
	f := *r.f
	f.candidate = candidate
	returnAttemptConfirmed(t, &f, call.result, want, due)
	var events []returnPGQuery
	for _, event := range r.trace.events()[r.offset:] {
		if event.pid == call.pid.Load() {
			events = append(events, event)
		}
	}
	returnAttemptTrace(t, &f, events, true, clocks)
	r.owned.noLocks(t, f.ctx, f.observer, call.pid.Load(), f.profile.SchemaOID)
}

func returnSerialRows(t *testing.T, f *returnAttemptPG, id int64, credited bool, status, x, y int32) {
	t.Helper()
	var ready, wounded []int32
	var marchStatus, armyStatus, gotX, gotY int32
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(count ORDER BY unit_cfg_id),array_agg(wounded ORDER BY unit_cfg_id) FROM city_troop WHERE city_id=$1", id).Scan(&ready, &wounded))
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT m.status,a.status,a.x,a.y FROM march_order m JOIN field_army a USING(server_id,army_id) WHERE m.march_id=$1`, id).Scan(&marchStatus, &armyStatus, &gotX, &gotY))
	wantReady, wantArmy := []int32{11, 12, 13, 14}, int32(2)
	if credited {
		wantReady = []int32{18, 20, 19, 23}
	}
	if status == 4 {
		wantArmy = 1
	}
	if !reflect.DeepEqual(ready, wantReady) || !reflect.DeepEqual(wounded, []int32{2147483647, 2147483647, 2147483647, 2147483647}) ||
		marchStatus != status || armyStatus != wantArmy || gotX != x || gotY != y {
		t.Fatal("independent committed row mismatch", id, ready, wounded, marchStatus, armyStatus, gotX, gotY)
	}
}

func TestPGReturnAttemptDuplicateWalletWorldSerialization(t *testing.T) {
	for _, tc := range []struct {
		name, setup string
		want        march.ReturnDisposition
		due         time.Time
		clocks      int
	}{
		{"due", "", march.ReturnApplied, returnAttemptDue, 1},
		{"early", "UPDATE march_order SET return_finish_at='2999-01-02 03:05:05.123456+00'", march.ReturnEarly, time.Date(2999, 1, 2, 3, 5, 5, 123456000, time.UTC), 1},
		{"credited", "UPDATE city_troop c SET count=c.count+a.count FROM army_troop a WHERE c.unit_cfg_id=a.unit_cfg_id; UPDATE march_order SET status=4; UPDATE field_army SET status=1,x=0,y=0", march.ReturnCreditedTerminal, returnAttemptDue, 0},
		{"annihilated", "UPDATE march_order SET status=4,return_finish_at=NULL; UPDATE field_army SET status=1; DELETE FROM army_troop", march.ReturnAnnihilatedTerminal, time.Time{}, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := newReturnSerialPG(t)
			f := r.f
			returnAttemptPending(t, f) // Synthetic reservations, not actual Recruit interoperability.
			if tc.setup != "" {
				returnPGExec(t, f.ctx, f.observer, tc.setup)
			}
			other := returnAttemptSeed(t, f.ctx, f.observer, 2)
			before, stable := snapshotReturnAttemptPG(t, f, false), snapshotReturnAttemptPG(t, f, true)
			wallet := r.block(t, "player_wallet", "player_id")
			first := r.start(f.candidate)
			firstPID := r.waiting(t, first, "player_wallet", wallet.PgConn().PID())
			// NOWAIT succeeds only if the waiting command has not locked WORLD first.
			city := r.block(t, "player_city", "city_id")
			returnPGExec(t, f.ctx, wallet, "ROLLBACK")
			r.waiting(t, first, "player_city", city.PgConn().PID())
			duplicate := r.start(f.candidate)
			duplicatePID := r.waiting(t, duplicate, "player_wallet", firstPID)
			if firstPID == duplicatePID || !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
				t.Fatal("distinct blocked transactions changed committed state")
			}
			returnLifetimeState(t, f.generation, 2, false, true)
			independent := r.start(other)
			r.finish(t, independent, other, march.ReturnApplied, f.due, 1)
			if independent.pid.Load() == firstPID || independent.pid.Load() == duplicatePID {
				t.Fatal("independent actor did not use a third backend")
			}
			r.waiting(t, first, "player_city", city.PgConn().PID())
			r.waiting(t, duplicate, "player_wallet", firstPID)
			returnLifetimeState(t, f.generation, 2, false, true)
			returnSerialRows(t, f, 2, true, 4, 2, 0)
			status, x, y := int32(3), int32(1), int32(1)
			if tc.want == march.ReturnCreditedTerminal {
				status, x, y = 4, 0, 0
			} else if tc.want == march.ReturnAnnihilatedTerminal {
				status = 4
			}
			returnSerialRows(t, f, 1, tc.want == march.ReturnCreditedTerminal, status, x, y)
			middle := snapshotReturnAttemptPG(t, f, false)
			returnPGExec(t, f.ctx, city, "ROLLBACK")
			r.finish(t, first, f.candidate, tc.want, tc.due, tc.clocks)
			duplicateWant, duplicateClocks := tc.want, tc.clocks
			if tc.want == march.ReturnApplied {
				duplicateWant, duplicateClocks = march.ReturnCreditedTerminal, 0
				status, x, y = 4, 0, 0
			}
			r.finish(t, duplicate, f.candidate, duplicateWant, tc.due, duplicateClocks)
			returnAttemptClean(t, f)
			returnSerialRows(t, f, 1, tc.want == march.ReturnApplied || tc.want == march.ReturnCreditedTerminal, status, x, y)
			returnSerialRows(t, f, 2, true, 4, 2, 0)
			if !reflect.DeepEqual(stable, snapshotReturnAttemptPG(t, f, true)) ||
				tc.want != march.ReturnApplied && !reflect.DeepEqual(middle, snapshotReturnAttemptPG(t, f, false)) {
				t.Fatal("return altered retained graph, unrelated rows, sequences or read-only state")
			}
			returnPGReleased(t, f.ctx, f.observer, f.profile)
		})
	}
}
