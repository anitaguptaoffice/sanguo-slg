package api

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGRecruitCompletionPaidDue(t *testing.T) {
	trace := returnLifetimeTracer("unarmed")
	observer, binding, profile := recruitPGFixture(t, &trace.returnPGTrace, func(c *pgxpool.Config) {
		c.ConnConfig.Tracer = trace
	})
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)
	// Setup before admission only: exact positive paid resources, zero gold and
	// one remaining representable unit. No paid queue or receipt is fabricated.
	returnPGExec(t, ctx, observer, `UPDATE player_wallet SET food=2,wood=3,iron=5,stone=7,gold=0;
UPDATE city_troop SET count=2147483646 WHERE unit_cfg_id=1;
SELECT setval('work_queue_id_seq',100,false)`)
	g, err := newRecruitGeneration(binding, profile, recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	t.Cleanup(func() { returnPGOK(t, g.close()) })
	scope := march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{9}}
	intent := march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 1, Count: 1}
	initial := returnPGSnapshot(t, ctx, observer, profile)
	var earliest time.Time
	returnPGOK(t, observer.QueryRow(ctx, "SELECT clock_timestamp()").Scan(&earliest))
	start := len(trace.events())
	admitted := g.admit(ctx, 1, scope, intent)
	recruitAttemptPGConfirmed(t, admitted)
	recruitAttemptPGRecorded(t, trace.events()[start:], observer, profile, false)
	var accepted march.RecruitAcceptance
	var candidate march.RecruitCandidate
	var digest []byte
	returnPGOK(t, observer.QueryRow(ctx, `SELECT q.server_id,q.player_id,q.city_id,q.queue_id,
r.queue_id,r.city_id,r.unit_cfg_id,r.count,r.food_paid,r.wood_paid,r.iron_paid,r.stone_paid,
r.duration_sec,convert_from(r.catalog_version,'UTF8'),r.rule_digest,r.accepted_at,r.initial_status,r.initial_start_at,r.initial_finish_at
FROM work_queue q JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=100`).Scan(
		&candidate.ServerID, &candidate.PlayerID, &candidate.CityID, &candidate.QueueID,
		&accepted.QueueID, &accepted.CityID, &accepted.UnitCfgID, &accepted.Count,
		&accepted.Cost.Food, &accepted.Cost.Wood, &accepted.Cost.Iron, &accepted.Cost.Stone,
		&accepted.DurationSeconds, &accepted.CatalogVersion, &digest, &accepted.AcceptedAt, &accepted.InitialStatus, &accepted.InitialStartAt, &accepted.InitialFinishAt))
	copy(accepted.RuleDigest[:], digest)
	accepted.AcceptedAt, accepted.InitialStartAt, accepted.InitialFinishAt = accepted.AcceptedAt.UTC(), accepted.InitialStartAt.UTC(), accepted.InitialFinishAt.UTC()
	if candidate != (march.RecruitCandidate{ServerID: 1, PlayerID: 1, CityID: 1, QueueID: 100}) || admitted.confirmed != accepted ||
		accepted.QueueID != 100 || accepted.CityID != 1 || accepted.UnitCfgID != 1 || accepted.Count != 1 ||
		accepted.Cost != (march.Resources{Food: 2, Wood: 3, Iron: 5, Stone: 7}) || accepted.DurationSeconds != 11 ||
		accepted.CatalogVersion != recruitAttemptPGVersion || len(digest) != 32 || fmt.Sprintf("%x", digest) != "8306893080ef1340b9cf6f693256cc3f85c2166189e3db07027ec43943163ab0" ||
		accepted.InitialStatus != 1 || accepted.AcceptedAt.Before(earliest.UTC().Truncate(time.Millisecond)) || accepted.AcceptedAt.Nanosecond()%1000000 != 0 ||
		accepted.InitialStartAt != accepted.AcceptedAt || accepted.InitialFinishAt != accepted.InitialStartAt.Add(11*time.Second) {
		t.Fatal("independent paid acceptance/candidate mismatch", candidate, accepted, admitted)
	}
	var exact bool
	returnPGOK(t, observer.QueryRow(ctx, `SELECT
(SELECT ARRAY[food,wood,iron,stone,gold]=ARRAY[0,0,0,0,0]::bigint[] FROM player_wallet WHERE server_id=1 AND player_id=1)
AND (SELECT count(*) FROM work_queue)=2 AND (SELECT count(*) FROM work_queue WHERE queue_type=3)=1
AND (SELECT count(*) FROM mil_recruit_origin)=1 AND (SELECT count(*) FROM mil_recruit_receipt)=1
AND (SELECT last_value=100 AND is_called FROM work_queue_id_seq)
AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id)=ARRAY[1,2,3,4]
AND array_agg(count ORDER BY unit_cfg_id)=ARRAY[2147483646,12,13,14]
AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] FROM city_troop WHERE server_id=1 AND city_id=1)
AND EXISTS (SELECT FROM work_queue q JOIN mil_recruit_origin o USING(server_id,queue_id)
JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=100
AND q.player_id=1 AND q.city_id=1 AND q.queue_type=3 AND q.status=1
AND o.player_id=1 AND o.operation=1 AND o.command_id=decode('09000000000000000000000000000000','hex')
AND q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at AND r.accepted_at<=clock_timestamp()
AND q.payload=jsonb_build_object('v',1,'unit_cfg_id',1,'count',1,'cost_paid',
jsonb_build_object('food',2,'wood',3,'iron',5,'stone',7),'duration_sec',11,'catalog_version',$1::text,'rule_digest',$2::text))
AND EXISTS (SELECT FROM mil_city_origin WHERE server_id=1 AND city_id=1 AND owner_player_id=1
AND cohort_id=decode('03000000000000000000000000000000','hex') AND format_version=1)`,
		recruitAttemptPGVersion, fmt.Sprintf("%x", digest)).Scan(&exact))
	if !exact {
		t.Fatal("paid wallet/origin/payload/marker/allocator mismatch")
	}
	before := returnPGSnapshot(t, ctx, observer, profile)
	changed := map[string]bool{"player_wallet": true, "work_queue": true, "mil_recruit_origin": true, "mil_recruit_receipt": true, "work_queue_id_seq": true}
	for name, old := range initial {
		if (old != before[name]) != changed[name] {
			t.Fatal("unexpected admission change", name)
		}
	}
	stable := recruitCompleteStable(t, ctx, observer)
	// Wait on actual PG time, bounded by ctx; never rewrite the paid schedule.
	for {
		var due bool
		returnPGOK(t, observer.QueryRow(ctx, "SELECT clock_timestamp()>=$1", accepted.InitialFinishAt).Scan(&due))
		if due {
			break
		}
		select {
		case <-time.After(25 * time.Millisecond):
		case <-ctx.Done():
			t.Fatal("real paid schedule did not become due", ctx.Err())
		}
	}
	trace.target = "commit" // All setup/admission calls have joined before arming.
	start = len(trace.events())
	done := make(chan struct{})
	var completed recruitAttemptResult
	var fault any
	t.Cleanup(func() {
		cancel()
		trace.release()
		if !returnBackendJoin(done, 8*time.Second) {
			t.Error("completion caller did not join before fixture cleanup")
		}
	})
	go func() {
		defer close(done)
		defer func() { fault = recover() }()
		completed = g.complete(ctx, candidate)
	}()
	pid := returnLifetimeReached(t, trace)
	if pid == 0 || pid == observer.PgConn().PID() || !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("completion escaped its independent uncommitted boundary")
	}
	select {
	case <-done:
		t.Fatal("business result returned before actual Commit")
	default:
	}
	trace.release()
	if !returnBackendJoin(done, 8*time.Second) {
		t.Fatal("actual completion did not join")
	}
	if fault != nil {
		t.Fatal("actual completion panicked", fault)
	}
	recruitAttemptPGConfirmed(t, completed)
	if completed.completion != march.RecruitCompleted || completed.confirmed != (march.RecruitAcceptance{}) {
		t.Fatal("completion disposition or admission-result contamination", completed)
	}
	returnPGOK(t, recruitCompleteRecorded(trace.events()[start:], observer.PgConn().PID(), profile))
	after := returnPGSnapshot(t, ctx, observer, profile)
	if len(initial) != len(before) || len(before) != len(after) || stable != recruitCompleteStable(t, ctx, observer) {
		t.Fatal("completion changed non-target fields, identities or inventory")
	}
	for name, old := range before {
		if (old != after[name]) != (name == "city_troop" || name == "work_queue") {
			t.Fatal("completion changed wrong relation, wallet, receipt or allocator", name)
		}
	}
	returnPGOK(t, observer.QueryRow(ctx, `SELECT
(SELECT status=2 FROM work_queue WHERE server_id=1 AND queue_id=100)
AND NOT EXISTS (SELECT FROM work_queue WHERE queue_type=3 AND status IN (0,1))
AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id)=ARRAY[1,2,3,4]
AND array_agg(count ORDER BY unit_cfg_id)=ARRAY[2147483647,12,13,14]
AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] FROM city_troop WHERE server_id=1 AND city_id=1)`).Scan(&exact))
	if !exact {
		t.Fatal("terminal/ready/wounded mismatch; ready+pending was not conserved")
	}
	g.s.mu.Lock()
	closed, attempts := g.s.closed, len(g.s.attempts)
	g.s.mu.Unlock()
	if closed || attempts != 0 {
		t.Fatal("successful completion retained diagnostics or closed generation")
	}
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(ctx))
	recruitPGReleased(t, ctx, observer, profile)
}
