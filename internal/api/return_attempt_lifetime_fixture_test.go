package api

import (
	"context"
	"errors"
	"net"
	"sync"
	"testing"
	"time"

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
