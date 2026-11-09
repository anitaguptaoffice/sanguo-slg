package api

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
)

type recruitFirstRole struct{}
type recruitFirstKey struct{}
type recruitFirstToken struct {
	owner *recruitFirstTrace
	conn *pgx.Conn
	inner pgx.QueryTracer
	sql string
	ended bool
}
type recruitFirstTrace struct {
	mu sync.Mutex
	streams [2]pgx.QueryTracer
	owners map[*pgx.Conn]int
	fault bool
}

func (r *recruitFirstTrace) TraceQueryStart(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	r.mu.Lock()
	role, explicit := ctx.Value(recruitFirstRole{}).(int)
	invalid := ctx.Value(recruitFirstRole{}) != nil && (!explicit || role != 1)
	owned, active := r.owners[c]
	if active {
		invalid = invalid || (explicit && role != owned)
		role = owned // Independent Background rollback keeps its exact connection owner.
	}
	if invalid || c == nil {
		r.fault = true
		r.mu.Unlock()
		return ctx
	}
	if strings.HasPrefix(d.SQL, "begin") {
		if r.owners == nil {
			r.owners = make(map[*pgx.Conn]int)
		}
		r.owners[c] = role
	}
	q := &recruitFirstToken{owner: r, conn: c, inner: r.streams[role], sql: d.SQL}
	r.mu.Unlock()
	return context.WithValue(q.inner.TraceQueryStart(ctx, c, d), recruitFirstKey{}, q)
}

func (r *recruitFirstTrace) TraceQueryEnd(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryEndData) {
	r.mu.Lock()
	q, ok := ctx.Value(recruitFirstKey{}).(*recruitFirstToken)
	if !ok || q == nil || q.owner != r || q.conn != c || q.ended {
		r.fault = true
		r.mu.Unlock()
		return // Never forward malformed tokens into an inner recorder.
	}
	q.ended = true
	if (q.sql == "commit" && d.Err == nil) || q.sql == "rollback" {
		delete(r.owners, c)
	}
	r.mu.Unlock()
	q.inner.TraceQueryEnd(ctx, c, d) // No routing mutex spans a real gate.
}

func TestRecruitCompletionFirstRouting(t *testing.T) {
	for _, bad := range []string{"missing", "duplicate", "foreign", "connection", "role", "mismatch"} {
		t.Run(bad, func(t *testing.T) {
			a, b := new(recruitReturnForward), new(recruitReturnForward)
			r := &recruitFirstTrace{streams: [2]pgx.QueryTracer{a, b}}
			c, other := new(pgx.Conn), new(pgx.Conn) // Opaque identities; no SQL execution.
			ctx := context.WithValue(context.Background(), recruitFirstRole{}, 1)
			start := func(ctx context.Context, sql string) context.Context {
				return r.TraceQueryStart(ctx, c, pgx.TraceQueryStartData{SQL: sql})
			}
			begun := start(ctx, "begin isolation level read committed")
			r.TraceQueryEnd(begun, c, pgx.TraceQueryEndData{})
			if bad == "mismatch" {
				r.owners[c] = 0 // Isolated protocol control, not a business witness.
				start(ctx, "select")
			} else if bad == "role" {
				start(context.WithValue(ctx, recruitFirstRole{}, "unknown"), "select")
			} else {
				q := start(context.Background(), "rollback")
				err := errors.New("preserve rollback cause")
				r.TraceQueryEnd(q, c, pgx.TraceQueryEndData{Err: err})
				if a.starts != 0 || b.starts != 2 || b.ends != 2 || b.errors[1] != err || begun.Value(recruitFirstRole{}) != 1 {
					t.Fatal("connection-owned rollback, original context or error was lost")
				}
				switch bad {
				case "missing":
					q = context.Background()
				case "foreign":
					q = context.WithValue(ctx, recruitFirstKey{}, &recruitFirstToken{owner: new(recruitFirstTrace), conn: c})
				case "connection":
					q = start(ctx, "select")
					c = other
				}
				r.TraceQueryEnd(q, c, pgx.TraceQueryEndData{})
				if b.ends != 2 {
					t.Fatal("bad End reached inner recorder")
				}
			}
			if !r.fault {
				t.Fatal("invalid route/token was accepted", bad)
			}
		})
	}
}
