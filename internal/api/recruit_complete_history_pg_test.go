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

func TestPGRecruitCompletionHistoryAndReplay(t *testing.T) {
	trace := new(recruitNoeffectTrace)
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
	for _, step := range []struct {
		name, change string
		replay       bool
		want         march.RecruitCompletion
	}{
		{"complete", "", false, march.RecruitCompleted},
		{"done", "", false, march.RecruitAlreadyDone},
		{"admission replay", "", true, 0},
		{"owner done", "UPDATE player_city SET player_id=2 WHERE server_id=1 AND city_id=1", false, march.RecruitAlreadyDone},
		{"owner replay", "", true, 0},
		{"readiness done", "UPDATE player_city SET player_id=1 WHERE server_id=1 AND city_id=1; DELETE FROM mil_city_origin WHERE server_id=1 AND city_id=1; DELETE FROM city_troop WHERE server_id=1 AND city_id=1", false, march.RecruitAlreadyDone},
		{"readiness replay", "", true, 0},
	} {
		if !t.Run(step.name, func(t *testing.T) {
			// Explicit fixture interventions, not supported ownership/readiness writers.
			if step.change != "" {
				returnPGExec(t, ctx, observer, step.change)
			}
			returnPGOK(t, observer.QueryRow(ctx, "SELECT a.status=1 AND p.account_id=1 FROM account a JOIN player p ON p.account_id=a.account_id WHERE a.account_id=1 AND p.server_id=1 AND p.player_id=1").Scan(&exact))
			if !exact {
				t.Fatal("historical test lost its valid actor")
			}
			owner, readyRows := int64(1), int64(5)
			if step.name == "owner done" || step.name == "owner replay" {
				owner = 2
			}
			if step.name == "readiness done" || step.name == "readiness replay" {
				readyRows = 0
			}
			returnPGOK(t, observer.QueryRow(ctx, `SELECT
(SELECT player_id=$1 FROM player_city WHERE server_id=1 AND city_id=1)
AND (SELECT count(*) FROM mil_city_origin WHERE server_id=1 AND city_id=1)
+(SELECT count(*) FROM city_troop WHERE server_id=1 AND city_id=1)=$2`, owner, readyRows).Scan(&exact))
			if !exact {
				t.Fatal("historical fixture intervention was not observed")
			}
			before := returnPGSnapshot(t, ctx, observer, profile)
			stable := recruitCompleteStable(t, ctx, observer)
			start := len(trace.events())
			call := &recruitNoeffectCall{clock: returnLifetimeTracer(""), commit: returnLifetimeTracer(""), done: make(chan struct{})}
			call.clock.release() // Due was observed on PG; history has no clock operation.
			trace.guard.Lock()
			trace.call = call
			trace.guard.Unlock()
			callCtx, stop := context.WithTimeout(ctx, 30*time.Second)
			t.Cleanup(func() {
				stop()
				call.commit.release()
				if !returnBackendJoin(call.done, 8*time.Second) {
					t.Error("history caller did not join before fixture cleanup")
				}
			})
			go func() {
				defer close(call.done)
				defer func() { call.fault = recover() }()
				if step.replay {
					call.result = g.admit(callCtx, 1, scope, intent)
				} else {
					call.result = g.complete(callCtx, candidate)
				}
			}()
			pid := returnLifetimeReached(t, call.commit)
			if pid == 0 || pid == observer.PgConn().PID() || !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
				t.Fatal("history escaped the independent pre-Commit boundary")
			}
			select {
			case <-call.done:
				t.Fatal("history returned a business result before Commit")
			default:
			}
			call.commit.release()
			if !returnBackendJoin(call.done, 8*time.Second) {
				t.Fatal("history caller failed to join")
			}
			if call.fault != nil {
				t.Fatal("history caller panicked", call.fault)
			}
			recruitAttemptPGConfirmed(t, call.result)
			if call.result.completion != step.want || step.replay && call.result.confirmed != accepted || !step.replay && call.result.confirmed != (march.RecruitAcceptance{}) {
				t.Fatal("history changed disposition or immutable acceptance", call.result)
			}
			switch {
			case step.replay:
				recruitAttemptPGRecorded(t, trace.events()[start:], observer, profile, true)
			case step.want == march.RecruitCompleted:
				returnPGOK(t, recruitCompleteRecorded(trace.events()[start:], observer.PgConn().PID(), profile))
			default:
				returnPGOK(t, recruitHistoryRecorded(trace.events()[start:], observer.PgConn().PID(), profile))
			}
			after := returnPGSnapshot(t, ctx, observer, profile)
			if step.want == march.RecruitCompleted {
				if len(before) != len(after) || stable != recruitCompleteStable(t, ctx, observer) {
					t.Fatal("completion changed unrelated fields or relation inventory")
				}
				for name, old := range before {
					if (old != after[name]) != (name == "city_troop" || name == "work_queue") {
						t.Fatal("completion changed wrong relation or allocator", name)
					}
				}
				returnPGOK(t, observer.QueryRow(ctx, `SELECT
(SELECT status=2 FROM work_queue WHERE server_id=1 AND queue_id=100)
AND NOT EXISTS (SELECT FROM work_queue WHERE queue_type=3 AND status IN (0,1))
AND (SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[2147483647,12,13,14]
AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] FROM city_troop WHERE server_id=1 AND city_id=1)`).Scan(&exact))
				if !exact {
					t.Fatal("actual completion did not produce exact terminal credit")
				}
			} else if !reflect.DeepEqual(before, after) {
				t.Fatal("historical call changed rows, MVCC identities or allocator state")
			}
			g.s.mu.Lock()
			closed, attempts := g.s.closed, len(g.s.attempts)
			g.s.mu.Unlock()
			if closed || attempts != 0 {
				t.Fatal("normal historical call retired generation or retained diagnostics")
			}
			recruitPGReleased(t, ctx, observer, profile)
		}) {
			return
		}
	}
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(ctx))
}
