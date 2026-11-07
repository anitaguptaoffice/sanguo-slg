package api

import (
	"reflect"
	"testing"
	"time"
)

func TestPGRecruitCompletionReturnPairedFixture(t *testing.T) {
	f := newRecruitCompleteReturnPG(t)
	initial := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitReturnPoolReusable(t, f.ctx, f.pool, f.observer.PgConn().PID())
	if !reflect.DeepEqual(initial, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("paired two-slot read changed fixture")
	}
	first, candidate := f.paid(t, 0)
	second, _ := f.paid(t, 1)
	wantStart := second.AcceptedAt
	if first.InitialFinishAt.After(wantStart) {
		wantStart = first.InitialFinishAt
	}
	if first.InitialStartAt != first.AcceptedAt || second.InitialStartAt != wantStart {
		t.Fatal("paired initial schedules are not max(admission, pending finish)")
	}
	var exact bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT ARRAY[food,wood,iron,stone,gold]=ARRAY[0,0,0,0,0]::bigint[] FROM player_wallet WHERE server_id=1 AND player_id=1)
AND (SELECT count(*) FROM player_wallet)=1 AND (SELECT count(*) FROM work_queue)=3
AND (SELECT count(*) FROM mil_recruit_origin)=2 AND (SELECT count(*) FROM mil_recruit_receipt)=2
AND (SELECT array_agg(queue_id ORDER BY queue_id)=ARRAY[100,101]::bigint[] AND array_agg(status ORDER BY queue_id)=ARRAY[1,0]::smallint[] FROM work_queue WHERE queue_type=3)
AND (SELECT last_value=101 AND is_called FROM work_queue_id_seq)
AND (SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[11,12,13,14] AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[2147483647,2147483647,2147483647,2147483647] FROM city_troop)
AND EXISTS (SELECT FROM mil_city_origin WHERE server_id=1 AND city_id=1 AND owner_player_id=1 AND format_version=1 AND cohort_id=decode('03000000000000000000000000000000','hex'))`).Scan(&exact))
	if !exact {
		t.Fatal("paired paid wallet/stock/marker/allocator mismatch")
	}
	paid := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitCompleteReturnChanges(t, initial, paid, map[string]bool{"player_wallet": true, "work_queue": true, "mil_recruit_origin": true, "mil_recruit_receipt": true, "work_queue_id_seq": true})
	for {
		var due bool
		returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()>=$1", first.InitialFinishAt).Scan(&due))
		if due {
			break
		}
		select {
		case <-time.After(25 * time.Millisecond):
		case <-f.ctx.Done():
			t.Fatal("paired real paid schedule did not become due", f.ctx.Err())
		}
	}
	stable := recruitPromotionStable(t, f.ctx, f.observer)
	at, finish := f.complete(t, true, candidate, paid)
	completed := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitCompleteReturnChanges(t, paid, completed, map[string]bool{"city_troop": true, "work_queue": true})
	if stable != recruitPromotionStable(t, f.ctx, f.observer) || finish != at.Add(time.Duration(second.DurationSeconds)*time.Second) {
		t.Fatal("paired completion changed retained fields or stored promotion duration")
	}
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT array_agg(status ORDER BY queue_id)=ARRAY[2,1]::smallint[] FROM work_queue WHERE queue_type=3)
AND EXISTS (SELECT FROM work_queue WHERE server_id=1 AND queue_id=101 AND start_at=$1 AND finish_at=$2)
AND (SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[13,12,13,14] FROM city_troop)
AND (SELECT count::bigint+(SELECT sum((payload->>'count')::bigint) FROM work_queue WHERE queue_type=3 AND status IN(0,1))=15 FROM city_troop WHERE unit_cfg_id=1)`, at, finish).Scan(&exact))
	if !exact {
		t.Fatal("paired actual completion credit/terminal/promotion/capacity mismatch")
	}
	returnStable := snapshotReturnAttemptPG(t, f.returnAttemptPG, true)
	f.complete(t, false, candidate, completed)
	returned := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitCompleteReturnChanges(t, completed, returned, map[string]bool{"city_troop": true, "march_order": true, "field_army": true})
	if !reflect.DeepEqual(returnStable, snapshotReturnAttemptPG(t, f.returnAttemptPG, true)) {
		t.Fatal("paired Return changed retained graph, wounded, paid ledger or allocators")
	}
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[20,20,19,23] AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[2147483647,2147483647,2147483647,2147483647] FROM city_troop)
AND (SELECT count(*)=1 AND bool_and(status=4) FROM march_order)
AND (SELECT count(*)=1 AND bool_and(status=1 AND x=0 AND y=0) FROM field_army)
AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] AND array_agg(count ORDER BY unit_cfg_id)=ARRAY[7,8,6,9] FROM army_troop)
AND (SELECT count::bigint+(SELECT sum((payload->>'count')::bigint) FROM work_queue WHERE queue_type=3 AND status IN(0,1))=22 FROM city_troop WHERE unit_cfg_id=1)`).Scan(&exact))
	if !exact {
		t.Fatal("paired Return credit/terminal/retained survivors or R+P mismatch")
	}
	returnAttemptClean(t, f.returnAttemptPG)
	f.recruit.s.mu.Lock()
	closed, attempts := f.recruit.s.closed, len(f.recruit.s.attempts)
	f.recruit.s.mu.Unlock()
	if closed || attempts != 0 {
		t.Fatal("paired Recruit generation retired or retained attempts")
	}
	returnPGOK(t, f.recruit.close())
	returnPGOK(t, f.generation.close())
	returnPGOK(t, f.recruit.s.admission.waitDrained(f.ctx))
	returnPGOK(t, f.generation.s.admission.waitDrained(f.ctx))
	returnPGReleased(t, f.ctx, f.observer, f.profile)
	recruitReturnPoolReusable(t, f.ctx, f.pool, f.observer.PgConn().PID())
	if f.pool.Stat().AcquiredConns() != 0 || !reflect.DeepEqual(returned, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("paired cleanup/reuse retained a slot or changed durable state")
	}
}
