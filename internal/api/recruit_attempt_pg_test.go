package api

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
)

func TestPGRecruitAttemptAdmissionAndReplay(t *testing.T) {
	trace := new(returnPGTrace)
	observer, binding, profile := recruitPGFixture(t, trace)
	ctx := returnPGContext(t)
	// Keep the bootstrap's unrelated queue 1 and reserve a distinct safe ID.
	returnPGExec(t, ctx, observer, "SELECT setval('work_queue_id_seq',100,false)")
	g, err := newRecruitGeneration(binding, profile, recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	scope := march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{9}}
	intent := march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 3, Count: 2}
	before := returnPGSnapshot(t, ctx, observer, profile)
	var legacy, stillLegacy string
	legacySQL := "SELECT jsonb_build_array(q,q.xmin::text,q.ctid::text)::text FROM work_queue q WHERE server_id=1 AND queue_id=1"
	returnPGOK(t, observer.QueryRow(ctx, legacySQL).Scan(&legacy))
	var earliest time.Time
	returnPGOK(t, observer.QueryRow(ctx, "SELECT clock_timestamp()").Scan(&earliest))
	start := len(trace.events())
	result := g.admit(ctx, 1, scope, intent)
	recruitAttemptPGConfirmed(t, result) // Confirmation precedes every durable observation.
	recruitAttemptPGRecorded(t, trace.events()[start:], observer, profile, false)
	accepted := recruitAttemptPGObserved(t, ctx, observer)
	if result.confirmed != accepted || accepted.AcceptedAt.Before(earliest.UTC().Truncate(time.Millisecond)) {
		t.Fatalf("confirmed acceptance differs from independent receipt: %+v / %+v", result.confirmed, accepted)
	}
	after := returnPGSnapshot(t, ctx, observer, profile)
	returnPGOK(t, observer.QueryRow(ctx, legacySQL).Scan(&stillLegacy))
	if legacy != stillLegacy {
		t.Fatal("admission changed the unrelated bootstrap job")
	}
	changed := map[string]bool{"player_wallet": true, "work_queue": true, "mil_recruit_origin": true, "mil_recruit_receipt": true, "work_queue_id_seq": true}
	if len(before) != len(after) {
		t.Fatal("admission changed the relation inventory")
	}
	for name, old := range before {
		if (old != after[name]) != changed[name] {
			t.Fatalf("unexpected durable change for %s", name)
		}
	}
	// Independent fixture interventions, never a supported owner-transfer writer.
	for _, replay := range []struct{ name, change string }{
		{"same command", ""},
		{"changed current owner", "UPDATE player_city SET player_id=2 WHERE server_id=1 AND city_id=1"},
		{"missing current readiness", "UPDATE player_city SET player_id=1 WHERE server_id=1 AND city_id=1; DELETE FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=4"},
	} {
		t.Run(replay.name, func(t *testing.T) {
			if replay.change != "" {
				returnPGExec(t, ctx, observer, replay.change)
			}
			before := returnPGSnapshot(t, ctx, observer, profile)
			start := len(trace.events())
			alias := *g
			r := alias.admit(ctx, 1, scope, intent)
			recruitAttemptPGConfirmed(t, r)
			if r.confirmed != accepted {
				t.Fatalf("replay changed immutable acceptance: %+v / %+v", r.confirmed, accepted)
			}
			recruitAttemptPGRecorded(t, trace.events()[start:], observer, profile, true)
			if !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
				t.Fatal("replay changed a row, row identity or allocator state")
			}
			recruitPGReleased(t, ctx, observer, profile)
		})
	}
	g.s.mu.Lock()
	closed, attempts := g.s.closed, len(g.s.attempts)
	g.s.mu.Unlock()
	if closed || attempts != 0 {
		t.Fatal("resolved attempts retained diagnostics or closed generation", closed, attempts)
	}
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(ctx))
	recruitPGReleased(t, ctx, observer, profile)
}

func recruitAttemptPGConfirmed(t *testing.T, r recruitAttemptResult) {
	t.Helper()
	if r.outcome != recruitConfirmed || r.cause != nil || r.cleanup != nil || r.diagnostic != nil {
		t.Fatalf("attempt not cleanly confirmed: %+v", r)
	}
}

// Read all acceptance fields from the independent connection, not from handles.
func recruitAttemptPGObserved(t *testing.T, ctx context.Context, observer *pgx.Conn) march.RecruitAcceptance {
	t.Helper()
	var got march.RecruitAcceptance
	var digest []byte
	returnPGOK(t, observer.QueryRow(ctx, `SELECT queue_id,city_id,unit_cfg_id,count,food_paid,wood_paid,iron_paid,stone_paid,
duration_sec,convert_from(catalog_version,'UTF8'),rule_digest,accepted_at,initial_status,initial_start_at,initial_finish_at
FROM mil_recruit_receipt WHERE server_id=1 AND queue_id=100 AND intent_version=1`).Scan(
		&got.QueueID, &got.CityID, &got.UnitCfgID, &got.Count, &got.Cost.Food, &got.Cost.Wood, &got.Cost.Iron, &got.Cost.Stone,
		&got.DurationSeconds, &got.CatalogVersion, &digest, &got.AcceptedAt, &got.InitialStatus, &got.InitialStartAt, &got.InitialFinishAt))
	copy(got.RuleDigest[:], digest)
	got.AcceptedAt, got.InitialStartAt, got.InitialFinishAt = got.AcceptedAt.UTC(), got.InitialStartAt.UTC(), got.InitialFinishAt.UTC()
	if got.QueueID != 100 || got.CityID != 1 || got.UnitCfgID != 3 || got.Count != 2 ||
		got.Cost != (march.Resources{Food: 12, Wood: 18, Iron: 30, Stone: 42}) || got.DurationSeconds != 66 ||
		got.CatalogVersion != recruitAttemptPGVersion || len(digest) != 32 || fmt.Sprintf("%x", digest) != recruitAttemptPGDigest ||
		got.InitialStatus != 1 || got.AcceptedAt.IsZero() || got.AcceptedAt.Nanosecond()%1000000 != 0 ||
		got.AcceptedAt != got.InitialStartAt || got.InitialFinishAt != got.InitialStartAt.Add(66*time.Second) {
		t.Fatalf("unexpected receipt fields: %+v", got)
	}
	var wallet []int64
	returnPGOK(t, observer.QueryRow(ctx, "SELECT ARRAY[food,wood,iron,stone,gold] FROM player_wallet WHERE server_id=1 AND player_id=1").Scan(&wallet))
	if !reflect.DeepEqual(wallet, []int64{88, 182, 270, 358, 500}) {
		t.Fatal("debit fields or gold changed incorrectly", wallet)
	}
	var exact bool
	returnPGOK(t, observer.QueryRow(ctx, `SELECT
(SELECT count(*) FROM work_queue)=2 AND (SELECT count(*) FROM work_queue WHERE queue_type=3)=1
AND (SELECT count(*) FROM mil_recruit_origin)=1 AND (SELECT count(*) FROM mil_recruit_receipt)=1
AND (SELECT count(*) FROM player_wallet)=1 AND (SELECT last_value=100 AND is_called FROM work_queue_id_seq)
AND EXISTS (SELECT FROM work_queue q JOIN mil_recruit_origin o USING(server_id,queue_id)
JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=100
AND q.player_id=1 AND q.city_id=1 AND q.queue_type=3 AND q.status=1
AND o.player_id=1 AND o.operation=1 AND o.command_id=decode('09000000000000000000000000000000','hex')
AND q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at AND r.accepted_at<=clock_timestamp()
AND q.payload=jsonb_build_object('v',1,'unit_cfg_id',3,'count',2,'cost_paid',
jsonb_build_object('food',12,'wood',18,'iron',30,'stone',42),'duration_sec',66,'catalog_version',$1::text,'rule_digest',$2::text))`,
		recruitAttemptPGVersion, recruitAttemptPGDigest).Scan(&exact))
	if !exact {
		t.Fatal("independent job/origin/receipt/allocator observation mismatched")
	}
	return got
}
