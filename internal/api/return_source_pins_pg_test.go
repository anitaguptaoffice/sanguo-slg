package api

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgconn/ctxwatch"
	"github.com/jackc/pgx/v5/pgxpool"
)

func returnPinBlocker(t *testing.T, ctx context.Context, observer *pgx.Conn, p freshsource.Profile, name string) *pgx.Conn {
	t.Helper()
	conn, err := pgx.ConnectConfig(ctx, observer.Config().Copy())
	returnPGOK(t, err)
	t.Cleanup(func() {
		clean, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = conn.Close(clean)
	})
	// EXCLUSIVE blocks both required pin strengths but permits constructor reads.
	returnPGExec(t, ctx, conn, "BEGIN; LOCK TABLE ONLY "+pgx.Identifier{p.SchemaName, name}.Sanitize()+" IN EXCLUSIVE MODE")
	return conn
}

func returnPinWitness(t *testing.T, ctx context.Context, observer *pgx.Conn, trace *returnLifetimeTrace, p freshsource.Profile, rank int, blocker uint32) uint32 {
	t.Helper()
	var ids []uint32
	var want, got []string
	for i, name := range returnPGPins {
		ids = append(ids, p.Objects[name].OID)
		if i > rank {
			continue
		}
		mode := "RowExclusiveLock"
		if i < 2 || i == 3 {
			mode = "RowShareLock"
		}
		want = append(want, fmt.Sprintf("%d:%s:%t", i+1, mode, i != rank))
	}
	var pid uint32
	var blockers []int32
	var mapPins int
	for deadline := time.Now().Add(10 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if events := trace.events(); len(events) > 0 {
			pid = events[0].pid
		}
		if pid == 0 {
			continue
		}
		returnPGOK(t, observer.QueryRow(ctx, `SELECT ARRAY(SELECT e.n::text||':'||l.mode||':'||l.granted::text
FROM unnest($2::oid[]) WITH ORDINALITY e(oid,n) JOIN pg_catalog.pg_locks l ON l.relation=e.oid
WHERE l.pid=$1 AND l.mode IN ('RowShareLock','RowExclusiveLock') ORDER BY e.n,l.mode), pg_catalog.pg_blocking_pids($1),
(SELECT count(*) FROM pg_catalog.pg_locks WHERE pid=$1 AND relation=$3 AND mode <> 'AccessShareLock')`, pid, ids, p.Objects["map_cell"].OID).Scan(&got, &blockers, &mapPins))
		blocked := len(blockers) == 0 && blocker == 0 || len(blockers) == 1 && uint32(blockers[0]) == blocker
		if reflect.DeepEqual(got, want) && blocked && mapPins == 0 {
			t.Logf("pin witness: pid=%d granted=%d waiting=%d blockers=%v", pid, rank, blocker, blockers)
			return pid
		}
	}
	t.Fatalf("pin prefix/suffix: got=%v want=%v blockers=%v mapPins=%d", got, want, blockers, mapPins)
	return 0
}
func returnLifetimeNoLocks(t *testing.T, ctx context.Context, observer *pgx.Conn, pid, schema uint32) {
	t.Helper()
	for deadline := time.Now().Add(10 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		var ended bool
		returnPGOK(t, observer.QueryRow(ctx, `SELECT NOT EXISTS(SELECT FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_class c ON c.oid=l.relation
WHERE l.pid=$1 AND c.relnamespace=$2) AND NOT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND xact_start IS NOT NULL)`, pid, schema).Scan(&ended))
		if ended {
			return
		}
	}
	t.Fatal("owned backend still holds transaction or source locks")
}

func TestPGReturnGenerationOrderedPins(t *testing.T) {
	trace := returnLifetimeTracer("rollback")
	_, observer, binding, profile := returnPGFixture(t, trace)
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	g, err := newReturnGeneration(binding, profile, returnPGCatalog(t))
	returnPGOK(t, err)
	var blockers []*pgx.Conn
	for _, name := range returnPGPins {
		blockers = append(blockers, returnPinBlocker(t, ctx, observer, profile, name))
	}
	_, done := returnLifetimeStart(t, g, trace)
	for i, blocker := range blockers {
		returnPinWitness(t, ctx, observer, trace, profile, i, blocker.PgConn().PID())
		returnLifetimeState(t, g, 1, false, false)
		returnPGExec(t, ctx, blocker, "ROLLBACK")
	}
	pid := returnLifetimeReached(t, trace)
	returnPinWitness(t, ctx, observer, trace, profile, len(returnPGPins), 0)
	returnLifetimeState(t, g, 1, false, false) // Even complete construction is not publication before end.
	trace.release()
	result := returnLifetimeFinish(t, done)
	returnPGOK(t, result.err)
	returnLifetimeCheck(t, result.fault == nil, "unexpected panic", result.fault)
	returnLifetimeRollback(t, trace, false)
	returnLifetimeState(t, g, 0, false, true)
	returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
	returnPGReleased(t, ctx, observer, profile)
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "initialization changed rows or sequences")
}

func TestPGReturnGenerationCanceledPin(t *testing.T) {
	for _, mode := range []string{"default_unknown", "cancel_request_ended"} {
		t.Run(mode, func(t *testing.T) {
			trace := returnLifetimeTracer("")
			confirmed := mode == "cancel_request_ended"
			_, observer, binding, profile := returnPGFixture(t, trace, func(cfg *pgxpool.Config) {
				if confirmed {
					cfg.ConnConfig.BuildContextWatcherHandler = func(conn *pgconn.PgConn) ctxwatch.Handler {
						return &pgconn.CancelRequestContextWatcherHandler{Conn: conn, DeadlineDelay: 3 * time.Second}
					}
				}
			})
			ctx := returnPGContext(t)
			before := returnPGSnapshot(t, ctx, observer, profile)
			g, err := newReturnGeneration(binding, profile, returnPGCatalog(t))
			returnPGOK(t, err)
			blocker := returnPinBlocker(t, ctx, observer, profile, "player_wallet")
			cancel, done := returnLifetimeStart(t, g, trace)
			pid := returnPinWitness(t, ctx, observer, trace, profile, 2, blocker.PgConn().PID())
			returnLifetimeState(t, g, 1, false, false)
			cancel()
			result := returnLifetimeFinish(t, done)
			var pgerr *pgconn.PgError
			returnLifetimeCheck(t, result.err != nil && result.fault == nil && (errors.Is(result.err, context.Canceled) || errors.As(result.err, &pgerr) && pgerr.Code == "57014"), "actual blocked cancellation lost", result)
			returnLifetimeRollback(t, trace, !confirmed)
			if confirmed {
				returnLifetimeState(t, g, 0, true, false)
				returnPGOK(t, g.s.admission.waitDrained(ctx))
				alias := *g
				returnLifetimeCheck(t, alias.initialize(ctx) != nil, "cancelled generation reopened")
			} else {
				returnLifetimeQuarantined(t, g, trace)
			}
			returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			returnPGExec(t, ctx, blocker, "ROLLBACK")
			returnPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "cancellation changed fixture")
		})
	}
}
