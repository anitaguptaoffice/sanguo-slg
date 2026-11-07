package api

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type recruitConfirmedToken struct {
	conn *pgx.Conn
	sql  string
}
type recruitConfirmedKey struct{ owner *recruitConfirmedTrace }
type recruitConfirmedTrace struct {
	inner          pgx.QueryTracer
	mu             sync.Mutex
	last, expected *pgx.Conn
	tokens         map[*recruitConfirmedToken]bool
	gate           *returnLifetimeTrace
}

func (r *recruitConfirmedTrace) TraceQueryStart(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	ctx = r.inner.TraceQueryStart(ctx, c, d)
	token := &recruitConfirmedToken{conn: c, sql: d.SQL}
	r.mu.Lock()
	if r.tokens == nil {
		r.tokens = make(map[*recruitConfirmedToken]bool)
	}
	r.tokens[token], r.last = true, c
	r.mu.Unlock()
	return context.WithValue(ctx, recruitConfirmedKey{r}, token)
}

func (r *recruitConfirmedTrace) TraceQueryEnd(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryEndData) {
	r.inner.TraceQueryEnd(ctx, c, d) // OBSERVED must finish before the new gate.
	token, _ := ctx.Value(recruitConfirmedKey{r}).(*recruitConfirmedToken)
	r.mu.Lock()
	valid := token != nil && r.tokens[token]
	delete(r.tokens, token) // A duplicate End cannot replace the first result.
	gate := valid && token.conn == c && c != nil && r.expected == c && token.sql == "commit" && d.Err == nil && d.CommandTag.String() == "COMMIT"
	r.mu.Unlock()
	if gate {
		recruitNoeffectGate(ctx, c, r.gate)
	}
}

// Protocol callbacks use real identities but never execute supplied SQL.
func recruitConfirmedControls(t *testing.T, f *recruitCompleteReturnPG) {
	t.Helper()
	held, err := f.pool.Acquire(f.ctx)
	returnPGOK(t, err)
	defer held.Release()
	c := held.Conn()
	for _, mode := range []string{"unarmed", "owner", "sql", "tag", "error", "connection", "absent", "foreign", "malformed", "forged", "duplicate", "valid"} {
		spy := new(recruitReturnForward)
		r := &recruitConfirmedTrace{inner: spy, expected: c, gate: returnLifetimeTracer("")}
		t.Cleanup(r.gate.release)
		caller := context.WithValue(f.ctx, recruitReturnCallerKey{}, 42)
		sql := "commit"
		if mode == "sql" {
			sql = "rollback"
		}
		ctx := r.TraceQueryStart(caller, c, pgx.TraceQueryStartData{SQL: sql})
		end := pgx.TraceQueryEndData{CommandTag: pgconn.NewCommandTag("COMMIT")}
		endConn := c
		switch mode {
		case "unarmed":
			r.expected = nil
		case "owner":
			r.expected = f.observer
		case "tag", "duplicate":
			end.CommandTag = pgconn.NewCommandTag("ROLLBACK")
		case "error":
			end.Err = fmt.Errorf("protocol sentinel")
		case "connection":
			endConn = f.observer
			ctx = context.WithValue(ctx, recruitReturnForwardKey{}, endConn)
		case "absent":
			ctx = context.WithValue(caller, recruitReturnForwardKey{}, c)
		case "foreign":
			other := &recruitConfirmedTrace{inner: spy}
			ctx = other.TraceQueryStart(caller, c, pgx.TraceQueryStartData{SQL: sql})
		case "malformed":
			ctx = context.WithValue(ctx, recruitConfirmedKey{r}, 17)
		case "forged":
			ctx = context.WithValue(ctx, recruitConfirmedKey{r}, &recruitConfirmedToken{conn: c, sql: sql})
		}
		if spy.starts < 1 || spy.sql[0] != sql || ctx.Value(recruitReturnCallerKey{}) != 42 {
			t.Fatal("Start forwarding or caller context changed", mode)
		}
		if mode != "valid" {
			r.gate.release() // A bad implementation must fail, not hang the control.
			r.TraceQueryEnd(ctx, endConn, end)
			if mode == "duplicate" {
				r.TraceQueryEnd(ctx, c, pgx.TraceQueryEndData{CommandTag: pgconn.NewCommandTag("COMMIT")})
			}
			select {
			case <-r.gate.reached:
				t.Fatal("invalid End consumed confirmed gate", mode)
			default:
			}
			if spy.ends == 0 || spy.tags[0] != end.CommandTag.String() || spy.errors[0] != end.Err {
				t.Fatal("invalid End was not forwarded unchanged", mode)
			}
			continue
		}
		done := make(chan struct{})
		t.Cleanup(func() {
			r.gate.release()
			if !returnBackendJoin(done, 8*time.Second) {
				t.Error("protocol End did not join")
			}
		})
		go func() {
			r.TraceQueryEnd(ctx, c, end)
			close(done)
		}()
		if returnLifetimeReached(t, r.gate) != c.PgConn().PID() || spy.starts != 1 || spy.ends != 1 || spy.tags[0] != "COMMIT" ||
			ctx.Value(recruitReturnCallerKey{}) != 42 || ctx.Value(recruitReturnForwardKey{}) != c {
			t.Fatal("valid End did not forward before its owned gate")
		}
		select {
		case <-done:
			t.Fatal("valid End escaped its gate")
		default:
		}
		r.gate.release()
		if !returnBackendJoin(done, 8*time.Second) {
			t.Fatal("valid End did not join")
		}
	}
}
