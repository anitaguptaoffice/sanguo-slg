package march

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func marchStoreSample() MarchCreate {
	depart := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	return MarchCreate{
		ServerID: 1, PlayerID: 7, OriginCityID: 100, OwnerPlayerID: 7, ArmyStatus: 2,
		FromX: 10, FromY: 20, ToX: 30, ToY: 40, HeroIDs: []int64{11, 12}, Purpose: 1,
		DepartAt: depart, ArriveAt: depart.Add(time.Hour),
		Troops: []TroopStack{{UnitCfgID: 1, Count: 5}, {UnitCfgID: 2, Count: 3}},
	}
}

func TestMarchCreateValidation(t *testing.T) {
	cases := []func(*MarchCreate){
		func(in *MarchCreate) { in.ServerID = 2 },
		func(in *MarchCreate) { in.PlayerID = 0 },
		func(in *MarchCreate) { in.OwnerPlayerID = 8 },
		func(in *MarchCreate) { in.ArmyStatus = 1 },
		func(in *MarchCreate) { in.OriginCityID = 0 },
		func(in *MarchCreate) { in.Purpose = 4 },
		func(in *MarchCreate) { in.DepartAt = time.Time{} },
		func(in *MarchCreate) { in.ArriveAt = in.DepartAt },
		func(in *MarchCreate) { in.Troops = nil },
		func(in *MarchCreate) { in.Troops[0].UnitCfgID = 0 },
		func(in *MarchCreate) { in.Troops[0].Count = 0 },
		func(in *MarchCreate) { in.Troops[1] = in.Troops[0] },
		func(in *MarchCreate) { in.HeroIDs = nil },
		func(in *MarchCreate) { in.HeroIDs[0] = 0 },
		func(in *MarchCreate) { in.HeroIDs[1] = in.HeroIDs[0] },
	}
	for i, mutate := range cases {
		in := marchStoreSample()
		mutate(&in)
		if err := validateMarchCreate(1, &in); !errors.Is(err, ErrMarchStore) {
			t.Errorf("case %d: %v", i, err)
		}
	}
	if err := validateMarchCreate(1, nil); !errors.Is(err, ErrMarchStore) {
		t.Fatal(err)
	}
}

func TestMarchSequenceAuditArithmetic(t *testing.T) {
	for _, tc := range []struct {
		name      string
		last      int64
		called    bool
		persisted int64
		ok        bool
	}{
		{"fresh", 1, false, 0, true},
		{"not called below", 2, false, 1, true},
		{"not called collision", 1, false, 1, false},
		{"called equal", 5, true, 5, true},
		{"called behind", 5, true, 6, false},
		{"zero", 0, true, 0, false},
		{"above ceiling", marchIDCeiling + 1, true, 0, false},
		{"exhausted history", marchIDCeiling, true, 100, true},
		{"exhausted uncalled", marchIDCeiling, false, 100, true},
	} {
		if marchSequenceOK(tc.last, tc.called, tc.persisted) != tc.ok {
			t.Errorf("%s: last=%d called=%t", tc.name, tc.last, tc.called)
		}
	}
	if _, err := (*MarchStore)(nil).Create(context.Background(), nil, marchStoreSample()); !errors.Is(err, ErrMarchStore) {
		t.Fatal(err)
	}
	if _, err := NewMarchStore(context.Background(), nil, freshsource.Profile{}); !errors.Is(err, ErrMarchStore) {
		t.Fatal(err)
	}
}

func marchStoreFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile, *MarchStore) {
	t.Helper()
	pool, b, p := freshSourceFixture(t)
	cmd := exec.Command("psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "target="+p.SchemaName, "-d", os.Getenv("DATABASE_URL"))
	cmd.Stdin = strings.NewReader("SELECT pg_catalog.set_config('search_path',pg_catalog.format('%I,pg_catalog', :'target'),false);\n\\ir ../../../spec/db/m4_009_march_identity.sql\n\\ir ../../../spec/db/005_hero.sql\n")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("m4_009: %v\n%s", err, out)
	}
	store, err := NewMarchStore(context.Background(), b, p)
	baseOK(t, err)
	return pool, b, p, store
}

func marchStoreCounts(t *testing.T, pool *pgxpool.Pool) (f, m, a, r int64) {
	baseOK(t, pool.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM field_army),(SELECT count(*) FROM march_order),(SELECT count(*) FROM army_troop),(SELECT count(*) FROM battle_report)`).Scan(&f, &m, &a, &r))
	return
}

func TestPGMarchStoreCreate(t *testing.T) {
	pool, b, p, store := marchStoreFixture(t)
	prepareBase(t, pool, p)
	baseSQL(t, pool, `INSERT INTO player_wallet VALUES(1,7,100,100,100,100,10,now())`)
	baseSQL(t, pool, `INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id) VALUES(1,11,7,1)`)
	decoy := p.SchemaName + "_decoy"
	decoyQ := pgx.Identifier{decoy}.Sanitize()
	baseSQL(t, pool, "CREATE SCHEMA "+decoyQ+";CREATE SEQUENCE "+pgx.Identifier{decoy, "field_army_army_id_seq"}.Sanitize()+" START 500;CREATE SEQUENCE "+pgx.Identifier{decoy, "march_order_march_id_seq"}.Sanitize()+" START 600")
	t.Cleanup(func() {
		_, err := pool.Exec(context.Background(), "DROP SCHEMA "+decoyQ+" CASCADE")
		if err != nil {
			t.Error(err)
		}
	})
	snap := func() (s string) {
		baseOK(t, pool.QueryRow(context.Background(), `SELECT (`+prepareSnap+`)||COALESCE((SELECT string_agg(row_to_json(t)::text,'|' ORDER BY hero_id) FROM player_hero t),'')||COALESCE((SELECT string_agg(row_to_json(t)::text,'|') FROM player_wallet t),'')`).Scan(&s))
		return
	}
	before := snap()
	o, a, ctx := baseOwner(t, b)
	_, err := a.Exec(ctx, b, "SET LOCAL search_path="+decoyQ+","+pgx.Identifier{p.SchemaName}.Sanitize())
	baseOK(t, err)
	ids, err := store.Create(ctx, a, marchStoreSample())
	baseOK(t, err)
	baseOK(t, o.Commit(ctx))
	seq := func(name string) string { return pgx.Identifier{p.SchemaName, name}.Sanitize() }
	query := `SELECT EXISTS(SELECT 1 FROM field_army WHERE server_id=1 AND army_id=1 AND owner_player_id=7 AND status=2 AND x=10 AND y=20 AND hero_ids=ARRAY[11,12]::bigint[])` +
		` AND EXISTS(SELECT 1 FROM march_order WHERE server_id=1 AND march_id=1 AND army_id=1 AND from_x=10 AND from_y=20 AND to_x=30 AND to_y=40 AND purpose=1 AND depart_at=$1 AND arrive_at=$2 AND status=1 AND path='[]'::jsonb AND origin_city_id=100 AND return_finish_at IS NULL)` +
		` AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id) FROM army_troop WHERE server_id=1 AND army_id=1)=ARRAY[1,2]` +
		` AND (SELECT array_agg(count ORDER BY unit_cfg_id) FROM army_troop WHERE server_id=1 AND army_id=1)=ARRAY[5,3]` +
		` AND (SELECT last_value FROM ` + seq("march_order_march_id_seq") + `)=1 AND (SELECT is_called FROM ` + seq("march_order_march_id_seq") + `)`
	var ok bool
	baseOK(t, pool.QueryRow(ctx, query, marchStoreSample().DepartAt, marchStoreSample().ArriveAt).Scan(&ok))
	if !ok || ids != (MarchIdentity{1, 1}) || snap() != before {
		t.Fatalf("ids=%#v values=%t unrelated rows changed", ids, ok)
	}
	var decoyOK bool
	baseOK(t, pool.QueryRow(ctx, `SELECT (SELECT last_value FROM `+pgx.Identifier{decoy, "field_army_army_id_seq"}.Sanitize()+`)=500 AND NOT (SELECT is_called FROM `+pgx.Identifier{decoy, "field_army_army_id_seq"}.Sanitize()+`) AND (SELECT last_value FROM `+pgx.Identifier{decoy, "march_order_march_id_seq"}.Sanitize()+`)=600 AND NOT (SELECT is_called FROM `+pgx.Identifier{decoy, "march_order_march_id_seq"}.Sanitize()+`)`).Scan(&decoyOK))
	if !decoyOK {
		t.Fatal("decoy sequence used")
	}
	o2, a2, ctx2 := baseOwner(t, b)
	if _, err = store.Create(ctx2, a2, marchStoreSample()); err != nil {
		t.Fatal(err)
	}
	baseOK(t, o2.Rollback(ctx2))
	if f, m, at, r := marchStoreCounts(t, pool); f != 1 || m != 1 || at != 2 || r != 0 {
		t.Fatalf("rollback persisted rows %d %d %d", f, m, at)
	}
}

func TestPGMarchStoreInsertFailures(t *testing.T) {
	for _, table := range []string{"field_army", "march_order", "army_troop"} {
		pool, b, _, store := marchStoreFixture(t)
		baseSQL(t, pool, `CREATE FUNCTION fail_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$; CREATE TRIGGER fail_write BEFORE INSERT ON `+table+` FOR EACH ROW EXECUTE FUNCTION fail_write()`)
		o, a, ctx := baseOwner(t, b)
		if _, err := store.Create(ctx, a, marchStoreSample()); !errors.Is(err, ErrMarchStore) {
			t.Fatalf("%s: %v", table, err)
		}
		baseOK(t, o.Rollback(ctx))
		if f, m, at, r := marchStoreCounts(t, pool); f+m+at+r != 0 {
			t.Fatalf("%s rows %d %d %d", table, f, m, at)
		}
	}
}

func TestPGMarchStoreSequenceAudit(t *testing.T) {
	seed := map[string]string{
		"march_order":   `INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,path,origin_city_id) VALUES(1,5,5,1,1,2,2,1,now(),now()+interval '1 hour',1,'[]',100)`,
		"field_army":    `INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y) VALUES(1,5,7,2,1,1)`,
		"battle_report": `INSERT INTO battle_report(server_id,report_id,attacker_player_id,location_x,location_y,outcome,detail) VALUES(1,5,7,1,1,1,'{}')`,
	}
	for _, tc := range []struct {
		name, seed, seq string
		last            int64
		called          bool
		rows            int64
	}{
		{"march behind", "march_order", "march_order_march_id_seq", 4, true, 1},
		{"army not called", "field_army", "field_army_army_id_seq", 5, false, 1},
		{"report behind", "battle_report", "battle_report_report_id_seq", 4, true, 1},
		{"exhausted", "battle_report", "field_army_army_id_seq", marchIDCeiling, true, 1},
	} {
		pool, b, p, store := marchStoreFixture(t)
		baseSQL(t, pool, seed[tc.seed])
		seq := pgx.Identifier{p.SchemaName, tc.seq}.Sanitize()
		_, err := pool.Exec(context.Background(), `SELECT pg_catalog.setval($1::pg_catalog.regclass,$2,$3)`, seq, tc.last, tc.called)
		baseOK(t, err)
		o, a, ctx := baseOwner(t, b)
		if _, err = store.Create(ctx, a, marchStoreSample()); !errors.Is(err, ErrMarchSequence) {
			t.Fatalf("%s: %v", tc.name, err)
		}
		baseOK(t, o.Rollback(ctx))
		if f, m, at, r := marchStoreCounts(t, pool); f+m+at+r != tc.rows {
			t.Fatalf("%s rows %d %d %d", tc.name, f, m, at)
		}
		var unchanged bool
		baseOK(t, pool.QueryRow(ctx, `SELECT last_value=$1 AND is_called=$2 FROM `+seq, tc.last, tc.called).Scan(&unchanged))
		if !unchanged {
			t.Fatalf("%s sequence changed", tc.name)
		}
	}
}

func TestPGMarchStoreRejectsNoRows(t *testing.T) {
	pool, b, _, store := marchStoreFixture(t)
	for name, mutate := range map[string]func(*MarchCreate){
		"owner":           func(in *MarchCreate) { in.OwnerPlayerID++ },
		"scope":           func(in *MarchCreate) { in.ServerID = 2 },
		"duplicate troop": func(in *MarchCreate) { in.Troops[1] = in.Troops[0] },
		"missing troop":   func(in *MarchCreate) { in.Troops = nil },
		"origin":          func(in *MarchCreate) { in.OriginCityID = 0 },
	} {
		in := marchStoreSample()
		mutate(&in)
		o, a, ctx := baseOwner(t, b)
		if _, err := store.Create(ctx, a, in); !errors.Is(err, ErrMarchStore) {
			t.Fatalf("%s: %v", name, err)
		}
		baseOK(t, o.Rollback(ctx))
		if f, m, at, r := marchStoreCounts(t, pool); f+m+at+r != 0 {
			t.Fatalf("%s rows %d %d %d", name, f, m, at)
		}
	}
	o, a, ctx := baseOwner(t, b)
	baseOK(t, o.Rollback(ctx))
	if _, err := store.Create(ctx, a, marchStoreSample()); !errors.Is(err, ErrMarchStore) {
		t.Fatal(err)
	}
}
