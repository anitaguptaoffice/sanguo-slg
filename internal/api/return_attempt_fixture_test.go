package api

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var returnAttemptDue = time.Date(2026, 1, 2, 3, 5, 5, 123456000, time.UTC)

type returnAttemptPG struct {
	ctx        context.Context
	pool       *pgxpool.Pool
	observer   *pgx.Conn
	binding    *recruittx.Binding
	profile    freshsource.Profile
	catalog    *march.RecruitCatalog
	generation *returnGeneration
	candidate  march.ReturnCandidate
	due        time.Time
}

// All SQL here constructs owned test state. It is not production enrollment or
// evidence that the real creation/debit/arrival/Recruit writers are compatible.
func newReturnAttemptPG(t *testing.T, tracer pgx.QueryTracer, configure ...func(*pgxpool.Config)) *returnAttemptPG {
	t.Helper()
	pool, observer, binding, profile := returnPGFixture(t, tracer, configure...)
	f := &returnAttemptPG{ctx: returnPGContext(t), pool: pool, observer: observer,
		binding: binding, profile: profile, catalog: returnPGCatalog(t), due: returnAttemptDue}
	body, err := os.ReadFile("../../spec/db/005_hero.sql")
	returnPGOK(t, err)
	returnPGExec(t, f.ctx, observer, string(body))
	f.candidate = returnAttemptSeed(t, f.ctx, observer, 1)
	f.generation, err = newReturnGeneration(binding, profile, f.catalog)
	returnPGOK(t, err)
	returnPGOK(t, f.generation.initialize(f.ctx))
	t.Cleanup(func() { returnPGOK(t, f.generation.close()) })
	return f
}

// IDs above one get separate actor, wallet and WORLD rows, so later concurrency
// evidence can admit independent attempts without an earlier wallet barrier.
func returnAttemptSeed(t *testing.T, ctx context.Context, observer *pgx.Conn, id int64) march.ReturnCandidate {
	t.Helper()
	if id < 1 || id > 100 {
		t.Fatal("fixture identity outside bounded test range")
	}
	if id > 1 {
		returnPGExec(t, ctx, observer, fmt.Sprintf(`
INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(%[1]d,'fixture%[1]d','not-a-credential');
INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,%[1]d,%[1]d,'fixture');
INSERT INTO player_wallet(server_id,player_id,food,wood,iron,stone,gold) VALUES(1,%[1]d,100,200,300,400,500);
INSERT INTO map_cell(server_id,x,y,terrain) VALUES(1,%[2]d,0,1);
INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,%[1]d,%[1]d,'fixture',%[2]d,0);
INSERT INTO mil_city_origin SELECT 1,%[1]d,%[1]d,cohort_id,format_version,created_at FROM mil_city_origin WHERE city_id=1;
INSERT INTO city_troop SELECT 1,%[1]d,u,10+u,u FROM generate_series(1,4) u;
INSERT INTO field_army(server_id,army_id,owner_player_id,x,y) VALUES(1,%[1]d,%[1]d,%[2]d,0);
INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at) VALUES(1,%[1]d,%[1]d,%[2]d,0,%[3]d,1,1,'2026-01-01','2026-01-02')`, id, (id-1)*2, (id-1)*2+1))
	}
	returnPGExec(t, ctx, observer, fmt.Sprintf(`
UPDATE march_order SET origin_city_id=%[1]d,status=3,depart_at='2026-01-02 03:03:05.123456+00',arrive_at='2026-01-02 03:04:05.123456+00',return_finish_at='2026-01-02 03:05:05.123456+00' WHERE march_id=%[1]d;
UPDATE field_army SET status=2,x=%[2]d,y=1,hero_ids=ARRAY[%[1]d]::bigint[] WHERE army_id=%[1]d;
DELETE FROM army_troop WHERE army_id=%[1]d;
INSERT INTO army_troop VALUES(1,%[1]d,1,7),(1,%[1]d,2,8),(1,%[1]d,3,6),(1,%[1]d,4,9);
UPDATE city_troop SET wounded=2147483647 WHERE city_id=%[1]d;
INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,%[1]d,%[1]d,1,3);
INSERT INTO hero_assignment(server_id,hero_id,assign_type,target_id) VALUES(1,%[1]d,2,%[1]d)`, id, (id-1)*2+1))
	return march.ReturnCandidate{ServerID: 1, PlayerID: id, CityID: id, MarchID: id, ArmyID: id}
}

func snapshotReturnAttemptPG(t *testing.T, f *returnAttemptPG, stable bool) map[string]string {
	t.Helper()
	out := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
	if stable {
		for name, omit := range map[string]string{
			"city_troop": "ARRAY['count']", "march_order": "ARRAY['status']", "field_army": "ARRAY['status','x','y']",
		} {
			var value string
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT jsonb_agg(v ORDER BY v)::text FROM (SELECT to_jsonb(t)-"+omit+" v FROM "+pgx.Identifier{f.profile.SchemaName, name}.Sanitize()+" t) q").Scan(&value))
			out[name] = value
		}
	}
	return out // Base helper snapshots every sequence's last_value/log_cnt/is_called explicitly.
}

// Synthetic immutable evidence, deliberately not RecruitParticipant admission.
// Two valid FIFO rows reserve four unit1 troops without allocating a sequence.
func returnAttemptPending(t *testing.T, f *returnAttemptPG) {
	t.Helper()
	e, err := f.catalog.Current(1)
	returnPGOK(t, err)
	plan, err := e.Plan(march.RecruitRequest{UnitCfgID: 1, Count: 2})
	returnPGOK(t, err)
	digest, cost := e.Digest(), plan.Cost()
	for i := 0; i < 2; i++ {
		start := time.Date(2030, 1, 1, 0, 0, 2*i, 123000000, time.UTC)
		finish := start.Add(time.Duration(plan.DurationSeconds()) * time.Second)
		id, status := 40+i, 1-i
		_, err = f.observer.Exec(f.ctx, `INSERT INTO mil_recruit_origin VALUES(1,$1,1,1,$2)`, id, []byte{byte(id), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})
		returnPGOK(t, err)
		_, err = f.observer.Exec(f.ctx, `INSERT INTO mil_recruit_receipt VALUES(1,$1,1,1,1,2,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11)`,
			id, cost.Food, cost.Wood, cost.Iron, cost.Stone, plan.DurationSeconds(), []byte(e.Version()), digest[:], start, finish, status)
		returnPGOK(t, err)
		payload := fmt.Sprintf(`{"v":1,"unit_cfg_id":1,"count":2,"cost_paid":{"food":%d,"wood":%d,"iron":%d,"stone":%d},"duration_sec":%d,"catalog_version":%q,"rule_digest":"%x"}`,
			cost.Food, cost.Wood, cost.Iron, cost.Stone, plan.DurationSeconds(), e.Version(), digest)
		_, err = f.observer.Exec(f.ctx, `INSERT INTO work_queue VALUES(1,$1,1,1,3,$2,$3,$4,$5)`, id, payload, start, finish, status)
		returnPGOK(t, err)
	}
}
