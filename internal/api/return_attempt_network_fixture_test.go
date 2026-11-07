package api

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"testing"
	"testing/iotest"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgproto3"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errReturnNetwork = errors.New("fixture COMMIT transport cut")
var errReturnNetworkFrame = errors.New("fixture unexpected or incomplete protocol frame")

type returnNetworkWitness struct {
	pid                  uint32
	forwarded, tag, idle bool
	withheld             int
	err                  error
}
type returnNetwork struct {
	mu              sync.Mutex
	transports      []net.Conn
	connections     []*pgconn.PgConn
	pid             atomic.Uint32
	armed           atomic.Bool
	cut, fragmented bool
	ctx, guard      context.Context
	reached         chan returnNetworkWitness
	resume          chan struct{}
	released        sync.Once
	result          returnAttemptResult
	fault           any
}
type returnNetworkWire struct {
	n    *returnNetwork
	r    io.Reader
	w    io.Writer
	conn net.Conn
	ack  bool // Owned by the single pgx connection caller, never the watchdog.
}

func (n *returnNetwork) configure(cfg *pgxpool.Config) {
	cfg.MaxConns, cfg.MinConns = 1, 0
	cfg.ConnConfig.BuildFrontend = func(r io.Reader, w io.Writer) *pgproto3.Frontend {
		c := w.(net.Conn) // Pinned pgx v5.7.4 supplies the actual post-TLS transport.
		n.mu.Lock()
		n.transports = append(n.transports, c)
		n.mu.Unlock()
		wire := &returnNetworkWire{n: n, r: r, w: w, conn: c}
		return pgproto3.NewFrontend(wire, wire) // Reads MUST consume pgx's supplied BGReader.
	}
	previous := cfg.AfterConnect
	cfg.AfterConnect = func(ctx context.Context, c *pgx.Conn) error {
		if previous != nil {
			if err := previous(ctx, c); err != nil {
				return err
			}
		}
		n.mu.Lock()
		n.connections = append(n.connections, c.PgConn())
		n.mu.Unlock()
		n.pid.Store(c.PgConn().PID())
		return nil
	}
}

func returnNetworkAck(r io.Reader) (w returnNetworkWitness) {
	for _, frame := range []struct {
		kind byte
		body string
	}{{'C', "COMMIT\x00"}, {'Z', "I"}} {
		var header [5]byte
		n, err := io.ReadFull(r, header[:])
		w.withheld += n
		if err != nil || header[0] != frame.kind || binary.BigEndian.Uint32(header[1:]) != uint32(4+len(frame.body)) {
			w.err = errReturnNetworkFrame
			return
		}
		var body [7]byte // Exact lengths bound allocation; ErrorResponse is never success.
		n, err = io.ReadFull(r, body[:len(frame.body)])
		w.withheld += n
		if err != nil || string(body[:n]) != frame.body {
			w.err = errReturnNetworkFrame
			return
		}
		w.tag, w.idle = true, frame.kind == 'Z'
	}
	w.err = errReturnNetwork
	return
}

func (w *returnNetworkWire) pause(v returnNetworkWitness) error {
	v.pid = w.n.pid.Load()
	select {
	case w.n.reached <- v:
	case <-w.n.ctx.Done():
	case <-w.n.guard.Done():
	}
	select {
	case <-w.n.resume:
	case <-w.n.ctx.Done():
	case <-w.n.guard.Done():
	}
	_ = w.conn.Close()
	return v.err
}
func (w *returnNetworkWire) Read(p []byte) (int, error) {
	if !w.ack {
		return w.r.Read(p)
	}
	w.ack = false
	r := w.r
	if w.n.fragmented {
		r = iotest.OneByteReader(r)
	}
	v := returnNetworkAck(r)
	v.forwarded = true
	return 0, w.pause(v) // Not even a partial acknowledgement reaches pgproto3.
}
func (w *returnNetworkWire) Write(p []byte) (int, error) {
	if !w.n.armed.Load() {
		return w.w.Write(p) // Startup/authentication and initialization are untouched.
	}
	commit := false
	for remaining := p; len(remaining) > 0; {
		if len(remaining) < 5 {
			return 0, errReturnNetworkFrame
		}
		size := uint64(binary.BigEndian.Uint32(remaining[1:5])) + 1
		if size < 5 || size > uint64(len(remaining)) {
			return 0, errReturnNetworkFrame
		}
		if remaining[0] == 'Q' && string(remaining[5:size]) == "commit\x00" {
			if int(size) != len(p) { // Reject COMMIT mixed with other frontend frames.
				return 0, errReturnNetworkFrame
			}
			commit = true
		}
		remaining = remaining[size:]
	}
	if commit && w.n.cut {
		_ = w.conn.Close() // No byte of this COMMIT has been forwarded.
		return 0, w.pause(returnNetworkWitness{err: errReturnNetwork})
	}
	n, err := w.w.Write(p)
	if err == nil && n != len(p) {
		err = io.ErrShortWrite
	}
	w.ack = commit && err == nil && n == len(p)
	return n, err
}
func (n *returnNetwork) release() { n.released.Do(func() { close(n.resume) }) }
func (n *returnNetwork) abort() {
	n.release()
	n.mu.Lock()
	connections := append([]net.Conn(nil), n.transports...)
	n.mu.Unlock()
	for _, c := range connections {
		_ = c.SetDeadline(time.Now())
		_ = c.Close()
	}
}
func (n *returnNetwork) ended(t *testing.T, f *returnAttemptPG, pid uint32) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	for {
		var ended bool
		returnPGOK(t, f.observer.QueryRow(ctx, "SELECT NOT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1) AND NOT EXISTS(SELECT FROM pg_catalog.pg_locks WHERE pid=$1)", pid).Scan(&ended))
		if ended {
			returnPGReleased(t, ctx, f.observer, f.profile)
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal("cut backend or locks remain")
		case <-time.After(10 * time.Millisecond):
		}
	}
}

func (n *returnNetwork) start(t *testing.T, f *returnAttemptPG) <-chan struct{} {
	t.Helper()
	var cancel, abort context.CancelFunc
	n.ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	n.guard, abort = context.WithTimeout(context.Background(), 20*time.Second)
	done, watched := make(chan struct{}), make(chan struct{})
	t.Cleanup(func() { // Registered after fixture cleanup: closes transport BEFORE pool.Close.
		cancel()
		abort()
		n.abort()
		ctx, stop := context.WithTimeout(context.Background(), 18*time.Second)
		defer stop()
		for _, joined := range []<-chan struct{}{done, watched} {
			select {
			case <-joined:
			case <-ctx.Done():
				t.Error("network fixture goroutine did not join")
				return
			}
		}
		n.mu.Lock()
		connections := append([]*pgconn.PgConn(nil), n.connections...)
		n.mu.Unlock()
		for _, c := range connections {
			_ = c.Close(ctx) // Only after the APP caller joined; no concurrent PgConn use.
			select {
			case <-c.CleanupDone(): // pgx async cleanup has its own 15-second bound.
			case <-ctx.Done():
				t.Error("pgx asynchronous cleanup did not finish")
			}
		}
		n.ended(t, f, n.pid.Load())
	})
	n.armed.Store(true)
	go func() {
		defer close(watched)
		select {
		case <-n.ctx.Done():
		case <-n.guard.Done():
		case <-done:
		}
		n.abort()
	}()
	go func() {
		defer close(done)
		defer func() { n.fault = recover() }()
		n.result = f.generation.complete(n.ctx, f.candidate)
	}()
	return done
}
