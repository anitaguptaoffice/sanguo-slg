package api

import (
	"context"
	"errors"
	"net"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

func TestReturnBackendOwnershipFailClosed(t *testing.T) {
	owner, sentinel := net.Pipe()
	defer func() {
		if err := owner.Close(); err != nil {
			t.Errorf("close owned test pipe: %v", err)
		}
	}()
	defer func() {
		if err := sentinel.Close(); err != nil {
			t.Errorf("close sentinel test pipe: %v", err)
		}
	}()
	for _, b := range []*returnOwnedBackend{nil, {}, {transport: owner}, {pid: 1, transport: owner}, {pid: 1, started: "missing transport"}} {
		if b.close() == nil {
			t.Fatal("missing ownership accepted")
		}
	}
	returnPGOK(t, sentinel.SetReadDeadline(time.Now().Add(10*time.Millisecond)))
	_, err := sentinel.Read(make([]byte, 1))
	if timeout, ok := err.(net.Error); !ok || !timeout.Timeout() {
		t.Fatal("invalid ownership closed transport", err)
	}
}

func TestReturnBackendJoinBoundaries(t *testing.T) {
	done := make(chan struct{})
	if returnBackendJoin(done, time.Millisecond) {
		t.Fatal("unfinished caller reported joined")
	}
	close(done)
	if !returnBackendJoin(done, time.Second) {
		t.Fatal("finished caller did not join")
	}
}

type returnCloseProbe struct {
	net.Conn
	calls atomic.Int32
	fault error
}

func (p *returnCloseProbe) Close() error {
	p.calls.Add(1)
	if err := p.Conn.Close(); err != nil {
		return err
	}
	return p.fault
}

func TestReturnBackendCloseOncePreservesError(t *testing.T) {
	owner, sentinel := net.Pipe()
	t.Cleanup(func() {
		if err := owner.Close(); err != nil {
			t.Error(err)
		}
		if err := sentinel.Close(); err != nil {
			t.Error(err)
		}
	})
	fault := errors.New("owned transport close failure")
	probe := &returnCloseProbe{Conn: owner, fault: fault}
	b := &returnOwnedBackend{pid: 1, started: "original", transport: probe}
	results := make(chan error, 8)
	for i := 0; i < cap(results); i++ {
		go func() { results <- b.close() }()
	}
	for i := 0; i < cap(results); i++ {
		select {
		case err := <-results:
			if err != fault {
				t.Error("original close failure lost", err)
			}
		case <-time.After(time.Second):
			t.Fatal("concurrent owned close did not return")
		}
	}
	if probe.calls.Load() != 1 {
		t.Fatal("owned transport closed more than once", probe.calls.Load())
	}
}

func TestPGReturnBackendCaptureAndCleanupIsolation(t *testing.T) {
	var owned returnBackendSet
	f := newReturnAttemptPG(t, new(returnPGTrace), owned.configure)
	conn, err := pgx.ConnectConfig(f.ctx, f.observer.Config().Copy())
	returnPGOK(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := conn.Close(ctx); err != nil {
			t.Error("owned test connection cleanup", err)
		}
	})
	capture := f.pool.Config().AfterConnect
	returnPGOK(t, capture(f.ctx, conn))
	pid := conn.PgConn().PID()
	b := owned.get(pid)
	var started string
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT backend_start::text FROM pg_catalog.pg_stat_activity WHERE pid=$1", pid).Scan(&started))
	if b == nil || b.pid != pid || b.started != started || b.transport != conn.PgConn().Conn() || pid == f.observer.PgConn().PID() {
		t.Fatal("capture did not retain exact original backend and transport")
	}
	if err := capture(f.ctx, conn); err == nil || owned.get(pid) != b {
		t.Fatal("duplicate capture replaced original ownership", err)
	}
	if owned.get(f.observer.PgConn().PID()) != nil {
		t.Fatal("observer became an owned cleanup target")
	}
	caller, cancelCaller := context.WithCancel(f.ctx)
	t.Cleanup(cancelCaller)
	returnPGExec(t, caller, conn, "BEGIN; UPDATE player_wallet SET food=food+1 WHERE player_id=1")
	cancelCaller() // Cleanup must not inherit this ended caller's canceled context.
	stale := returnBackendSet{backends: map[uint32]*returnOwnedBackend{
		pid: {pid: pid, started: "2000-01-01 00:00:00+00"},
	}}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	stale.noLocks(t, ctx, f.observer, pid, f.profile.SchemaOID)
	var active bool
	returnPGOK(t, f.observer.QueryRow(ctx, "SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND xact_start IS NOT NULL)", pid, started).Scan(&active))
	if !active {
		t.Fatal("readonly stale-identity check ended the actual transaction")
	}
	done := make(chan struct{})
	close(done) // Caller joined without rolling back its abandoned transaction.
	owned.cleanup(t, f, done)
	observe, stop := context.WithTimeout(context.Background(), 8*time.Second)
	defer stop()
	if _, err := conn.Exec(observe, "SELECT 1"); err == nil {
		t.Fatal("cleanup left the captured transport usable")
	}
	var food int64
	returnPGOK(t, f.observer.QueryRow(observe, "SELECT food FROM player_wallet WHERE player_id=1").Scan(&food))
	if food != 100 || owned.get(pid) != b || b.started != started {
		t.Fatal("cleanup committed abandoned writes or replaced ownership", food)
	}
	returnPGOK(t, f.observer.QueryRow(observe, "SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND xact_start IS NOT NULL)", pid, started).Scan(&active))
	if active {
		t.Fatal("cleanup retained the owned transaction")
	}
}
