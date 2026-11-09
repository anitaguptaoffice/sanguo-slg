package api

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
)

func TestPGReturnOverflowUnblocksRecruitCompletion(t *testing.T) {
	trace := returnLifetimeTracer("select pg_catalog.clock_timestamp()")
	returned := &recruitReturnObservedTrace{inner: trace, credit: "rollback"}
	var recruited *recruitReturnObservedTrace
	router := &recruitFirstTrace{}
	f := newRecruitCompleteReturnPG(t, func(base *recruitPromotionTrace) pgx.QueryTracer {
		recruited = &recruitReturnObservedTrace{inner: base}
		router.streams = [2]pgx.QueryTracer{recruited, returned}
		return router
	})
	set := recruitReturnSQLSet(t, f.profile)
	recruited.credit = set["return-credit"]
	// Synthetic retained survivors only, before either real paid admission.
	returnPGExec(t, f.ctx, f.observer, "UPDATE army_troop SET count=8 WHERE server_id=1 AND army_id=1 AND unit_cfg_id=1")
	state := recruitReturnRowsPaid(t, f, recruited)
	var exact bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[8,8,6,9] FROM army_troop").Scan(&exact))
	if !exact {
		t.Fatal("overflow fixture did not retain the intended survivors")
	}
	ctx, cancel := context.WithTimeout(context.WithValue(f.ctx, recruitFirstRole{}, 1), 30*time.Second)
	var lead *recruitReturnCall
	var lag *recruitNoeffectCall
	t.Cleanup(func() {
		cancel()
		trace.release()
		joined := make(chan struct{})
		go func() {
			if lead != nil {
				<-lead.done
			}
			if lag != nil {
				<-lag.done
			}
			close(joined)
		}()
		f.owned.cleanup(t, f.returnAttemptPG, joined)
	}) // The later Recruit starter cleanup cancels/releases it first by LIFO.
	lead = &recruitReturnCall{done: make(chan struct{})}
	go func() {
		defer close(lead.done)
		defer func() { lead.fault = recover() }()
		lead.returned = f.generation.complete(ctx, f.candidate)
	}()
	leader := returnLifetimeReached(t, trace)
	if leader == 0 || leader == f.observer.PgConn().PID() || f.owned.get(leader) == nil ||
		!reflect.DeepEqual(state.paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("Return clock boundary or paid snapshot differs")
	}
	selected, _ := recruited.snapshot()
	full := len(f.trace.events())
	var lower, upper time.Time
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&lower))
	lag = startRecruitNoeffect(t, f.recruit, &f.trace.recruitNoeffectTrace, state.candidate)
	wait, stop := context.WithTimeout(f.ctx, 8*time.Second)
	defer stop()
	var follower uint32
	for follower == 0 {
		var pids []int32
		returnPGOK(t, f.observer.QueryRow(wait, `SELECT COALESCE(array_agg(pid),'{}'::int[]) FROM pg_catalog.pg_stat_activity
WHERE datname=current_database() AND usename=current_user AND query=$1 AND wait_event_type='Lock'
AND pg_catalog.pg_blocking_pids(pid)=ARRAY[$2::int]`, set["wallet"], leader).Scan(&pids))
		if len(pids) == 1 {
			follower = uint32(pids[0])
			break
		}
		select {
		case <-wait.Done():
			t.Fatal("no exact Recruit wallet waiter", pids)
		case <-time.After(10 * time.Millisecond):
		}
	}
	events := f.trace.events()[full:]
	if follower == leader || follower == f.observer.PgConn().PID() || f.owned.get(follower) == nil || len(events) == 0 ||
		events[len(events)-1].sql != set["wallet"] || events[len(events)-1].pid != follower {
		t.Fatal("wallet waiter is not the distinct actual Recruit call")
	}
	t.Logf("actual Recruit backend %d waits at wallet on overflowing Return backend %d", follower, leader)
	trace.release() // Never pause inside the independent five-second rollback.
	if !returnBackendJoin(lead.done, 8*time.Second) {
		t.Fatal("overflowing Return did not join")
	}
	if lead.fault != nil {
		t.Fatal("overflowing Return panicked", lead.fault)
	}
	rejected := func(result returnAttemptResult, start, selected int) {
		t.Helper()
		if result.outcome != returnKnownEnded || !errors.Is(result.cause, march.ErrReturnUnavailable) ||
			errors.Is(result.cause, march.ErrReturnSource) || result.confirmed != (march.ReturnObservation{}) || result.cleanup != nil || result.diagnostic != nil {
			t.Fatal("capacity rejection did not end cleanly without retiring source", result)
		}
		events := trace.events()[start:]
		returnPGOK(t, returnOverflowRecorded(events, f.observer.PgConn().PID(), set))
		q, fault := returned.snapshot()
		q = q[selected:]
		if len(q) != 1 {
			t.Fatal("capacity rejection did not produce one observed rollback")
		}
		pid, conn := events[0].pid, q[0].conn
		returnPGOK(t, returnOverflowEnded(q, fault, pid, conn))
		owned := f.owned.get(pid)
		if owned == nil || conn.PgConn().PID() != pid || owned.transport != conn.PgConn().Conn() {
			t.Fatal("rollback evidence is not the original captured transport")
		}
		trace.guard.Lock()
		bounded := trace.bounded
		trace.guard.Unlock()
		if !bounded {
			t.Fatal("actual rollback lost its independent live five-second deadline")
		}
		f.owned.noLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
		returnAttemptClean(t, f.returnAttemptPG)
		returnLifetimeState(t, f.generation, 0, false, true)
	}
	rejected(lead.returned, 0, 0)
	if returnLifetimeReached(t, lag.clock) != follower {
		t.Fatal("Recruit did not acquire wallet after Return rollback")
	}
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&upper))
	if !reflect.DeepEqual(state.paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("rejected Return changed paid state before Recruit writes")
	}
	lag.clock.release()
	if returnLifetimeReached(t, lag.commit) != follower || !reflect.DeepEqual(state.paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("Recruit pre-Commit identity or uncommitted snapshot differs")
	}
	select {
	case <-lag.done:
		t.Fatal("Recruit returned before Commit")
	default:
	}
	lag.commit.release()
	if !returnBackendJoin(lag.done, 8*time.Second) {
		t.Fatal("paid Recruit completion did not join")
	}
	if lag.fault != nil {
		t.Fatal("paid Recruit completion panicked", lag.fault)
	}
	recruitAttemptPGConfirmed(t, lag.result)
	if lag.result.completion != march.RecruitCompleted || lag.result.confirmed != (march.RecruitAcceptance{}) {
		t.Fatal("paid completion was lost after rejected Return", lag.result)
	}
	returnPGOK(t, recruitPromotionRecorded(f.trace.events()[full:], f.observer.PgConn().PID(), f.profileR))
	recruited.check(t, f, len(selected), full, nil)
	after := recruitReturnRowsCheckpoint(t, f, state, lower, upper)
	// Explicit test retry: converting P into R cannot free Return capacity.
	start := len(trace.events())
	q, _ := returned.snapshot()
	rejected(f.generation.complete(ctx, f.candidate), start, len(q))
	if !reflect.DeepEqual(after, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("rejected retry changed final values, MVCC, due or allocators")
	}
	f.recruit.s.mu.Lock()
	closed, attempts, ready := f.recruit.s.closed, len(f.recruit.s.attempts), f.recruit.s.bundle != nil
	f.recruit.s.mu.Unlock()
	f.recruit.s.admission.s.mu.Lock()
	pending, admissionClosed := f.recruit.s.admission.s.pending, f.recruit.s.admission.s.closed
	f.recruit.s.admission.s.mu.Unlock()
	router.mu.Lock()
	fault, routes, queries := router.fault, len(router.owners), len(router.pending)
	router.mu.Unlock()
	if closed || !ready || admissionClosed || attempts != 0 || pending != 0 || fault || routes != 0 || queries != 0 {
		t.Fatal("overflow flow retained attempts/leases/routes or incomplete queries")
	}
	returnPGOK(t, f.recruit.close())
	returnPGOK(t, f.generation.close())
	returnPGOK(t, f.recruit.s.admission.waitDrained(f.ctx))
	returnPGOK(t, f.generation.s.admission.waitDrained(f.ctx))
	returnPGReleased(t, f.ctx, f.observer, f.profile)
	recruitReturnPoolReusable(t, f.ctx, f.pool, f.observer.PgConn().PID())
	if f.pool.Stat().AcquiredConns() != 0 || !reflect.DeepEqual(after, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("close/drain/reuse retained a slot or changed durable state")
	}
}
