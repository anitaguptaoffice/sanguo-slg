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
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func marchStoreSample() MarchCreate {
	return MarchCreate{1, 7, 100, 7, 2, 10, 20, 30, 40, []int64{11, 12}, 1, time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC), time.Date(2026, 10, 29, 13, 0, 0, 0, time.UTC), []TroopStack{{1, 5}, {2, 3}}}
}
func mustErr(t *testing.T, err, want error) {
	if !errors.Is(err, want) {
		t.Fatalf("err %v, want %v", err, want)
	}
}
func TestMarchCreateValidation(t *testing.T) {
	for _, mutate := range []func(*MarchCreate){
		func(in *MarchCreate) { in.ServerID = 2 }, func(in *MarchCreate) { in.PlayerID = 0 }, func(in *MarchCreate) { in.OwnerPlayerID = 8 },
		func(in *MarchCreate) { in.ArmyStatus = 1 }, func(in *MarchCreate) { in.OriginCityID = 0 }, func(in *MarchCreate) { in.Purpose = 4 },
		func(in *MarchCreate) { in.DepartAt = time.Time{} }, func(in *MarchCreate) { in.ArriveAt = in.DepartAt }, func(in *MarchCreate) { in.Troops = nil },
		func(in *MarchCreate) { in.Troops[0].UnitCfgID = 0 }, func(in *MarchCreate) { in.Troops[0].Count = 0 }, func(in *MarchCreate) { in.Troops[1] = in.Troops[0] },
		func(in *MarchCreate) { in.HeroIDs = nil }, func(in *MarchCreate) { in.HeroIDs[0] = 0 }, func(in *MarchCreate) { in.HeroIDs[1] = in.HeroIDs[0] },
	} {
		in := marchStoreSample()
		mutate(&in)
		mustErr(t, validateMarchCreate(1, &in), ErrMarchStore)
	}
	mustErr(t, validateMarchCreate(1, nil), ErrMarchStore)
}
func TestMarchSequenceAuditArithmetic(t *testing.T) {
	for _, tc := range []struct {
		name      string
		last      int64
		called    bool
		persisted int64
		ok        bool
	}{
		{"fresh", 1, false, 0, true}, {"not called below", 2, false, 1, true},
		{"not called collision", 1, false, 1, false}, {"called equal", 5, true, 5, true},
		{"called behind", 5, true, 6, false}, {"zero", 0, true, 0, false},
		{"above ceiling", marchIDCeiling + 1, true, 0, false},
		{"exhausted history", marchIDCeiling, true, 100, true}, {"exhausted uncalled", marchIDCeiling, false, 100, true},
	} {
		if marchSequenceOK(tc.last, tc.called, tc.persisted) != tc.ok {
			t.Errorf("%s: last=%d called=%t", tc.name, tc.last, tc.called)
		}
	}
	_, err := (*MarchStore)(nil).Create(context.Background(), nil, marchStoreSample())
	mustErr(t, err, ErrMarchStore)
}
func marchStoreFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile, *MarchStore) {
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
func marchStoreRows(t *testing.T, pool *pgxpool.Pool) (s string) {
	baseOK(t, pool.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM field_army)||','||(SELECT count(*) FROM march_order)||','||(SELECT count(*) FROM army_troop)||','||(SELECT count(*) FROM battle_report)`).Scan(&s))
	return
}
func marchStoreSnap(t *testing.T, pool *pgxpool.Pool) (s string) {
	baseOK(t, pool.QueryRow(context.Background(), `SELECT md5(pg_catalog.concat_ws('|',(SELECT string_agg(row_to_json(t)::text,'|' ORDER BY army_id) FROM field_army t),(SELECT string_agg(row_to_json(t)::text,'|' ORDER BY march_id) FROM march_order t),(SELECT string_agg(row_to_json(t)::text,'|' ORDER BY army_id,unit_cfg_id) FROM army_troop t),(SELECT string_agg(row_to_json(t)::text,'|' ORDER BY report_id) FROM battle_report t)))`).Scan(&s))
	return
}
func marchStoreSeq(t *testing.T, pool *pgxpool.Pool, p freshsource.Profile) (s string) {
	baseOK(t, pool.QueryRow(context.Background(), `SELECT string_agg(last_value::text||':'||is_called::text,'|' ORDER BY n) FROM (SELECT 1 n,last_value,is_called FROM `+pgx.Identifier{p.SchemaName, "field_army_army_id_seq"}.Sanitize()+` UNION ALL SELECT 2,last_value,is_called FROM `+pgx.Identifier{p.SchemaName, "march_order_march_id_seq"}.Sanitize()+` UNION ALL SELECT 3,last_value,is_called FROM `+pgx.Identifier{p.SchemaName, "battle_report_report_id_seq"}.Sanitize()+`) t`).Scan(&s))
	return
}

const marchStoreSeedSQL = `INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y) VALUES(9,500,70,2,1,1);INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,path,origin_city_id) VALUES(9,500,500,1,1,2,2,1,now(),now()+interval '1 hour',1,'[]',100);INSERT INTO army_troop VALUES(9,500,1,5);INSERT INTO battle_report(server_id,report_id,attacker_player_id,location_x,location_y,outcome,detail) VALUES(9,500,70,1,1,1,'{}');SELECT setval('field_army_army_id_seq',500,true);SELECT setval('march_order_march_id_seq',500,true);SELECT setval('battle_report_report_id_seq',500,true);`

func TestPGMarchStoreCreate(t *testing.T) {
	pool, b, p, store := marchStoreFixture(t)
	prepareBase(t, pool, p)
	baseSQL(t, pool, `INSERT INTO player_wallet VALUES(1,7,100,100,100,100,10,now());INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id) VALUES(1,11,7,1)`)
	decoy := p.SchemaName + "_decoy"
	baseSQL(t, pool, "CREATE SCHEMA "+pgx.Identifier{decoy}.Sanitize()+";CREATE SEQUENCE "+pgx.Identifier{decoy, "field_army_army_id_seq"}.Sanitize()+" START 500;CREATE SEQUENCE "+pgx.Identifier{decoy, "march_order_march_id_seq"}.Sanitize()+" START 600")
	t.Cleanup(func() {
		baseSQL(t, pool, "DROP SCHEMA "+pgx.Identifier{decoy}.Sanitize()+" CASCADE")
	})
	snap := func() (s string) {
		baseOK(t, pool.QueryRow(context.Background(), `SELECT (`+prepareSnap+`)||COALESCE((SELECT string_agg(row_to_json(t)::text,'|' ORDER BY hero_id) FROM player_hero t),'')||COALESCE((SELECT string_agg(row_to_json(t)::text,'|') FROM player_wallet t),'')`).Scan(&s))
		return
	}
	before := snap()
	o, a, ctx := baseOwner(t, b)
	_, err := a.Exec(ctx, b, "SET LOCAL search_path="+pgx.Identifier{decoy}.Sanitize()+","+pgx.Identifier{p.SchemaName}.Sanitize())
	baseOK(t, err)
	ids, err := store.Create(ctx, a, marchStoreSample())
	baseOK(t, err)
	baseOK(t, o.Commit(ctx))
	seq := func(n string) string { return pgx.Identifier{p.SchemaName, n}.Sanitize() }
	query := `SELECT EXISTS(SELECT 1 FROM field_army WHERE server_id=1 AND army_id=1 AND owner_player_id=7 AND status=2 AND x=10 AND y=20 AND hero_ids=ARRAY[11,12]::bigint[]) AND EXISTS(SELECT 1 FROM march_order WHERE server_id=1 AND march_id=1 AND army_id=1 AND from_x=10 AND from_y=20 AND to_x=30 AND to_y=40 AND purpose=1 AND depart_at=$1 AND arrive_at=$2 AND status=1 AND path='[]'::jsonb AND origin_city_id=100 AND return_finish_at IS NULL) AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id) FROM army_troop WHERE server_id=1 AND army_id=1)=ARRAY[1,2] AND (SELECT array_agg(count ORDER BY unit_cfg_id) FROM army_troop WHERE server_id=1 AND army_id=1)=ARRAY[5,3] AND (SELECT last_value FROM ` + seq("march_order_march_id_seq") + `)=1 AND (SELECT is_called FROM ` + seq("march_order_march_id_seq") + `) AND (SELECT last_value FROM ` + pgx.Identifier{decoy, "field_army_army_id_seq"}.Sanitize() + `)=500 AND NOT (SELECT is_called FROM ` + pgx.Identifier{decoy, "field_army_army_id_seq"}.Sanitize() + `) AND (SELECT last_value FROM ` + pgx.Identifier{decoy, "march_order_march_id_seq"}.Sanitize() + `)=600 AND NOT (SELECT is_called FROM ` + pgx.Identifier{decoy, "march_order_march_id_seq"}.Sanitize() + `)`
	var ok bool
	baseOK(t, pool.QueryRow(ctx, query, marchStoreSample().DepartAt, marchStoreSample().ArriveAt).Scan(&ok))
	if !ok || ids != (MarchIdentity{1, 1}) || snap() != before {
		t.Fatalf("ids=%#v values=%t unrelated changed", ids, ok)
	}
	o2, a2, ctx2 := baseOwner(t, b)
	_, err = store.Create(ctx2, a2, marchStoreSample())
	baseOK(t, err)
	baseOK(t, o2.Rollback(ctx2))
	if got := marchStoreRows(t, pool); got != "1,1,2,0" {
		t.Fatalf("rollback persisted %s", got)
	}
}
func TestPGMarchStoreFailures(t *testing.T) {
	const injected = `IF TG_TABLE_NAME<>'field_army' AND NOT EXISTS(SELECT 1 FROM field_army WHERE server_id=NEW.server_id AND army_id=NEW.army_id) THEN RAISE EXCEPTION 'prefix missing'; END IF;IF TG_TABLE_NAME='army_troop' AND NOT EXISTS(SELECT 1 FROM march_order WHERE server_id=NEW.server_id AND army_id=NEW.army_id) THEN RAISE EXCEPTION 'prefix missing'; END IF;RAISE EXCEPTION 'injected';`
	for _, tc := range []struct{ table, mode, body string }{
		{"field_army", "zero", "RETURN NULL;"}, {"march_order", "zero", "RETURN NULL;"}, {"army_troop", "zero", "RETURN NULL;"},
		{"field_army", "raise", injected}, {"march_order", "raise", injected}, {"army_troop", "raise", injected},
	} {
		pool, b, _, store := marchStoreFixture(t)
		baseSQL(t, pool, marchStoreSeedSQL)
		before := marchStoreSnap(t, pool)
		baseSQL(t, pool, `CREATE FUNCTION fail_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN `+tc.body+` END $$;CREATE TRIGGER fail_write BEFORE INSERT ON `+tc.table+` FOR EACH ROW EXECUTE FUNCTION fail_write()`)
		o, a, ctx := baseOwner(t, b)
		_, err := store.Create(ctx, a, marchStoreSample())
		mustErr(t, err, ErrMarchStore)
		if tc.mode == "zero" {
			if o.Commit(ctx) == nil {
				t.Fatalf("%s: zero-row commit succeeded", tc.table)
			}
		} else {
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != "P0001" || pgErr.Message != "injected" {
				t.Fatalf("%s: %v", tc.table, err)
			}
			baseOK(t, o.Rollback(ctx))
		}
		if got := marchStoreRows(t, pool); got != "1,1,1,1" {
			t.Fatalf("%s %s rows %s", tc.table, tc.mode, got)
		}
		if after := marchStoreSnap(t, pool); after != before {
			t.Fatalf("%s %s: snapshot changed", tc.table, tc.mode)
		}
	}
}
func TestPGMarchStoreSequence(t *testing.T) {
	for _, tc := range []struct{ name, setup, seq, rows string }{
		{"march behind", `INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,path,origin_city_id) VALUES(1,5,5,1,1,2,2,1,now(),now()+interval '1 hour',1,'[]',100);SELECT setval('march_order_march_id_seq',4,true)`, "1:false|4:true|1:false", "0,1,0,0"},
		{"army not called", `INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y) VALUES(1,5,7,2,1,1);SELECT setval('field_army_army_id_seq',5,false)`, "5:false|1:false|1:false", "1,0,0,0"},
		{"report behind", `INSERT INTO battle_report(server_id,report_id,attacker_player_id,location_x,location_y,outcome,detail) VALUES(1,5,7,1,1,1,'{}');SELECT setval('battle_report_report_id_seq',4,true)`, "1:false|1:false|4:true", "0,0,0,1"},
		{"exhausted", `INSERT INTO battle_report(server_id,report_id,attacker_player_id,location_x,location_y,outcome,detail) VALUES(1,5,7,1,1,1,'{}');SELECT setval('field_army_army_id_seq',9007199254740991,true)`, "9007199254740991:true|1:false|1:false", "0,0,0,1"},
		{"post nextval ceiling", `ALTER SEQUENCE field_army_army_id_seq MAXVALUE 9007199254740992;SELECT setval('field_army_army_id_seq',9007199254740991,true)`, "9007199254740992:true|1:false|1:false", "0,0,0,0"},
	} {
		pool, b, p, store := marchStoreFixture(t)
		baseSQL(t, pool, tc.setup)
		o, a, ctx := baseOwner(t, b)
		_, err := store.Create(ctx, a, marchStoreSample())
		mustErr(t, err, ErrMarchSequence)
		baseOK(t, o.Rollback(ctx))
		if got := marchStoreRows(t, pool); got != tc.rows {
			t.Fatalf("%s rows %s", tc.name, got)
		}
		if got := marchStoreSeq(t, pool, p); got != tc.seq {
			t.Fatalf("%s sequence %s, want %s", tc.name, got, tc.seq)
		}
	}
}
func TestPGMarchStoreRejectsNoRows(t *testing.T) {
	pool, b, p, store := marchStoreFixture(t)
	for name, mutate := range map[string]func(*MarchCreate){
		"owner": func(in *MarchCreate) { in.OwnerPlayerID++ }, "scope": func(in *MarchCreate) { in.ServerID = 2 },
		"troop": func(in *MarchCreate) { in.Troops[0].Count = 0 }, "missing troop": func(in *MarchCreate) { in.Troops = nil },
		"duplicate troop": func(in *MarchCreate) { in.Troops[1] = in.Troops[0] }, "hero": func(in *MarchCreate) { in.HeroIDs[0] = 0 },
		"duplicate hero": func(in *MarchCreate) { in.HeroIDs[1] = in.HeroIDs[0] }, "origin": func(in *MarchCreate) { in.OriginCityID = 0 },
	} {
		before := marchStoreSeq(t, pool, p)
		in := marchStoreSample()
		mutate(&in)
		o, a, ctx := baseOwner(t, b)
		_, err := store.Create(ctx, a, in)
		mustErr(t, err, ErrMarchStore)
		baseOK(t, o.Rollback(ctx))
		if got := marchStoreRows(t, pool); got != "0,0,0,0" {
			t.Fatalf("%s rows %s", name, got)
		}
		if after := marchStoreSeq(t, pool, p); after != before {
			t.Fatalf("%s sequence %s -> %s", name, before, after)
		}
	}
	o, a, ctx := baseOwner(t, b)
	baseOK(t, o.Rollback(ctx))
	_, err := store.Create(ctx, a, marchStoreSample())
	mustErr(t, err, ErrMarchStore)
}
func TestPGMarchStoreAccessAndProfile(t *testing.T) {
	pool, b, p, store := marchStoreFixture(t)
	o, a, ctx := baseOwner(t, b)
	var nilCtx context.Context
	_, err := store.Create(nilCtx, a, marchStoreSample())
	mustErr(t, err, ErrMarchStore)
	_, err = store.Create(ctx, nil, marchStoreSample())
	mustErr(t, err, ErrMarchStore)
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	_, err = store.Create(wctx, wa, marchStoreSample())
	mustErr(t, err, ErrMarchStore)
	baseOK(t, wo.Rollback(wctx))
	baseOK(t, o.Rollback(ctx))
	_, err = store.Create(ctx, a, marchStoreSample())
	mustErr(t, err, ErrMarchStore)
	_, err = NewMarchStore(ctx, nil, p)
	mustErr(t, err, ErrMarchStore)
	_, err = NewMarchStore(ctx, b, freshsource.Profile{})
	mustErr(t, err, ErrMarchStore)
	_, err = NewMarchStore(nilCtx, b, p)
	mustErr(t, err, ErrMarchStore)
	obj, n, schema, server := p.Objects["work_queue_id_seq"], len(p.Objects), p.SchemaName, p.ServerID
	priv, err := NewMarchStore(ctx, b, p)
	baseOK(t, err)
	p.SchemaName, p.ServerID = "wrong", 99
	delete(p.Objects, "work_queue_id_seq")
	p.Objects["extra"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1}
	if priv.profile.SchemaName != schema || priv.profile.ServerID != server || len(priv.profile.Objects) != n || priv.profile.Objects["work_queue_id_seq"] != obj {
		t.Fatal("profile not copied")
	}
}
