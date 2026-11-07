package api

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGRecruitCompletionPromotesOldest(t *testing.T) {
	trace := new(recruitPromotionTrace)
	observer, binding, profile := recruitPGFixture(t, &trace.returnPGTrace, func(c *pgxpool.Config) { c.ConnConfig.Tracer = trace })
	trace.promotion = recruitPromotionQuery(profile) // Fixture calls have all joined.
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)
	returnPGExec(t, ctx, observer, `UPDATE player_wallet SET food=6,wood=9,iron=15,stone=21,gold=0;
UPDATE city_troop SET count=2147483644 WHERE unit_cfg_id=1; SELECT setval('work_queue_id_seq',100,false)`)
	g, err := newRecruitGeneration(binding, profile, recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	t.Cleanup(func() { returnPGOK(t, g.close()) })
	initial := returnPGSnapshot(t, ctx, observer, profile)
	var accepted [3]march.RecruitAcceptance
	var candidates [3]march.RecruitCandidate
	for i := range accepted {
		var earliest time.Time
		returnPGOK(t, observer.QueryRow(ctx, "SELECT clock_timestamp()").Scan(&earliest))
		scope := march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{byte(9 + i)}}
		start := len(trace.events())
		r := g.admit(ctx, 1, scope, march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 1, Count: 1})
		recruitAttemptPGConfirmed(t, r)
		if i == 0 {
			recruitAttemptPGRecorded(t, trace.events()[start:], observer, profile, false)
		} else {
			returnPGOK(t, recruitNoeffectRecorded(trace.events()[start:], observer.PgConn().PID(), profile, true))
		}
		accepted[i], candidates[i] = recruitPromotionReceipt(t, ctx, observer, i, earliest, r.confirmed)
		wantStart := accepted[i].AcceptedAt
		if i > 0 && accepted[i-1].InitialFinishAt.After(wantStart) {
			wantStart = accepted[i-1].InitialFinishAt
		}
		if accepted[i].InitialStartAt != wantStart {
			t.Fatal("paid initial estimate differs from max(admission, pending finish)", i)
		}
	}
	var exact bool
	returnPGOK(t, observer.QueryRow(ctx, `SELECT
(SELECT ARRAY[food,wood,iron,stone,gold]=ARRAY[0,0,0,0,0]::bigint[] FROM player_wallet WHERE server_id=1 AND player_id=1)
AND (SELECT count(*) FROM player_wallet)=1
AND (SELECT count(*) FROM work_queue)=4 AND (SELECT count(*) FROM mil_recruit_origin)=3 AND (SELECT count(*) FROM mil_recruit_receipt)=3
AND (SELECT array_agg(queue_id ORDER BY queue_id)=ARRAY[100,101,102]::bigint[] AND array_agg(status ORDER BY queue_id)=ARRAY[1,0,0] FROM work_queue WHERE queue_type=3)
AND (SELECT last_value=102 AND is_called FROM work_queue_id_seq)
AND (SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[2147483644,12,13,14] AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] FROM city_troop WHERE server_id=1 AND city_id=1)
AND EXISTS (SELECT FROM mil_city_origin WHERE server_id=1 AND city_id=1 AND owner_player_id=1 AND format_version=1 AND cohort_id=decode('03000000000000000000000000000000','hex'))`).Scan(&exact))
	if !exact {
		t.Fatal("three paid admissions lack exact wallet, pending, stock, marker or allocator provenance")
	}
	before := returnPGSnapshot(t, ctx, observer, profile)
	changed := map[string]bool{"player_wallet": true, "work_queue": true, "mil_recruit_origin": true, "mil_recruit_receipt": true, "work_queue_id_seq": true}
	if len(initial) != len(before) {
		t.Fatal("admissions changed relation inventory")
	}
	for name, old := range initial {
		if (old != before[name]) != changed[name] {
			t.Fatal("unexpected paid admission change", name)
		}
	}
	stable := recruitPromotionStable(t, ctx, observer)
	var lower, upper time.Time
	for {
		returnPGOK(t, observer.QueryRow(ctx, "SELECT clock_timestamp()").Scan(&lower))
		if !lower.UTC().Before(accepted[0].InitialFinishAt) {
			break
		}
		select {
		case <-time.After(25 * time.Millisecond):
		case <-ctx.Done():
			t.Fatal("real paid active did not become due", ctx.Err())
		}
	}
	start := len(trace.events())
	call := startRecruitNoeffect(t, g, &trace.recruitNoeffectTrace, candidates[0])
	pid := returnLifetimeReached(t, call.clock)
	returnPGOK(t, observer.QueryRow(ctx, "SELECT clock_timestamp()").Scan(&upper))
	call.clock.release() // Production keeps its own decoded PG sample, not upper.
	if pid == 0 || pid == observer.PgConn().PID() || returnLifetimeReached(t, call.commit) != pid || !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("promotion escaped its independent pre-Commit boundary")
	}
	select {
	case <-call.done:
		t.Fatal("promotion returned a result before actual Commit")
	default:
	}
	call.commit.release()
	if !returnBackendJoin(call.done, 8*time.Second) {
		t.Fatal("promotion caller did not join")
	}
	if call.fault != nil {
		t.Fatal("promotion caller panicked", call.fault)
	}
	recruitAttemptPGConfirmed(t, call.result)
	if call.result.completion != march.RecruitCompleted || call.result.confirmed != (march.RecruitAcceptance{}) {
		t.Fatal("promotion disposition or manufactured acceptance", call.result)
	}
	returnPGOK(t, recruitPromotionRecorded(trace.events()[start:], observer.PgConn().PID(), profile))
	processing, finish, ok := recruitPromotionTimes(trace.args, lower, upper)
	if !ok || finish != processing.Add(time.Duration(accepted[1].DurationSeconds)*time.Second) {
		t.Fatal("promotion arguments do not identify oldest waiter and bounded server processing time")
	}
	after := returnPGSnapshot(t, ctx, observer, profile)
	if len(before) != len(after) || stable != recruitPromotionStable(t, ctx, observer) {
		t.Fatal("promotion changed non-target values, younger MVCC/estimates or inventory")
	}
	for name, old := range before {
		if (old != after[name]) != (name == "city_troop" || name == "work_queue") {
			t.Fatal("promotion changed receipt, wallet, allocator or other relation", name)
		}
	}
	returnPGOK(t, observer.QueryRow(ctx, `SELECT
(SELECT array_agg(status ORDER BY queue_id)=ARRAY[2,1,0] FROM work_queue WHERE queue_type=3)
AND EXISTS (SELECT FROM work_queue WHERE server_id=1 AND queue_id=101 AND start_at=$1 AND finish_at=$2)
AND (SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[2147483645,12,13,14] AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] FROM city_troop WHERE server_id=1 AND city_id=1)
AND (SELECT count::bigint+(SELECT sum((payload->>'count')::bigint) FROM work_queue WHERE queue_type=3 AND status IN(0,1))=2147483647 FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1)`, processing, finish).Scan(&exact))
	if !exact {
		t.Fatal("credit/done/oldest promotion or R+P conservation mismatch")
	}
	g.s.mu.Lock()
	closed, attempts := g.s.closed, len(g.s.attempts)
	g.s.mu.Unlock()
	if closed || attempts != 0 {
		t.Fatal("successful promotion retired generation or retained diagnostics")
	}
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(ctx))
	recruitPGReleased(t, ctx, observer, profile)
}

func recruitPromotionReceipt(t *testing.T, ctx context.Context, observer *pgx.Conn, i int, earliest time.Time, confirmed march.RecruitAcceptance) (march.RecruitAcceptance, march.RecruitCandidate) {
	t.Helper()
	var a march.RecruitAcceptance
	var c march.RecruitCandidate
	var digest []byte
	var version int16
	returnPGOK(t, observer.QueryRow(ctx, `SELECT q.server_id,q.player_id,q.city_id,q.queue_id,r.intent_version,
r.queue_id,r.city_id,r.unit_cfg_id,r.count,r.food_paid,r.wood_paid,r.iron_paid,r.stone_paid,r.duration_sec,
convert_from(r.catalog_version,'UTF8'),r.rule_digest,r.accepted_at,r.initial_status,r.initial_start_at,r.initial_finish_at
FROM work_queue q JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=$1`, 100+i).Scan(
		&c.ServerID, &c.PlayerID, &c.CityID, &c.QueueID, &version, &a.QueueID, &a.CityID, &a.UnitCfgID, &a.Count,
		&a.Cost.Food, &a.Cost.Wood, &a.Cost.Iron, &a.Cost.Stone, &a.DurationSeconds, &a.CatalogVersion,
		&digest, &a.AcceptedAt, &a.InitialStatus, &a.InitialStartAt, &a.InitialFinishAt))
	copy(a.RuleDigest[:], digest)
	a.AcceptedAt, a.InitialStartAt, a.InitialFinishAt = a.AcceptedAt.UTC(), a.InitialStartAt.UTC(), a.InitialFinishAt.UTC()
	status := int16(0)
	if i == 0 {
		status = 1
	}
	if c != (march.RecruitCandidate{ServerID: 1, PlayerID: 1, CityID: 1, QueueID: int64(100 + i)}) || a != confirmed || version != 1 ||
		a.QueueID != c.QueueID || a.CityID != 1 || a.UnitCfgID != 1 || a.Count != 1 || a.Cost != (march.Resources{Food: 2, Wood: 3, Iron: 5, Stone: 7}) ||
		a.DurationSeconds != 11 || a.CatalogVersion != recruitAttemptPGVersion || len(digest) != 32 || fmt.Sprintf("%x", digest) != "8306893080ef1340b9cf6f693256cc3f85c2166189e3db07027ec43943163ab0" ||
		a.InitialStatus != status || a.AcceptedAt.Before(earliest.UTC().Truncate(time.Millisecond)) || a.AcceptedAt.Nanosecond()%1000000 != 0 ||
		a.InitialStartAt.Before(a.AcceptedAt) || a.InitialFinishAt != a.InitialStartAt.Add(11*time.Second) {
		t.Fatal("independent paid acceptance/candidate mismatch", i, a, c)
	}
	var exact bool
	returnPGOK(t, observer.QueryRow(ctx, `SELECT EXISTS (SELECT FROM work_queue q JOIN mil_recruit_origin o USING(server_id,queue_id)
JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=$1 AND q.player_id=1 AND q.city_id=1 AND q.queue_type=3
AND q.status=r.initial_status AND q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at AND r.accepted_at<=clock_timestamp()
AND o.player_id=1 AND o.operation=1 AND o.command_id=$2
AND q.payload=jsonb_build_object('v',1,'unit_cfg_id',1,'count',1,'cost_paid',jsonb_build_object('food',2,'wood',3,'iron',5,'stone',7),
'duration_sec',11,'catalog_version',convert_from(r.catalog_version,'UTF8'),'rule_digest',encode(r.rule_digest,'hex')))`,
		c.QueueID, []byte{byte(9 + i), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}).Scan(&exact))
	if !exact {
		t.Fatal("paid origin, queue payload or immutable schedule mismatch", i)
	}
	return a, c
}
