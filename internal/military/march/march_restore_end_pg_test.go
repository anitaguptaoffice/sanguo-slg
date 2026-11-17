package march

import (
	"context"
	"errors"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type restoreEndKey struct{}
type restoreEndTrace struct {
	poolReleased             map[*pgx.Conn]bool
	mu                       sync.Mutex
	begins, rollbacks, ended int
	bounded                  bool
	rollbackErr              error
	target                   string
	readPanic, rollbackPanic any
	reached                  chan uint32
	resume                   chan struct{}
	once, released           sync.Once
}

// Release is synchronous, but pool destruction and its acquired counter are not.
func (r *restoreEndTrace) TraceRelease(_ *pgxpool.Pool, d pgxpool.TraceReleaseData) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.poolReleased == nil {
		r.poolReleased = make(map[*pgx.Conn]bool)
	}
	r.poolReleased[d.Conn] = true
}

func (r *restoreEndTrace) release() { r.released.Do(func() { close(r.resume) }) }
func (r *restoreEndTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	sql := strings.ToLower(strings.TrimSpace(d.SQL))
	r.mu.Lock()
	if sql == "begin isolation level repeatable read read only" {
		r.begins++
	}
	if sql == "rollback" {
		r.rollbacks++
		deadline, ok := ctx.Deadline()
		r.bounded = ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second
	}
	r.mu.Unlock()
	if strings.HasPrefix(sql, r.target) {
		r.once.Do(func() {
			r.reached <- conn.PgConn().PID()
			if r.readPanic != nil {
				panic(r.readPanic)
			}
			if r.rollbackPanic == nil {
				select {
				case <-r.resume:
				case <-ctx.Done():
				}
			}
		})
	}
	if sql == "rollback" && r.rollbackPanic != nil {
		panic(r.rollbackPanic)
	}
	return context.WithValue(ctx, restoreEndKey{}, sql)
}
func (r *restoreEndTrace) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, d pgx.TraceQueryEndData) {
	if ctx.Value(restoreEndKey{}) == "rollback" {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.ended++
		r.rollbackErr = d.Err
	}
}

func restoreEndUntouched(t *testing.T, h *Hub) {
	t.Helper()
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.restored || h.restoreEv != nil || h.nextMarch != 0 || len(h.marches)+len(h.marchCtx)+len(h.scheduler.events) != 0 {
		t.Fatal("restore published before confirmed ending")
	}
}
func restoreEndSnapshot(t *testing.T, pool *pgxpool.Pool, schema string) string {
	t.Helper()
	s := restoreSourceSnap(t, pool, schema)
	for _, name := range []string{"march_order_march_id_seq", "field_army_army_id_seq", "battle_report_report_id_seq"} {
		var part string
		baseOK(t, pool.QueryRow(context.Background(), "SELECT last_value::text||':'||log_cnt::text||':'||is_called::text FROM "+pgx.Identifier{schema, name}.Sanitize()).Scan(&part))
		s += ";" + name + "=" + part
	}
	return s
}

func TestPGMarchRestoreEnding(t *testing.T) {
	for _, mode := range []string{"success", "query-error", "cancel-read", "cancel-rollback", "rollback-failure", "rollback-timeout", "read-panic", "rollback-panic", "both-panics"} {
		t.Run(mode, func(t *testing.T) {
			observer, _, p, _ := marchStoreFixture(t)
			baseSQL(t, observer, restoreSeedSQL)
			before := restoreEndSnapshot(t, observer, p.SchemaName)
			trace := &restoreEndTrace{target: "rollback", reached: make(chan uint32, 1), resume: make(chan struct{})}
			if mode == "cancel-read" || mode == "read-panic" || mode == "both-panics" {
				trace.target = "select o.march_id"
			}
			if mode == "read-panic" || mode == "both-panics" {
				trace.readPanic = errors.New("original restore read panic")
			}
			if mode == "rollback-panic" || mode == "both-panics" {
				trace.rollbackPanic = errors.New("restore rollback panic")
			}
			renamed := mode == "query-error"
			if renamed {
				baseSQL(t, observer, "ALTER TABLE army_troop RENAME TO hidden_restore_troop")
				t.Cleanup(func() {
					if renamed {
						clean, stop := context.WithTimeout(context.Background(), 3*time.Second)
						defer stop()
						if _, err := observer.Exec(clean, "ALTER TABLE hidden_restore_troop RENAME TO army_troop"); err != nil {
							t.Error(err)
						}
					}
				})
			}
			cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
			baseOK(t, err)
			cfg.MaxConns, cfg.ConnConfig.Tracer = 1, trace
			cfg.ConnConfig.RuntimeParams["search_path"] = "pg_catalog"
			var connsMu sync.Mutex
			var conns []*pgx.Conn
			cfg.AfterConnect = func(_ context.Context, c *pgx.Conn) error {
				connsMu.Lock()
				defer connsMu.Unlock()
				conns = append(conns, c)
				return nil
			}
			pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
			baseOK(t, err)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			h := NewHub(time.Now)
			r, err := NewMarchRestore(ctx, pool, p)
			baseOK(t, err)
			type outcome struct {
				result RestoreResult
				err    error
				fault  any
			}
			done, finished := make(chan outcome, 1), make(chan struct{})
			go func() {
				var out outcome
				defer close(finished)
				defer func() { out.fault = recover(); done <- out }()
				out.result, out.err = r.Restore(ctx, h)
			}()
			t.Cleanup(func() {
				cancel()
				trace.release()
				select {
				case <-finished:
				case <-time.After(8 * time.Second):
					t.Error("restore caller cleanup timed out")
					return
				}
				// Failure-only containment cannot satisfy assertions below: they run
				// before teardown. Raw close cannot repair a leaked pooled handle.
				connsMu.Lock()
				defer connsMu.Unlock()
				for _, c := range conns {
					trace.mu.Lock()
					released := trace.poolReleased[c]
					trace.mu.Unlock()
					if !released { // Joined caller leaked ownership; no pool destructor owns c.
						clean, stop := context.WithTimeout(context.Background(), time.Second)
						_ = c.Close(clean)
						stop()
					}
				}
				closed := make(chan struct{})
				go func() { pool.Close(); close(closed) }()
				select {
				case <-closed:
				case <-time.After(time.Second):
					t.Error("restore leaked its pooled handle")
				}
			})
			var pid uint32
			select {
			case pid = <-trace.reached:
			case <-time.After(8 * time.Second):
				t.Fatal("real restore boundary not reached")
			}
			if trace.readPanic == nil && trace.rollbackPanic == nil {
				restoreEndUntouched(t, h)
				if err := h.ActivateRestore(); !errors.Is(err, ErrMarchRestore) {
					t.Fatal("incomplete restore activated", err)
				}
			}
			if mode == "rollback-failure" {
				var start time.Time
				baseOK(t, observer.QueryRow(context.Background(), "SELECT backend_start FROM pg_stat_activity WHERE pid=$1 AND datname=current_database()", pid).Scan(&start))
				var killed bool
				baseOK(t, observer.QueryRow(context.Background(), "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid=$1 AND backend_start=$2 AND datname=current_database()", pid, start).Scan(&killed))
				if !killed {
					t.Fatal("owned restore backend was not terminated")
				}
			}
			if strings.HasPrefix(mode, "cancel") {
				cancel()
			}
			if mode != "rollback-timeout" {
				trace.release()
			}
			var out outcome
			select {
			case out = <-done:
			case <-time.After(8 * time.Second):
				t.Fatal("restore exceeded independent cleanup bound")
			}
			wantPanic := trace.rollbackPanic
			if trace.readPanic != nil {
				wantPanic = trace.readPanic
			}
			ok := mode == "success" || mode == "cancel-rollback"
			if out.fault != wantPanic || ok && out.err != nil || !ok && wantPanic == nil && !errors.Is(out.err, ErrMarchRestore) {
				t.Fatalf("wrong restore outcome: %+v", out)
			}
			if mode == "cancel-read" && !errors.Is(out.err, context.Canceled) {
				t.Fatal("read cancellation lost", out.err)
			}
			if mode == "query-error" {
				var pgErr *pgconn.PgError
				if !errors.As(out.err, &pgErr) || pgErr.Code != "42P01" {
					t.Fatal("query failure lost", out.err)
				}
			}
			if mode == "rollback-timeout" && !errors.Is(out.err, context.DeadlineExceeded) {
				t.Fatal("rollback deadline lost", out.err)
			}
			if !ok {
				restoreEndUntouched(t, h)
				if !reflect.DeepEqual(out.result, RestoreResult{}) || h.ActivateRestore() == nil {
					t.Fatal("failed ending exposed a result")
				}
			} else {
				if len(out.result.Marches) != 4 || len(out.result.Release) != 2 || !h.restored || len(h.restoreEv) != 4 || len(h.scheduler.events) != 0 {
					t.Fatal("confirmed ending did not publish exact staged restore")
				}
				baseOK(t, h.ActivateRestore())
			}
			trace.mu.Lock()
			begins, rollbacks, ended, bounded, rollbackErr := trace.begins, trace.rollbacks, trace.ended, trace.bounded, trace.rollbackErr
			trace.mu.Unlock()
			failedEnd := mode == "rollback-failure" || mode == "rollback-timeout"
			if begins != 1 || rollbacks != 1 || !bounded || trace.rollbackPanic == nil && (ended != 1 || (rollbackErr != nil) != failedEnd) || trace.rollbackPanic != nil && ended != 0 {
				t.Fatalf("wrong actual transaction ending: %d/%d/%d bounded=%v err=%v", begins, rollbacks, ended, bounded, rollbackErr)
			}
			check, stop := context.WithTimeout(context.Background(), 3*time.Second)
			defer stop()
			for {
				var clear bool
				baseOK(t, observer.QueryRow(check, `SELECT NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND ($2 OR xact_start IS NOT NULL)) AND NOT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE l.pid=$1 AND c.relnamespace=$3)`, pid, failedEnd || trace.rollbackPanic != nil, p.SchemaOID).Scan(&clear))
				if clear && pool.Stat().AcquiredConns() == 0 {
					break
				}
				select {
				case <-check.Done():
					t.Fatal("owned restore backend, locks or acquired handle remained")
				case <-time.After(5 * time.Millisecond):
				}
			}
			if mode == "query-error" {
				// Restore the fixture name for the identical row snapshot, not data.
				baseSQL(t, observer, "ALTER TABLE hidden_restore_troop RENAME TO army_troop")
				renamed = false
			}
			if restoreEndSnapshot(t, observer, p.SchemaName) != before {
				t.Fatal("restore changed source rows or allocator state")
			}
			t.Logf("restore ending %s: one real read-only snapshot, one bounded rollback, no leaked ownership or premature publication", mode)
		})
	}
}
