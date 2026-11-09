package api

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
)

func TestPGRecruitCompletionFirstReturnCapacity(t *testing.T) {
	lagTrace := &recruitReturnTrace{returnLifetimeTrace: returnLifetimeTracer("commit"), pauseWallet: true,
		walletReached: make(chan struct{}), walletResume: make(chan struct{})}
	returned := &recruitReturnObservedTrace{inner: lagTrace}
	var recruited *recruitReturnObservedTrace
	router := &recruitFirstTrace{}
	f := newRecruitCompleteReturnPG(t, func(base *recruitPromotionTrace) pgx.QueryTracer {
		recruited = &recruitReturnObservedTrace{inner: base}
		router.streams = [2]pgx.QueryTracer{recruited, returned}
		return router
	})
	set := recruitReturnSQLSet(t, f.profile)
	recruited.credit, returned.credit, lagTrace.walletSQL = set["return-credit"], set["return-credit"], set["wallet"]
	state := recruitReturnRowsPaid(t, f, recruited)
	ctx, cancel := context.WithTimeout(context.WithValue(f.ctx, recruitFirstRole{}, 1), 30*time.Second)
	var lead *recruitNoeffectCall
	var lag *recruitReturnCall
	t.Cleanup(func() {
		cancel()
		lagTrace.release()
		lagTrace.releaseWallet()
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
	}) // The unchanged leader starter registers its cancel/release before this cleanup runs.
	selected, _ := recruited.snapshot()
	full := len(f.trace.events())
	var lower, upper time.Time
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&lower))
	lead = startRecruitNoeffect(t, f.recruit, &f.trace.recruitNoeffectTrace, state.candidate)
	leader := returnLifetimeReached(t, lead.clock)
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&upper))
	lead.clock.release()
	if leader == 0 || leader == f.observer.PgConn().PID() || returnLifetimeReached(t, lead.commit) != leader ||
		!reflect.DeepEqual(state.paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("actual leader pre-Commit or provisional snapshot differs")
	}
	select {
	case <-lead.done:
		t.Fatal("leader returned before Commit")
	default:
	}
	lag = &recruitReturnCall{done: make(chan struct{})}
	go func() {
		defer close(lag.done)
		defer func() { lag.fault = recover() }()
		lag.returned = f.generation.complete(ctx, f.candidate)
	}()
	wait, stop := context.WithTimeout(f.ctx, 8*time.Second)
	defer stop()
	var follower uint32
	for follower == 0 {
		var pids []int32
		returnPGOK(t, f.observer.QueryRow(wait, `SELECT COALESCE(array_agg(pid),'{}'::int[]) FROM pg_catalog.pg_stat_activity
WHERE datname=current_database() AND usename=current_user AND query=$1 AND wait_event_type='Lock'
AND pg_catalog.pg_blocking_pids(pid)=ARRAY[$2::int]`, lagTrace.walletSQL, leader).Scan(&pids))
		if len(pids) == 1 {
			follower = uint32(pids[0])
			break
		}
		select {
		case <-wait.Done():
			t.Fatal("no exact Return wallet waiter", pids)
		case <-time.After(10 * time.Millisecond):
		}
	}
	events := lagTrace.events()
	owned := f.owned.get(follower)
	if follower == leader || follower == f.observer.PgConn().PID() || owned == nil || len(events) == 0 ||
		events[len(events)-1].sql != lagTrace.walletSQL || events[len(events)-1].pid != follower {
		t.Fatal("wallet wait is not the distinct captured Return call")
	}
	t.Logf("actual Return backend %d waits at wallet on Recruit backend %d", follower, leader)
	lead.commit.release()
	if !returnBackendJoin(lead.done, 8*time.Second) || lead.fault != nil {
		t.Fatal("actual Recruit caller did not join cleanly", lead.fault)
	}
	recruitAttemptPGConfirmed(t, lead.result)
	if lead.result.completion != march.RecruitCompleted || lead.result.confirmed != (march.RecruitAcceptance{}) {
		t.Fatal("leader is not a genuine completion", lead.result)
	}
	returnPGOK(t, recruitPromotionRecorded(f.trace.events()[full:], f.observer.PgConn().PID(), f.profileR))
	recruited.check(t, f, len(selected), full, nil)
	select {
	case <-lagTrace.walletReached:
	case <-ctx.Done():
		t.Fatal("Return did not acquire released wallet", ctx.Err())
	}
	checkpoint := recruitReturnRowsCheckpoint(t, f, state, lower, upper)
	stable := snapshotReturnAttemptPG(t, f.returnAttemptPG, true)
	lagTrace.releaseWallet()
	if returnLifetimeReached(t, lagTrace.returnLifetimeTrace) != follower ||
		!reflect.DeepEqual(checkpoint, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("Return pre-Commit backend or uncommitted checkpoint differs")
	}
	select {
	case <-lag.done:
		t.Fatal("Return returned before Commit")
	default:
	}
	lagTrace.release()
	if !returnBackendJoin(lag.done, 8*time.Second) || lag.fault != nil {
		t.Fatal("actual Return caller did not join cleanly", lag.fault)
	}
	returnAttemptConfirmed(t, f.returnAttemptPG, lag.returned, march.ReturnApplied, f.due)
	returnPGOK(t, recruitReturnSQLRecorded(lagTrace.events(), f.observer.PgConn().PID(), set, true))
	want := recruitReturnObservedWant()
	want[0][3], want[0][4] = int64(2147483645), int64(2147483638)
	checkReturned := func(offset, full int, want [][]any) {
		t.Helper()
		q, fault := returned.snapshot()
		q = q[offset:]
		returnPGOK(t, recruitReturnObservedRecorded(q, fault, f.observer.PgConn().PID(), returned.credit, want))
		pid, c := q[0].pid, q[0].conn
		original := f.owned.get(pid)
		if original == nil || original.transport != c.PgConn().Conn() || c.PgConn().PID() != pid || pid != lagTrace.events()[full].pid {
			t.Fatal("Return selected evidence is not its original call/transport")
		}
		f.owned.noLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
	}
	checkReturned(0, 0, want)
	after := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitCompleteReturnChanges(t, checkpoint, after, map[string]bool{"city_troop": true, "march_order": true, "field_army": true})
	if !reflect.DeepEqual(stable, snapshotReturnAttemptPG(t, f.returnAttemptPG, true)) {
		t.Fatal("Return changed retained graph, paid ledger, wounded or allocators")
	}
	var exact bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[2147483645,20,19,23] AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[2147483647,2147483647,2147483647,2147483647] FROM city_troop)
AND (SELECT count(*)=1 AND bool_and(status=4) FROM march_order)
AND (SELECT count(*)=1 AND bool_and(status=1 AND x=0 AND y=0) FROM field_army)
AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] AND array_agg(count ORDER BY unit_cfg_id)=ARRAY[7,8,6,9] FROM army_troop)
AND (SELECT count::bigint+(SELECT sum((payload->>'count')::bigint) FROM work_queue WHERE queue_type=3 AND status IN(0,1))=2147483647 FROM city_troop WHERE unit_cfg_id=1)`).Scan(&exact))
	if !exact {
		t.Fatal("near-capacity Return final graph or R+P differs")
	}
	q, _ := returned.snapshot()
	full = len(lagTrace.events())
	terminal := f.generation.complete(ctx, f.candidate) // Both callers joined; existing gates are already released.
	returnAttemptConfirmed(t, f.returnAttemptPG, terminal, march.ReturnCreditedTerminal, f.due)
	returnPGOK(t, recruitReturnSQLRecorded(lagTrace.events()[full:], f.observer.PgConn().PID(), set, false))
	checkReturned(len(q), full, nil)
	if !reflect.DeepEqual(after, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("terminal retry changed values, MVCC or allocator")
	}
	returnAttemptClean(t, f.returnAttemptPG)
	f.recruit.s.mu.Lock()
	closed, attempts := f.recruit.s.closed, len(f.recruit.s.attempts)
	f.recruit.s.mu.Unlock()
	f.recruit.s.admission.s.mu.Lock()
	pending := f.recruit.s.admission.s.pending
	f.recruit.s.admission.s.mu.Unlock()
	router.mu.Lock()
	fault, routes := router.fault, len(router.owners)
	router.mu.Unlock()
	if closed || attempts != 0 || pending != 0 || fault || routes != 0 {
		t.Fatal("completion retained attempts/leases/routes or invalid trace evidence")
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
