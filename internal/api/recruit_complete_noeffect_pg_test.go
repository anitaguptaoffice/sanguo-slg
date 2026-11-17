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

func TestPGRecruitCompletionEarlyAndWaiting(t *testing.T) {
	trace := new(recruitNoeffectTrace)
	observer, binding, profile := recruitPGFixture(t, &trace.returnPGTrace, func(c *pgxpool.Config) { c.ConnConfig.Tracer = trace })
	ctx := returnPGContext(t)
	returnPGExec(t, ctx, observer, "UPDATE player_wallet SET food=10,wood=15,iron=25,stone=35,gold=0; SELECT setval('work_queue_id_seq',100,false)")
	g, err := newRecruitGeneration(binding, profile, recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	t.Cleanup(func() { returnPGOK(t, g.close()) })
	initial := returnPGSnapshot(t, ctx, observer, profile)
	var accepted [2]march.RecruitAcceptance
	var candidates [2]march.RecruitCandidate
	for i, unit := range []int32{4, 1} {
		scope := march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{byte(9 + i)}}
		var earliest time.Time
		returnPGOK(t, observer.QueryRow(ctx, "SELECT clock_timestamp()").Scan(&earliest))
		start := len(trace.events())
		r := g.admit(ctx, 1, scope, march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: unit, Count: 1})
		recruitAttemptPGConfirmed(t, r)
		if i == 0 {
			recruitAttemptPGRecorded(t, trace.events()[start:], observer, profile, false)
		} else {
			returnPGOK(t, recruitNoeffectRecorded(trace.events()[start:], observer.PgConn().PID(), profile, true))
		}
		accepted[i], candidates[i] = r.confirmed, recruitNoeffectReceipt(t, ctx, observer, i, earliest, r.confirmed)
	}
	waitingStart := accepted[0].InitialFinishAt
	if accepted[1].AcceptedAt.After(waitingStart) {
		waitingStart = accepted[1].AcceptedAt
	}
	if accepted[1].InitialStartAt != waitingStart {
		t.Fatal("paid waiter did not retain max(admission time, pending finish)")
	}
	var exact bool
	returnPGOK(t, observer.QueryRow(ctx, `SELECT
(SELECT count(*) FROM work_queue)=3 AND (SELECT count(*) FROM work_queue WHERE queue_type=3)=2
AND (SELECT count(*) FROM mil_recruit_origin)=2 AND (SELECT count(*) FROM mil_recruit_receipt)=2
AND (SELECT count(*) FROM player_wallet)=1
AND (SELECT ARRAY[food,wood,iron,stone,gold]=ARRAY[0,0,0,0,0]::bigint[] FROM player_wallet WHERE server_id=1 AND player_id=1)
AND (SELECT last_value=101 AND is_called FROM work_queue_id_seq)
AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id)=ARRAY[1,2,3,4]
AND array_agg(count ORDER BY unit_cfg_id)=ARRAY[11,12,13,14]
AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] FROM city_troop WHERE server_id=1 AND city_id=1)
AND EXISTS (SELECT FROM mil_city_origin WHERE server_id=1 AND city_id=1 AND owner_player_id=1
AND cohort_id=decode('03000000000000000000000000000000','hex') AND format_version=1)`).Scan(&exact))
	if !exact {
		t.Fatal("paid wallet, stock, marker, ledger or allocator mismatch")
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
	for i, disposition := range []march.RecruitCompletion{march.RecruitEarly, march.RecruitWaiting} {
		start := len(trace.events())
		call := startRecruitNoeffect(t, g, trace, candidates[i])
		pid := returnLifetimeReached(t, call.clock)
		var observed time.Time
		returnPGOK(t, observer.QueryRow(ctx, "SELECT clock_timestamp()").Scan(&observed))
		if pid == 0 || pid == observer.PgConn().PID() {
			t.Fatal("actual sampled-clock gate used observer or invalid backend")
		}
		if i == 0 && !observed.UTC().Before(accepted[0].InitialFinishAt) {
			// Cleanup cancels before releasing this post-sample/pre-write gate.
			t.Fatal("missed real PostgreSQL early boundary", observed, accepted[0].InitialFinishAt)
		}
		call.clock.release() // Production keeps its already-scanned canonical T.
		if returnLifetimeReached(t, call.commit) != pid || !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
			t.Fatal("no-effect call changed state/backend before actual Commit")
		}
		select {
		case <-call.done:
			t.Fatal("no-effect business result returned before actual Commit")
		default:
		}
		call.commit.release()
		if !returnBackendJoin(call.done, 8*time.Second) {
			t.Fatal("no-effect caller did not join")
		}
		if call.fault != nil {
			t.Fatal("actual no-effect call panicked", call.fault)
		}
		recruitAttemptPGConfirmed(t, call.result)
		if call.result.completion != disposition || call.result.confirmed != (march.RecruitAcceptance{}) {
			t.Fatal("wrong no-effect disposition or manufactured acceptance", call.result)
		}
		returnPGOK(t, recruitNoeffectRecorded(trace.events()[start:], observer.PgConn().PID(), profile, false))
		if !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
			t.Fatal("no-effect call changed rows, physical identities or allocator state")
		}
		g.s.mu.Lock()
		closed, attempts := g.s.closed, len(g.s.attempts)
		g.s.mu.Unlock()
		if closed || attempts != 0 {
			t.Fatal("normal no-effect call retired generation or retained diagnostics")
		}
		recruitPGReleased(t, ctx, observer, profile)
	}
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(ctx))
}

func recruitNoeffectReceipt(t *testing.T, ctx context.Context, observer *pgx.Conn, index int, earliest time.Time, accepted march.RecruitAcceptance) march.RecruitCandidate {
	t.Helper()
	var c march.RecruitCandidate
	var got march.RecruitAcceptance
	var digest []byte
	var version int16
	returnPGOK(t, observer.QueryRow(ctx, `SELECT q.server_id,q.player_id,q.city_id,q.queue_id,r.intent_version,
r.queue_id,r.city_id,r.unit_cfg_id,r.count,r.food_paid,r.wood_paid,r.iron_paid,r.stone_paid,r.duration_sec,
convert_from(r.catalog_version,'UTF8'),r.rule_digest,r.accepted_at,r.initial_status,r.initial_start_at,r.initial_finish_at
FROM work_queue q JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=$1`, 100+index).Scan(
		&c.ServerID, &c.PlayerID, &c.CityID, &c.QueueID, &version, &got.QueueID, &got.CityID, &got.UnitCfgID, &got.Count,
		&got.Cost.Food, &got.Cost.Wood, &got.Cost.Iron, &got.Cost.Stone, &got.DurationSeconds, &got.CatalogVersion,
		&digest, &got.AcceptedAt, &got.InitialStatus, &got.InitialStartAt, &got.InitialFinishAt))
	copy(got.RuleDigest[:], digest)
	got.AcceptedAt, got.InitialStartAt, got.InitialFinishAt = got.AcceptedAt.UTC(), got.InitialStartAt.UTC(), got.InitialFinishAt.UTC()
	u := int64([]int32{4, 1}[index])
	wantDigest := []string{"19b24161229a77d82b48fcb26fdb199763d1faadd9a52c3fe0cf8d15ebabf5d8", "8306893080ef1340b9cf6f693256cc3f85c2166189e3db07027ec43943163ab0"}[index]
	if c != (march.RecruitCandidate{ServerID: 1, PlayerID: 1, CityID: 1, QueueID: int64(100 + index)}) || got != accepted || version != 1 ||
		got.QueueID != c.QueueID || got.CityID != c.CityID || got.UnitCfgID != int32(u) || got.Count != 1 ||
		got.Cost != (march.Resources{Food: 2 * u, Wood: 3 * u, Iron: 5 * u, Stone: 7 * u}) || got.DurationSeconds != 11*u ||
		got.CatalogVersion != recruitAttemptPGVersion || len(digest) != 32 || fmt.Sprintf("%x", digest) != wantDigest ||
		got.InitialStatus != int16(1-index) || got.AcceptedAt.Before(earliest.UTC().Truncate(time.Millisecond)) || got.AcceptedAt.Nanosecond()%1000000 != 0 ||
		got.InitialStartAt.Before(got.AcceptedAt) || index == 0 && got.InitialStartAt != got.AcceptedAt || got.InitialFinishAt != got.InitialStartAt.Add(time.Duration(11*u)*time.Second) {
		t.Fatal("independent paid candidate/immutable acceptance mismatch", c, got, accepted)
	}
	var exact bool
	returnPGOK(t, observer.QueryRow(ctx, `SELECT EXISTS (SELECT FROM work_queue q JOIN mil_recruit_origin o USING(server_id,queue_id)
JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=$1 AND q.player_id=1 AND q.city_id=1 AND q.queue_type=3
AND q.status=r.initial_status AND q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at AND r.accepted_at<=clock_timestamp()
AND o.player_id=1 AND o.operation=1 AND o.command_id=$2
AND q.payload=jsonb_build_object('v',1,'unit_cfg_id',r.unit_cfg_id,'count',r.count,'cost_paid',
jsonb_build_object('food',r.food_paid,'wood',r.wood_paid,'iron',r.iron_paid,'stone',r.stone_paid),
'duration_sec',r.duration_sec,'catalog_version',convert_from(r.catalog_version,'UTF8'),'rule_digest',encode(r.rule_digest,'hex')))`,
		c.QueueID, []byte{byte(9 + index), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}).Scan(&exact))
	if !exact {
		t.Fatal("paid origin/payload/queue history mismatch")
	}
	return c
}
