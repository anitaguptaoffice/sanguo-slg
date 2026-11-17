package api

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// A fresh observer bound is separate from caller completion and query witnessing.
func returnBackendAbsent(t *testing.T, observer *pgx.Conn, b *returnOwnedBackend) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for {
		var alive bool
		returnPGOK(t, observer.QueryRow(ctx, `SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity
WHERE pid=$1 AND backend_start=$2::timestamptz)`, b.pid, b.started).Scan(&alive))
		if !alive {
			return
		}
		time.Sleep(time.Millisecond)
	}
}

func TestPGReturnBackendCleanupOwnership(t *testing.T) {
	r := newReturnSerialPG(t)
	f := r.f
	held, err := f.pool.Acquire(f.ctx) // Force both concurrent acquisitions to create new connections.
	returnPGOK(t, err)
	defer held.Release()
	// Concurrent pool acquisitions capture on their own connection, never observer.
	acquired := make(chan *pgxpool.Conn, 2)
	errors := make(chan error, 2)
	var workers sync.WaitGroup
	for i := 0; i < 2; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			c, err := f.pool.Acquire(f.ctx)
			acquired <- c
			errors <- err
		}()
	}
	workers.Wait()
	first, second := <-acquired, <-acquired
	var done, joined chan struct{}
	t.Cleanup(func() {
		for _, c := range []*pgxpool.Conn{first, second} {
			if c != nil {
				_ = r.owned.get(c.Conn().PgConn().PID()).close()
			}
		}
		if joined != nil && !returnBackendJoin(joined, 5*time.Second) {
			t.Error("normal cleanup query did not join")
			return
		}
		if done != nil && !returnBackendJoin(done, 5*time.Second) {
			t.Error("cleanup query did not join")
			return
		}
		for _, c := range []*pgxpool.Conn{first, second} {
			if c != nil {
				c.Release()
			}
		}
	})
	for i := 0; i < 2; i++ {
		returnPGOK(t, <-errors)
	}
	b, other := r.owned.get(first.Conn().PgConn().PID()), r.owned.get(second.Conn().PgConn().PID())
	if b == nil || other == nil || b == other || b.pid == other.pid || b.started == "" || other.started == "" {
		t.Fatal("missing/distorted concurrent ownership")
	}
	returnPGExec(t, f.ctx, first.Conn(), "BEGIN")
	// A client close need not interrupt a running server statement. Bound it separately.
	returnPGExec(t, f.ctx, second.Conn(), "SET statement_timeout='5s'; BEGIN")
	joined, normalResult := make(chan struct{}), make(chan error, 1)
	go func() {
		defer close(joined)
		_, err := first.Exec(f.ctx, "SELECT 1")
		normalResult <- err
	}()
	if !returnBackendJoin(joined, 5*time.Second) {
		t.Fatal("normal caller did not join")
	}
	returnPGOK(t, <-normalResult)
	var one int
	returnPGOK(t, first.QueryRow(f.ctx, "SELECT 1").Scan(&one))
	// Synthetic stale metadata, not a runtime reproduction of PID reuse.
	stale := &returnOwnedBackend{pid: f.observer.PgConn().PID(), started: "2000-01-01 00:00:00+00", transport: b.transport}
	returnPGOK(t, stale.close()) // The exact original transport, not sentinel PID.
	returnBackendAbsent(t, f.observer, b)
	if (&returnOwnedBackend{transport: f.observer.PgConn().Conn()}).close() == nil {
		t.Fatal("zero ownership accepted a real sentinel transport")
	}
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT 1").Scan(&one))
	// A blocked real query supplies forced-fallback and bounded caller-join evidence.
	done = make(chan struct{})
	queryResult := make(chan error, 1)
	go func() {
		defer close(done)
		_, err := second.Exec(f.ctx, "SELECT pg_catalog.pg_sleep(60)")
		queryResult <- err
	}()
	ctx, cancel := context.WithTimeout(f.ctx, 5*time.Second)
	defer cancel()
	for {
		var waiting bool
		returnPGOK(t, f.observer.QueryRow(ctx, `SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity
WHERE pid=$1 AND backend_start=$2::timestamptz AND wait_event='PgSleep')`, other.pid, other.started).Scan(&waiting))
		if waiting {
			break
		}
		time.Sleep(time.Millisecond)
	}
	if returnBackendJoin(done, time.Millisecond) {
		t.Fatal("blocked caller unexpectedly joined")
	}
	closed := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func() { closed <- other.close() }() // Concurrent Close is idempotent.
	}
	for i := 0; i < 2; i++ {
		select {
		case err := <-closed:
			returnPGOK(t, err)
		case <-time.After(5 * time.Second):
			t.Fatal("concurrent transport close did not return")
		}
	}
	if !returnBackendJoin(done, time.Second) {
		t.Fatal("exact transport close did not join caller")
	}
	if err := <-queryResult; err == nil {
		t.Fatal("interrupted query returned success")
	}
	cancel()
	returnBackendAbsent(t, f.observer, other)
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT 1").Scan(&one))
	if r.owned.get(b.pid) != b || r.owned.get(other.pid) != other {
		t.Fatal("original ownership was replaced or resampled")
	}
}
