package march

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func prepareBase(t *testing.T, pool *pgxpool.Pool, p freshsource.Profile) {
	t.Helper()
	at := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Millisecond)
	_, err := pool.Exec(context.Background(), `INSERT INTO mil_city_origin VALUES(1,100,1,$1,1,$2)`, p.Cohort[:], at)
	baseOK(t, err)
	_, err = pool.Exec(context.Background(), `INSERT INTO city_troop VALUES(1,100,1,5,1),(1,100,2,0,0),(1,100,3,0,0),(1,100,4,0,0)`)
	baseOK(t, err)
}

func prepareSeedRow(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding, h historyRow) {
	t.Helper()
	exec := func(q string, args ...any) { _, err := a.Exec(ctx, b, q, args...); baseOK(t, err) }
	exec(`INSERT INTO mil_recruit_origin VALUES(1,$1,$2,1,$3)`, h.queueID, h.player, h.command[:])
	if !h.omitReceipt {
		exec(`INSERT INTO mil_recruit_receipt VALUES(1,$1,1,100,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, h.queueID, h.count, h.cost.Food, h.cost.Wood, h.cost.Iron, h.cost.Stone, h.duration, h.version, h.digest[:], h.accepted, h.rstart, h.rfinish, h.initial)
	}
	if !h.omitQueue {
		exec(`INSERT INTO work_queue VALUES(1,$1,$2,$3,3,$4,$5,$6,$7)`, h.queueID, h.player, h.qCity, string(h.payload), h.qstart, h.qfinish, h.status)
	}
}

const prepareSnap = `SELECT md5(pg_catalog.concat_ws('|',(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.city_id) FROM mil_city_origin t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.unit_cfg_id) FROM city_troop t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM work_queue t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM mil_recruit_origin t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM mil_recruit_receipt t)))`

func TestPGRecruitPrepare(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	prepareBase(t, pool, p)
	catalog, _, _ := recruitSourceCatalog(t)
	o, a, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	scope, intent := RecruitScope{1, 1, RecruitCommandID{9}}, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2}
	var before, after string
	baseOK(t, a.Scan(ctx, b, prepareSnap, nil, &before))
	adm, err := participant.Prepare(ctx, a, scope, intent)
	baseOK(t, err)
	if adm == nil || adm.state == nil || adm.state.queueID < 1 || adm.state.schedule.waiting || !validRecruitTime(adm.state.schedule.start) || !adm.state.acceptedAt.Equal(adm.state.schedule.start) || adm.state.schedule.finish.Sub(adm.state.schedule.start) != time.Minute {
		t.Fatalf("admission %#v", adm)
	}
	want := Resources{Food: 82, Wood: 40}
	cost, err := adm.Cost(ctx, a)
	baseOK(t, err)
	copied := *adm
	if cost != want {
		t.Fatal("cost", cost)
	}
	adm.state.used.Store(true)
	if _, err = copied.Cost(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("used", err)
	}
	adm.state.used.Store(false)
	var last int64
	var called bool
	baseOK(t, a.Scan(ctx, b, prepareSnap, nil, &after))
	baseOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM work_queue_id_seq", nil, &last, &called))
	if before != after || last != adm.state.queueID || !called {
		t.Fatal("write or allocation", before, after, last)
	}
	baseOK(t, o.Rollback(ctx))
	if _, err = adm.Cost(ctx, a); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("ended", err)
	}
	if _, err = participant.Prepare(ctx, a, scope, intent); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("ended access", err)
	}
	o2, a2, ctx2 := baseOwner(t, b)
	if _, err = participant.Prepare(ctx2, a2, scope, intent); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("missing pins", err)
	}
	if _, err = adm.Cost(ctx2, a2); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("different tx", err)
	}
	baseOK(t, o2.Rollback(ctx2))
}

func TestPGRecruitPreparePendingAndRejects(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	prepareBase(t, pool, p)
	catalog, active, waiting := preparePending(t)
	first, second, orphan := active, active, active
	first.queueID, first.command = 51, RecruitCommandID{6}
	second.queueID, second.command = 52, RecruitCommandID{8}
	orphan.queueID, orphan.command, orphan.omitReceipt = 52, RecruitCommandID{7}, true
	scope, intent := RecruitScope{1, 1, RecruitCommandID{9}}, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 1}
	o, a, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	prepareSeedRow(t, ctx, a, b, active)
	prepareSeedRow(t, ctx, a, b, waiting)
	adm, err := participant.Prepare(ctx, a, scope, intent)
	baseOK(t, err)
	if !adm.state.schedule.waiting || !adm.state.schedule.start.Equal(waiting.qfinish) || active.accepted.Nanosecond() != 123000000 || adm.state.schedule.start.Nanosecond() != 123000000 || !validRecruitTime(adm.state.acceptedAt) || adm.state.acceptedAt.Equal(adm.state.schedule.start) || adm.state.schedule.finish.Sub(adm.state.schedule.start) != 30*time.Second {
		t.Fatalf("pending schedule %#v", adm.state.schedule)
	}
	if _, err = participant.Prepare(ctx, a, scope, RecruitIntent{Version: 2, CityID: 100, UnitCfgID: 1, Count: 1}); !errors.Is(err, ErrRecruitUnsupportedVersion) || errors.Is(err, ErrRecruitConflict) || errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("version", err)
	}
	execPrep(t, ctx, a, b, `UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex') WHERE queue_id=40`)
	if _, err = participant.Prepare(ctx, a, scope, RecruitIntent{Version: 2, CityID: 100, UnitCfgID: 1, Count: 1}); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("corrupt version", err)
	}
	baseOK(t, o.Rollback(ctx))
	cases := []struct {
		name string
		sql  string
		seed []historyRow
		v2   bool
	}{
		{"missing marker", `DELETE FROM mil_city_origin`, nil, false},
		{"marker owner", `UPDATE mil_city_origin SET owner_player_id=2`, nil, false},
		{"marker cohort", `UPDATE mil_city_origin SET cohort_id=decode(repeat('04',16),'hex')`, nil, false},
		{"stock missing", `DELETE FROM city_troop WHERE unit_cfg_id=4`, nil, false},
		{"stock extra", `INSERT INTO city_troop VALUES(1,100,5,0,0)`, nil, false},
		{"capacity", `UPDATE work_queue SET status=2 WHERE queue_id IN (40,41);UPDATE city_troop SET count=2147483647 WHERE unit_cfg_id=1`, []historyRow{active, waiting}, false},
		{"version over capacity", `UPDATE work_queue SET status=2 WHERE queue_id IN (40,41);UPDATE city_troop SET count=2147483647 WHERE unit_cfg_id=1`, []historyRow{active, waiting}, true},
		{"origin owner", `UPDATE mil_recruit_origin SET player_id=2 WHERE queue_id=40`, []historyRow{active}, false},
		{"waiting only", ``, []historyRow{waiting}, false},
		{"two active", ``, []historyRow{first, second}, false},
		{"missing receipt", ``, []historyRow{orphan}, false},
		{"receipt city", `UPDATE mil_recruit_receipt SET city_id=101 WHERE queue_id=40`, []historyRow{active}, false},
		{"receipt digest", `UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex') WHERE queue_id=40`, []historyRow{active}, false},
		{"catalog version", `UPDATE work_queue SET payload=pg_catalog.jsonb_set(payload,'{catalog_version}','"v0"') WHERE queue_id=40`, []historyRow{active}, false},
		{"live start", `UPDATE work_queue SET start_at=start_at-interval '1 second' WHERE queue_id=40`, []historyRow{active}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, a, ctx := baseOwner(t, b)
			participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
			baseOK(t, err)
			baseOK(t, participant.Pin(ctx, a))
			for _, h := range tc.seed {
				prepareSeedRow(t, ctx, a, b, h)
			}
			if tc.sql != "" {
				execPrep(t, ctx, a, b, tc.sql)
			}
			in := intent
			want := ErrRecruitUnavailable
			if tc.v2 {
				in.Version, want = 2, ErrRecruitUnsupportedVersion
			}
			if _, err = participant.Prepare(ctx, a, scope, in); !errors.Is(err, want) {
				t.Fatal(err)
			}
		})
	}
}

func preparePending(t *testing.T) (*RecruitCatalog, historyRow, historyRow) {
	t.Helper()
	active, catalog, _, _ := historyDefaults(t)
	at := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Second).Add(123 * time.Millisecond)
	active.accepted, active.qstart, active.rstart = at, at, at
	active.qfinish, active.rfinish = at.Add(time.Minute), at.Add(time.Minute)
	waiting := *active
	waiting.queueID, waiting.command, waiting.status, waiting.initial = 41, RecruitCommandID{2}, 0, 0
	waiting.qstart, waiting.rstart, waiting.qfinish, waiting.rfinish = at.Add(time.Minute), at.Add(time.Minute), at.Add(2*time.Minute), at.Add(2*time.Minute)
	return catalog, *active, waiting
}

func execPrep(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding, q string) {
	t.Helper()
	_, err := a.Exec(ctx, b, q)
	baseOK(t, err)
}
