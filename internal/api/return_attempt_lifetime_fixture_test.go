package api

import (
	"context"
	"errors"
	"net"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Immutable lifetime identity; only transport is a destructive capability.
type returnOwnedBackend struct {
	pid       uint32
	started   string
	transport net.Conn
	once      sync.Once
	err       error
}

func (b *returnOwnedBackend) close() error {
	if b == nil || b.pid == 0 || b.started == "" || b.transport == nil {
		return errors.New("missing original backend ownership")
	}
	b.once.Do(func() { b.err = b.transport.Close() })
	if errors.Is(b.err, net.ErrClosed) {
		return nil
	}
	return b.err
}

type returnBackendSet struct {
	mu       sync.Mutex
	backends map[uint32]*returnOwnedBackend
}

func (r *returnBackendSet) configure(cfg *pgxpool.Config) {
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		// Raw protocol avoids adding capture SQL to the transaction tracer.
		rows, err := conn.PgConn().Exec(ctx, "SELECT backend_start::text FROM pg_catalog.pg_stat_activity WHERE pid=pg_catalog.pg_backend_pid()").ReadAll()
		if err != nil {
			return err
		}
		if len(rows) != 1 || len(rows[0].Rows) != 1 || len(rows[0].Rows[0]) != 1 || len(rows[0].Rows[0][0]) == 0 {
			return errors.New("missing original backend_start")
		}
		b := &returnOwnedBackend{pid: conn.PgConn().PID(), started: string(rows[0].Rows[0][0]), transport: conn.PgConn().Conn()}
		r.mu.Lock()
		defer r.mu.Unlock()
		if r.backends == nil {
			r.backends = make(map[uint32]*returnOwnedBackend)
		}
		if b.pid == 0 || b.transport == nil || r.backends[b.pid] != nil {
			return errors.New("invalid or reused backend identity")
		}
		r.backends[b.pid] = b // Captured once before this connection's first BEGIN.
		return nil
	}
}
func (r *returnBackendSet) get(pid uint32) *returnOwnedBackend {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.backends[pid]
}
func returnBackendJoin(done <-chan struct{}, bound time.Duration) bool {
	timer := time.NewTimer(bound)
	defer timer.Stop()
	select {
	case <-done:
		return true
	case <-timer.C:
		return false
	}
}
func (r *returnBackendSet) noLocks(t *testing.T, ctx context.Context, observer *pgx.Conn, pid, schema uint32) {
	t.Helper()
	b := r.get(pid)
	if b == nil {
		t.Fatal("missing original backend for readonly verification", pid)
	}
	for {
		var active bool
		returnPGOK(t, observer.QueryRow(ctx, `SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity a
WHERE a.pid=$1 AND a.backend_start=$2::timestamptz AND (a.xact_start IS NOT NULL OR EXISTS(
SELECT FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_class c ON c.oid=l.relation WHERE l.pid=a.pid AND c.relnamespace=$3)))`, b.pid, b.started, schema).Scan(&active))
		if !active {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
}
func (r *returnBackendSet) cleanup(t *testing.T, f *returnAttemptPG, done <-chan struct{}) {
	t.Helper()
	if !returnBackendJoin(done, 8*time.Second) {
		t.Error("return caller exceeded cancellation/join bound")
	}
	r.mu.Lock()
	owned := make([]*returnOwnedBackend, 0, len(r.backends))
	for _, b := range r.backends {
		owned = append(owned, b)
	}
	r.mu.Unlock()
	for _, b := range owned {
		if err := b.close(); err != nil {
			t.Error("owned transport close", err)
		}
	}
	if !returnBackendJoin(done, 8*time.Second) {
		t.Error("return caller did not join after exact transport close")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	for _, b := range owned {
		r.noLocks(t, ctx, f.observer, b.pid, f.profile.SchemaOID)
	}
	for f.pool.Stat().AcquiredConns() != 0 {
		select {
		case <-ctx.Done():
			t.Error("return pool retained acquired connection after teardown")
			return
		case <-time.After(10 * time.Millisecond):
		}
	}
}

// Gates observe actual SQL. They do not substitute a participant or transaction.
type returnAttemptLifetimeTrace struct {
	*returnLifetimeTrace
	owned                        returnBackendSet
	mode                         string
	armed                        bool
	generation                   *returnGeneration
	rollbackEnds, rollbackBounds int
}

func (r *returnAttemptLifetimeTrace) gate(ctx context.Context, conn *pgx.Conn) {
	r.reached <- conn.PgConn().PID()
	select {
	case <-r.resume:
	case <-ctx.Done():
	}
	if r.fault != nil {
		panic(r.fault)
	}
}

func (r *returnAttemptLifetimeTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnLifetimeTrace.TraceQueryStart(ctx, conn, data)
	if r.armed && strings.EqualFold(strings.TrimSpace(data.SQL), "rollback") {
		deadline, ok := ctx.Deadline()
		if ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second {
			r.guard.Lock()
			r.rollbackBounds++
			r.guard.Unlock()
		}
	}
	if r.armed && strings.EqualFold(strings.TrimSpace(data.SQL), "commit") && (r.mode == "commit_start" || r.mode == "close") {
		r.gate(ctx, conn)
	}
	return ctx
}

func (r *returnAttemptLifetimeTrace) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {
	r.returnPGTrace.TraceQueryEnd(ctx, conn, data)
	if !r.armed || data.Err != nil {
		return
	}
	q := r.events()[ctx.Value(returnPGTraceKey{}).(int)]
	sql := strings.ToLower(strings.TrimSpace(q.sql))
	if sql == "rollback" && data.CommandTag.String() == "ROLLBACK" {
		r.guard.Lock()
		r.rollbackEnds++
		r.guard.Unlock()
	}
	if r.mode == "precommit" && strings.HasPrefix(sql, "update ") && strings.Contains(sql, `"field_army" set status = 1`) && data.CommandTag.RowsAffected() == 1 ||
		(r.mode == "commit_end" || r.mode == "missing_record") && sql == "commit" && data.CommandTag.String() == "COMMIT" {
		r.gate(ctx, conn)
		if r.mode == "missing_record" {
			// Targeted private diagnostic corruption, not a production-reachable path.
			s := r.generation.s
			s.mu.Lock()
			for a := range s.attempts {
				delete(s.attempts, a)
			}
			s.mu.Unlock()
		}
	}
}

func returnAttemptLifetimeFixture(t *testing.T, mode string, fault any) (*returnAttemptPG, *returnAttemptLifetimeTrace) {
	t.Helper()
	r := &returnAttemptLifetimeTrace{returnLifetimeTrace: returnLifetimeTracer(""), mode: mode}
	r.reached = make(chan uint32, 2)
	f := newReturnAttemptPG(t, r, r.owned.configure)
	r.queries = nil // Initialization has finished; retain only actual attempts below.
	r.armed, r.fault, r.generation, r.bounded = true, fault, f.generation, false
	return f, r
}

type returnAttemptLifetimeResult struct {
	candidate march.ReturnCandidate
	result    returnAttemptResult
	fault     any
}

func returnAttemptLifetimeStart(t *testing.T, f *returnAttemptPG, trace *returnAttemptLifetimeTrace, candidates ...march.ReturnCandidate) <-chan returnAttemptLifetimeResult {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	results, finished := make(chan returnAttemptLifetimeResult, len(candidates)), make(chan struct{})
	var workers sync.WaitGroup
	for _, candidate := range candidates {
		workers.Add(1)
		go func(c march.ReturnCandidate) {
			defer workers.Done()
			r := returnAttemptLifetimeResult{candidate: c}
			defer func() { r.fault = recover(); results <- r }()
			r.result = f.generation.complete(ctx, c)
		}(candidate)
	}
	go func() { workers.Wait(); close(finished) }()
	t.Cleanup(func() {
		cancel()
		trace.release()
		trace.owned.cleanup(t, f, finished)
	})
	return results
}

func returnAttemptLifetimeFinish(t *testing.T, results <-chan returnAttemptLifetimeResult) returnAttemptLifetimeResult {
	t.Helper()
	select {
	case r := <-results:
		return r
	case <-time.After(8 * time.Second):
		t.Fatal("attempt did not finish within cleanup bound")
	}
	return returnAttemptLifetimeResult{}
}

func returnAttemptLifetimeRecords(t *testing.T, f *returnAttemptPG, n int) map[march.ReturnCandidate]*returnAttempt {
	t.Helper()
	s := f.generation.s
	s.mu.Lock()
	defer s.mu.Unlock()
	returnLifetimeCheck(t, len(s.attempts) == n, "attempt identity count", len(s.attempts), n)
	byCandidate := map[march.ReturnCandidate]*returnAttempt{}
	for a := range s.attempts {
		returnLifetimeCheck(t, a.generation == s && byCandidate[a.candidate] == nil, "attempt identity collision")
		byCandidate[a.candidate] = a
	}
	return byCandidate
}

func returnAttemptLifetimeBackend(t *testing.T, f *returnAttemptPG, pid uint32, active bool) {
	t.Helper()
	b := f.pool.Config().ConnConfig.Tracer.(*returnAttemptLifetimeTrace).owned.get(pid)
	if b == nil {
		t.Fatal("missing original lifetime identity", pid)
	}
	var inTransaction bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND xact_start IS NOT NULL)", pid, b.started).Scan(&inTransaction))
	returnLifetimeCheck(t, pid != f.observer.PgConn().PID() && inTransaction == active, "independent backend state", pid, active, inTransaction)
	t.Logf("before tracer release/cleanup: owned backend=%d observer=%d active=%v", pid, f.observer.PgConn().PID(), inTransaction)
}

func returnAttemptLifetimeEffects(t *testing.T, f *returnAttemptPG, stable map[string]string) {
	t.Helper()
	var ready []int32
	var status, army, x, y int32
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop WHERE city_id=$1", f.candidate.CityID).Scan(&ready))
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT m.status,a.status,a.x,a.y FROM march_order m JOIN field_army a USING(server_id,army_id) WHERE m.march_id=$1", f.candidate.MarchID).Scan(&status, &army, &x, &y))
	returnLifetimeCheck(t, reflect.DeepEqual(ready, []int32{18, 20, 19, 23}) && status == 4 && army == 1 && x == 0 && y == 0 &&
		reflect.DeepEqual(stable, snapshotReturnAttemptPG(t, f, true)), "committed credit or retained graph changed", ready, status, army, x, y)
}
