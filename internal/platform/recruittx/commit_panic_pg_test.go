package recruittx

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type commitPanicTrace struct {
	afterCommit, disabled      bool
	original, secondary        error
	begins, commits, rollbacks int
	boundedCleanup             bool
}

func (f *commitPanicTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if f.disabled {
		return ctx
	}
	if strings.HasPrefix(data.SQL, "begin") {
		f.begins++
	}
	if data.SQL == "commit" {
		f.commits++
		if !f.afterCommit {
			panic(f.original)
		}
	}
	if data.SQL == "rollback" {
		f.rollbacks++
		deadline, ok := ctx.Deadline()
		remaining := time.Until(deadline)
		f.boundedCleanup = ok && ctx.Err() == nil && remaining > 0 && remaining <= 5*time.Second
		panic(f.secondary)
	}
	return ctx
}

func (f *commitPanicTrace) TraceQueryEnd(_ context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	if !f.disabled && f.afterCommit && data.Err == nil && data.CommandTag.String() == "COMMIT" {
		panic(f.original)
	}
}

// These are real pgx/pool transactions, with faults only in a test QueryTracer.
func TestPostgresOwnerCommitDoublePanic(t *testing.T) {
	dsn := os.Getenv("RECRUIT_TX_TEST_DSN")
	if dsn == "" {
		t.Skip("isolated PostgreSQL test DSN not supplied")
	}
	for _, afterCommit := range []bool{false, true} {
		name := "commit_start_still_live"
		if afterCommit {
			name = "commit_end_already_committed"
		}
		t.Run(name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			observer, err := pgx.Connect(ctx, dsn)
			check(t, err == nil, fmt.Sprint(err))
			t.Cleanup(func() {
				clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
				defer stop()
				check(t, observer.Close(clean) == nil, "observer close failed")
			})
			var version int
			check(t, observer.QueryRow(ctx, "SELECT current_setting('server_version_num')::int").Scan(&version) == nil && version/10000 == 17, "PG17 required")
			table := pgx.Identifier{fmt.Sprintf("commit_panic_%d", time.Now().UnixNano())}.Sanitize()
			_, err = observer.Exec(ctx, "CREATE TABLE "+table+"(id integer PRIMARY KEY)")
			check(t, err == nil, fmt.Sprint(err))
			t.Cleanup(func() {
				clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
				defer stop()
				_, err := observer.Exec(clean, "DROP TABLE "+table)
				check(t, err == nil, fmt.Sprint(err))
			})
			trace := &commitPanicTrace{afterCommit: afterCommit, original: errors.New("Commit tracer panic"), secondary: errors.New("Rollback tracer panic")}
			cfg, err := pgxpool.ParseConfig(dsn)
			check(t, err == nil, fmt.Sprint(err))
			cfg.MaxConns = 1
			cfg.ConnConfig.Tracer = trace
			pool, err := pgxpool.NewWithConfig(ctx, cfg)
			check(t, err == nil, fmt.Sprint(err))
			var owner *Owner
			t.Cleanup(func() {
				// Fixture-only release AFTER assertions, never a production recovery path.
				trace.disabled = true
				if owner != nil {
					clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
					defer stop()
					raw := owner.s.tx
					var terminated bool
					err := observer.QueryRow(clean, "SELECT pg_terminate_backend($1, 2000)", raw.Conn().PgConn().PID()).Scan(&terminated)
					if err != nil || !terminated {
						t.Errorf("owned backend teardown: terminated=%v err=%v", terminated, err)
					}
					if err := raw.Conn().Close(clean); err != nil {
						t.Errorf("owned connection close: %v", err)
					}
					// The closed connection cannot execute SQL; this releases pgxpool's slot.
					_ = raw.Rollback(clean)
				}
				closed := make(chan struct{})
				go func() { pool.Close(); close(closed) }()
				select {
				case <-closed:
				case <-time.After(5 * time.Second):
					t.Error("owned pool teardown exceeded bound")
				}
			})
			binding, err := NewBinding(pool)
			check(t, err == nil, fmt.Sprint(err))
			owner, err = binding.Begin(ctx)
			check(t, err == nil, fmt.Sprint(err))
			access := *owner.Access()
			var pid, observerPID uint32
			check(t, access.Scan(ctx, binding, "SELECT pg_backend_pid()", nil, &pid) == nil, "owner PID")
			check(t, observer.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&observerPID) == nil && pid != observerPID, "observer must be independent")
			_, err = access.Exec(ctx, binding, "INSERT INTO "+table+" VALUES (1)")
			check(t, err == nil, fmt.Sprint(err))
			_, fault := captureCommit(owner, ctx)
			if fault != trace.original {
				t.Errorf("original Commit panic identity lost: got %v (%p), want %v (%p)", fault, fault, trace.original, trace.original)
			}
			check(t, trace.begins == 1 && trace.commits == 1 && trace.rollbacks == 1 && trace.boundedCleanup, "end attempts or cleanup context changed")
			check(t, pool.Stat().AcquiredConns() == 1, "tracer panic unexpectedly released pool slot")
			check(t, owner.s.ended && owner.s.ctx.Err() != nil && len(owner.s.gate) == 1, "terminal state, cancel or gate not released")
			fresh, stop := context.WithTimeout(context.Background(), time.Second)
			defer stop()
			_, err = access.Exec(fresh, binding, "SELECT 1")
			check(t, errors.Is(err, ErrInactive) || errors.Is(err, context.Canceled), "retained access reopened")
			err = owner.Commit(fresh)
			check(t, errors.Is(err, ErrInactive) || errors.Is(err, context.Canceled), "owner retried uncertain Commit")
			check(t, errors.Is(owner.Rollback(fresh), ErrInactive), "owner retried uncertain Rollback")
			check(t, trace.begins == 1 && trace.commits == 1 && trace.rollbacks == 1, "post-end work executed")
			var count int
			check(t, observer.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&count) == nil, "observer row read")
			wantCount := 0
			if afterCommit {
				wantCount = 1
			}
			check(t, count == wantCount, "actual durable outcome mismatch")
			var live bool
			check(t, observer.QueryRow(ctx, "SELECT xact_start IS NOT NULL FROM pg_stat_activity WHERE pid=$1", pid).Scan(&live) == nil, "observer transaction read")
			check(t, live == !afterCommit, "cleanup panic incorrectly treated as transaction end")
		})
	}
}
