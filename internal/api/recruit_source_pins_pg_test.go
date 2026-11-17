package api

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgconn/ctxwatch"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Recruit has nine pins, including five MIL relations; Return's twelve-pin
// witness is not used. Inspect all schema relation locks, not only expected OIDs.
func recruitPinWitness(t *testing.T, ctx context.Context, observer *pgx.Conn, trace *returnLifetimeTrace, p freshsource.Profile, rank int, blocker uint32) uint32 {
	t.Helper()
	var want, got []string
	for i, name := range recruitPGPinNames {
		if i > rank {
			continue
		}
		mode := "RowExclusiveLock"
		if i < 2 || i == 3 {
			mode = "RowShareLock"
		}
		want = append(want, fmt.Sprintf("%s:%s:%t", name, mode, i != rank))
	}
	sort.Strings(want)
	var pid uint32
	var blockers []int32
	for deadline := time.Now().Add(10 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if events := trace.events(); len(events) > 0 {
			pid = events[0].pid
		}
		if pid == 0 {
			continue
		}
		returnLifetimeCheck(t, pid != observer.PgConn().PID() && pid != blocker, "pin witness reused observer/blocker backend")
		returnPGOK(t, observer.QueryRow(ctx, `SELECT ARRAY(SELECT c.relname||':'||l.mode||':'||l.granted::text
FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_class c ON c.oid=l.relation
WHERE l.pid=$1 AND c.relnamespace=$2 AND l.mode <> 'AccessShareLock' ORDER BY c.relname,l.mode,l.granted),
pg_catalog.pg_blocking_pids($1)`, pid, p.SchemaOID).Scan(&got, &blockers))
		blocked := len(blockers) == 0 && blocker == 0 || len(blockers) == 1 && uint32(blockers[0]) == blocker
		if reflect.DeepEqual(got, want) && blocked {
			t.Logf("Recruit pins: pid=%d rank=%d locks=%v blockers=%v", pid, rank, got, blockers)
			return pid
		}
	}
	t.Fatalf("Recruit pin prefix/suffix: got=%v want=%v blockers=%v", got, want, blockers)
	return 0
}

func TestPGRecruitGenerationOrderedPins(t *testing.T) {
	trace := returnLifetimeTracer("rollback")
	observer, binding, profile := recruitLifetimeFixture(t, trace)
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	g, err := newRecruitGeneration(binding, profile, returnPGCatalog(t))
	returnPGOK(t, err)
	var blockers []*pgx.Conn
	for _, name := range recruitPGPinNames {
		blockers = append(blockers, returnPinBlocker(t, ctx, observer, profile, name))
	}
	_, done := recruitLifetimeStart(t, g, trace)
	for i, blocker := range blockers {
		recruitPinWitness(t, ctx, observer, trace, profile, i, blocker.PgConn().PID())
		recruitLifetimeState(t, g, 1, false, false)
		returnPGExec(t, ctx, blocker, "ROLLBACK")
	}
	pid := returnLifetimeReached(t, trace)
	recruitPinWitness(t, ctx, observer, trace, profile, len(recruitPGPinNames), 0)
	recruitLifetimeState(t, g, 1, false, false)
	trace.release()
	result := returnLifetimeFinish(t, done)
	returnPGOK(t, result.err)
	returnLifetimeCheck(t, result.fault == nil, "unexpected panic", result.fault)
	returnLifetimeRollback(t, trace, false)
	recruitLifetimeState(t, g, 0, false, true)
	recruitPGRecorded(t, &trace.returnPGTrace, observer, profile, 9)
	returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
	recruitPGReleased(t, ctx, observer, profile)
	returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "initialization changed rows or sequences")
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(ctx))
}

func TestPGRecruitGenerationCanceledPin(t *testing.T) {
	for _, mode := range []string{"default_unknown", "cancel_request_ended"} {
		t.Run(mode, func(t *testing.T) {
			trace := returnLifetimeTracer("")
			confirmed := mode == "cancel_request_ended"
			observer, binding, profile := recruitLifetimeFixture(t, trace, func(cfg *pgxpool.Config) {
				if confirmed {
					cfg.ConnConfig.BuildContextWatcherHandler = func(conn *pgconn.PgConn) ctxwatch.Handler {
						return &pgconn.CancelRequestContextWatcherHandler{Conn: conn, DeadlineDelay: 3 * time.Second}
					}
				}
			})
			ctx := returnPGContext(t)
			before := returnPGSnapshot(t, ctx, observer, profile)
			g, err := newRecruitGeneration(binding, profile, returnPGCatalog(t))
			returnPGOK(t, err)
			blocker := returnPinBlocker(t, ctx, observer, profile, "player_wallet")
			cancel, done := recruitLifetimeStart(t, g, trace)
			pid := recruitPinWitness(t, ctx, observer, trace, profile, 2, blocker.PgConn().PID())
			recruitLifetimeState(t, g, 1, false, false)
			cancel()
			result := returnLifetimeFinish(t, done)
			var pgerr *pgconn.PgError
			returnLifetimeCheck(t, result.err != nil && result.fault == nil && (errors.Is(result.err, context.Canceled) || errors.As(result.err, &pgerr) && pgerr.Code == "57014"), "blocked cancellation lost", result)
			returnLifetimeCheck(t, g.s.phase == "wallet pin", "cancellation did not reach actual wallet pin", g.s.phase)
			returnLifetimeRollback(t, trace, !confirmed)
			pending := uint64(1)
			if confirmed {
				pending = 0
			}
			recruitLifetimeClosed(t, g, trace, pending)
			returnLifetimeNoLocks(t, ctx, observer, pid, profile.SchemaOID)
			returnPGExec(t, ctx, blocker, "ROLLBACK")
			recruitPGReleased(t, ctx, observer, profile)
			returnLifetimeCheck(t, reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)), "cancellation changed fixture")
		})
	}
}
