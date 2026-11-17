package api

import (
	"reflect"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

func TestPGRecruitCompletionReturnSQLAppliedAndTerminal(t *testing.T) {
	f := newRecruitCompleteReturnPG(t)
	set := recruitReturnSQLSet(t, f.profile)
	initial := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitReturnPoolReusable(t, f.ctx, f.pool, f.observer.PgConn().PID())
	if !reflect.DeepEqual(initial, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("SQL fixture two-slot observation changed state")
	}
	first, candidate := f.paid(t, 0)
	second, _ := f.paid(t, 1)
	startAt := second.AcceptedAt
	if first.InitialFinishAt.After(startAt) {
		startAt = first.InitialFinishAt
	}
	if first.InitialStartAt != first.AcceptedAt || second.InitialStartAt != startAt {
		t.Fatal("actual paid initial FIFO schedules differ")
	}
	var exact bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT ARRAY[food,wood,iron,stone,gold]=ARRAY[0,0,0,0,0]::bigint[] FROM player_wallet WHERE server_id=1 AND player_id=1)
AND (SELECT count(*) FROM player_wallet)=1 AND (SELECT count(*) FROM work_queue)=3
AND (SELECT count(*) FROM mil_recruit_origin)=2 AND (SELECT count(*) FROM mil_recruit_receipt)=2
AND (SELECT array_agg(queue_id ORDER BY queue_id)=ARRAY[100,101]::bigint[] AND array_agg(status ORDER BY queue_id)=ARRAY[1,0]::smallint[]
AND sum((payload->>'count')::bigint)=4 FROM work_queue WHERE queue_type=3)
AND (SELECT last_value=101 AND is_called FROM work_queue_id_seq)
AND (SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[11,12,13,14] FROM city_troop)`).Scan(&exact))
	if !exact {
		t.Fatal("real paid pending/cardinality/wallet/allocator mismatch")
	}
	paid := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitCompleteReturnChanges(t, initial, paid, map[string]bool{"player_wallet": true, "work_queue": true, "mil_recruit_origin": true, "mil_recruit_receipt": true, "work_queue_id_seq": true})
	stable := snapshotReturnAttemptPG(t, f.returnAttemptPG, true)
	start := len(f.trace.events())
	f.complete(t, false, candidate, paid)
	returnPGOK(t, recruitReturnSQLRecorded(f.trace.events()[start:], f.observer.PgConn().PID(), set, true))
	returned := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitCompleteReturnChanges(t, paid, returned, map[string]bool{"city_troop": true, "march_order": true, "field_army": true})
	if !reflect.DeepEqual(stable, snapshotReturnAttemptPG(t, f.returnAttemptPG, true)) {
		t.Fatal("Return changed retained graph, wallet, paid ledger, schedules or allocator")
	}
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[18,20,19,23] AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[2147483647,2147483647,2147483647,2147483647] FROM city_troop)
AND (SELECT count(*)=1 AND bool_and(status=4) FROM march_order)
AND (SELECT count(*)=1 AND bool_and(status=1 AND x=0 AND y=0) FROM field_army)
AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] AND array_agg(count ORDER BY unit_cfg_id)=ARRAY[7,8,6,9] FROM army_troop)
AND (SELECT count::bigint+(SELECT sum((payload->>'count')::bigint) FROM work_queue WHERE queue_type=3 AND status IN(0,1))=22 FROM city_troop WHERE unit_cfg_id=1)`).Scan(&exact))
	if !exact {
		t.Fatal("Return exact stock/graph/survivors or R+P mismatch")
	}
	// The prior caller joined. Terminal replay has no clock or second Commit
	// gate; only the actual clean APP result confirms its real nil Commit.
	f.trace.guard.Lock()
	f.trace.call = nil
	f.trace.guard.Unlock()
	start = len(f.trace.events())
	result := f.generation.complete(f.ctx, f.candidate)
	returnAttemptConfirmed(t, f.returnAttemptPG, result, march.ReturnCreditedTerminal, f.due)
	events := f.trace.events()[start:]
	returnPGOK(t, recruitReturnSQLRecorded(events, f.observer.PgConn().PID(), set, false))
	f.owned.noLocks(t, f.ctx, f.observer, events[0].pid, f.profile.SchemaOID)
	if !reflect.DeepEqual(returned, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("credited-terminal replay changed values, MVCC or allocator")
	}
	returnAttemptClean(t, f.returnAttemptPG)
	f.recruit.s.mu.Lock()
	closed, attempts := f.recruit.s.closed, len(f.recruit.s.attempts)
	f.recruit.s.mu.Unlock()
	f.recruit.s.admission.s.mu.Lock()
	pending := f.recruit.s.admission.s.pending
	f.recruit.s.admission.s.mu.Unlock()
	if closed || attempts != 0 || pending != 0 {
		t.Fatal("unused Recruit generation lost healthy ownership")
	}
	returnPGOK(t, f.recruit.close())
	returnPGOK(t, f.generation.close())
	returnPGOK(t, f.recruit.s.admission.waitDrained(f.ctx))
	returnPGOK(t, f.generation.s.admission.waitDrained(f.ctx))
	returnPGReleased(t, f.ctx, f.observer, f.profile)
	recruitReturnPoolReusable(t, f.ctx, f.pool, f.observer.PgConn().PID())
	if f.pool.Stat().AcquiredConns() != 0 || !reflect.DeepEqual(returned, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("Return SQL cleanup/reuse retained a slot or changed durable state")
	}
}
