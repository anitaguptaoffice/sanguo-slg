package march

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func returnCatalogFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool, b, p := freshBaseFixture(t) // Applies reviewed 004_military.sql, not expected constants.
	body, err := os.ReadFile("../../../spec/db/m4_009_march_identity.sql")
	baseOK(t, err)
	baseSQL(t, pool, string(body))
	for _, name := range returnNames {
		var v freshsource.ObjectIdentity
		baseOK(t, pool.QueryRow(context.Background(), "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&v.OID, &v.OwnerOID))
		p.Objects[name] = v
	}
	return pool, b, p
}

func TestPGReturnCatalogSourceAndSettings(t *testing.T) {
	pool, b, p := returnCatalogFixture(t)
	o, a, ctx := baseOwner(t, b)
	saved, err := freshsource.Snapshot(p)
	baseOK(t, err)
	baseOK(t, validateReturnCatalog(ctx, a, b, p))
	copyAccess := *a
	baseOK(t, validateReturnCatalog(ctx, &copyAccess, b, p))
	if !reflect.DeepEqual(saved, p) {
		t.Fatal("caller profile mutated")
	}
	for _, change := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { p.DatabaseOID++ }, func(p *freshsource.Profile) { p.DatabaseName += "wrong" },
		func(p *freshsource.Profile) { p.SchemaOID++ }, func(p *freshsource.Profile) { p.SchemaName += "wrong" },
		func(p *freshsource.Profile) { p.SchemaOwnerOID++ }, func(p *freshsource.Profile) { p.CurrentRoleOID++ },
		func(p *freshsource.Profile) { p.CurrentRoleName += "wrong" }, func(p *freshsource.Profile) { p.SessionRoleOID++ },
		func(p *freshsource.Profile) { p.SessionRoleName += "wrong" }, func(p *freshsource.Profile) { p.SchemaName = "pg_catalog" },
		func(p *freshsource.Profile) { p.SchemaName = string([]byte{255}) }, func(p *freshsource.Profile) { p.DatabaseName += "\x00" },
		func(p *freshsource.Profile) { p.ReleaseDigest = [32]byte{} }, func(p *freshsource.Profile) { p.Cohort = [16]byte{} },
		func(p *freshsource.Profile) { delete(p.Objects, "march_order") },
		func(p *freshsource.Profile) { p.Objects["army_troop"] = p.Objects["field_army"] },
	} {
		bad, err := freshsource.Snapshot(p)
		baseOK(t, err)
		change(&bad)
		if validateReturnCatalog(ctx, a, b, bad) == nil {
			t.Fatal("bad profile accepted")
		}
	}
	for _, name := range returnNames {
		for _, owner := range []bool{false, true} {
			bad, _ := freshsource.Snapshot(p)
			v := bad.Objects[name]
			if owner {
				v.OwnerOID++
			} else {
				v.OID++
			}
			bad.Objects[name] = v
			if validateReturnCatalog(ctx, a, b, bad) == nil {
				t.Fatal("wrong object accepted", name)
			}
		}
	}
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	nilContextErr := validateReturnCatalog(nil, a, b, p) //nolint:staticcheck // Deliberately verify the checker rejects nil context.
	if !errors.Is(validateReturnCatalog(ctx, a, wrong, p), recruittx.ErrBinding) || nilContextErr == nil || validateReturnCatalog(ctx, nil, b, p) == nil || validateReturnCatalog(ctx, a, nil, p) == nil {
		t.Fatal("wrong binding/context accepted")
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if !errors.Is(validateReturnCatalog(cancelled, a, b, p), context.Canceled) {
		t.Fatal("cancelled access accepted")
	}
	baseOK(t, o.Rollback(ctx))
	err = validateReturnCatalog(ctx, &copyAccess, b, p)
	if err == nil || (!errors.Is(err, recruittx.ErrInactive) && !errors.Is(err, context.Canceled)) {
		t.Fatalf("unexpected ended copied access result: %v", err)
	}
	for _, setting := range []struct{ sql, name string }{
		{"SET LOCAL TIME ZONE 'Asia/Shanghai'", "TimeZone"}, {"SET LOCAL DateStyle='SQL, DMY'", "DateStyle"},
		{"SET LOCAL search_path=public,pg_catalog", "search_path"},
	} {
		o, a, ctx = baseOwner(t, b)
		_, err := a.Exec(ctx, b, setting.sql)
		baseOK(t, err)
		var before, after string
		baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &before))
		if validateReturnCatalog(ctx, a, b, p) == nil {
			t.Fatal("unsafe settings accepted")
		}
		baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &after))
		if before != after {
			t.Fatal("settings mutated")
		}
		baseOK(t, o.Rollback(ctx))
	}
}

func TestPGReturnCatalogMetadataDrift(t *testing.T) {
	_, b, original := returnCatalogFixture(t)
	cases := map[string]string{
		"missing": "DROP TABLE army_troop",
		"extra column": "ALTER TABLE field_army ADD COLUMN extra integer",
		"dropped column": "ALTER TABLE field_army DROP COLUMN x",
		"type": "ALTER TABLE march_order ALTER COLUMN origin_city_id TYPE integer",
		"origin nullable": "ALTER TABLE march_order ALTER COLUMN origin_city_id SET NOT NULL",
		"deadline nullable": "ALTER TABLE march_order ALTER COLUMN return_finish_at SET NOT NULL",
		"default": "ALTER TABLE march_order ALTER COLUMN origin_city_id SET DEFAULT 1",
		"deadline default": "ALTER TABLE march_order ALTER COLUMN return_finish_at SET DEFAULT now()",
		"clock default": "ALTER TABLE field_army ALTER COLUMN updated_at SET DEFAULT clock_timestamp()",
		"array default": "ALTER TABLE field_army ALTER COLUMN hero_ids SET DEFAULT '{1}'",
		"array nullability": "ALTER TABLE field_army ALTER COLUMN hero_ids DROP NOT NULL",
		"array type": "ALTER TABLE field_army ALTER COLUMN hero_ids DROP DEFAULT; ALTER TABLE field_army ALTER COLUMN hero_ids TYPE integer[] USING hero_ids::integer[]",
		"array dimensions": "ALTER TABLE field_army ALTER COLUMN hero_ids TYPE bigint[][]",
		"weak check": "ALTER TABLE army_troop DROP CONSTRAINT army_troop_count_check; ALTER TABLE army_troop ADD CONSTRAINT army_troop_count_check CHECK(count>=-1)",
		"unvalidated": "ALTER TABLE army_troop DROP CONSTRAINT army_troop_count_check; ALTER TABLE army_troop ADD CONSTRAINT army_troop_count_check CHECK(count>=0) NOT VALID",
		"deferred PK": "ALTER TABLE army_troop DROP CONSTRAINT army_troop_pkey; ALTER TABLE army_troop ADD CONSTRAINT army_troop_pkey PRIMARY KEY(server_id,army_id,unit_cfg_id) DEFERRABLE",
		"extra index": "CREATE INDEX extra ON army_troop(count)",
		"options": "ALTER INDEX idx_march_arrive SET(fillfactor=70)",
		"predicate": "DROP INDEX idx_march_return; CREATE INDEX idx_march_return ON march_order(server_id,status,return_finish_at) WHERE status=1",
		"keys": "DROP INDEX idx_march_arrive; CREATE INDEX idx_march_arrive ON march_order(server_id,arrive_at,status) WHERE status=1",
		"unique": "DROP INDEX idx_field_army_owner; CREATE UNIQUE INDEX idx_field_army_owner ON field_army(server_id,owner_player_id)",
		"include": "DROP INDEX idx_field_army_owner; CREATE INDEX idx_field_army_owner ON field_army(server_id,owner_player_id) INCLUDE(x)",
		"direction": "DROP INDEX idx_field_army_owner; CREATE INDEX idx_field_army_owner ON field_army(server_id DESC,owner_player_id)",
		"expression": "DROP INDEX idx_field_army_owner; CREATE INDEX idx_field_army_owner ON field_army(server_id,(owner_player_id+0))",
		"opclass": "CREATE OPERATOR CLASS extra_ops FOR TYPE bigint USING btree AS OPERATOR 1 < (bigint,bigint), OPERATOR 2 <= (bigint,bigint), OPERATOR 3 = (bigint,bigint), OPERATOR 4 >= (bigint,bigint), OPERATOR 5 > (bigint,bigint), FUNCTION 1 pg_catalog.btint8cmp(bigint,bigint); DROP INDEX idx_field_army_owner; CREATE INDEX idx_field_army_owner ON field_army(server_id,owner_player_id extra_ops)",
		"persistence": "ALTER TABLE field_army SET UNLOGGED",
		"RLS": "ALTER TABLE field_army ENABLE ROW LEVEL SECURITY",
		"policy": "CREATE POLICY extra ON field_army USING(true)",
		"rule": "CREATE RULE extra AS ON UPDATE TO field_army DO ALSO SELECT 1",
		"trigger": "CREATE FUNCTION extra() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE TRIGGER extra BEFORE UPDATE ON field_army FOR EACH ROW EXECUTE FUNCTION extra()",
		"inheritance": "CREATE TABLE child() INHERITS(field_army)",
		"replica identity": "ALTER TABLE field_army REPLICA IDENTITY FULL",
	}
	// Owned disposable PG only; rollback restores each deliberately corrupted flag.
	for flag, value := range map[string]string{"indisvalid": "false", "indisready": "false", "indislive": "false", "indimmediate": "false", "indisexclusion": "true", "indisreplident": "true", "indnullsnotdistinct": "true"} {
		cases[flag] = "UPDATE pg_catalog.pg_index SET " + flag + "=" + value + " WHERE indexrelid='idx_march_return'::regclass"
	}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			o, a, ctx := baseOwner(t, b)
			p, _ := freshsource.Snapshot(original)
			baseOK(t, validateReturnCatalog(ctx, a, b, p))
			_, err := a.Exec(ctx, b, ddl)
			baseOK(t, err)
			// Test-only OID refresh isolates shape rejection from index replacement.
			for _, name := range returnNames {
				v := p.Objects[name]
				baseOK(t, a.Scan(ctx, b, "SELECT COALESCE((SELECT oid FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2),$3::oid)", []any{p.SchemaOID, name, v.OID}, &v.OID))
				p.Objects[name] = v
			}
			if validateReturnCatalog(ctx, a, b, p) == nil {
				t.Fatal("metadata drift accepted")
			}
			baseOK(t, o.Rollback(ctx))
		})
	}
}

func TestPGReturnCatalogPrivileges(t *testing.T) {
	pool, b, p := returnCatalogFixture(t)
	role := fmt.Sprintf("return_reader_%d", p.SchemaOID)
	quoted := pgx.Identifier{role}.Sanitize()
	baseSQL(t, pool, "CREATE ROLE "+quoted+" NOLOGIN")
	t.Cleanup(func() { baseSQL(t, pool, "DROP OWNED BY "+quoted+"; DROP ROLE "+quoted) })
	baseSQL(t, pool, "GRANT USAGE ON SCHEMA "+pgx.Identifier{p.SchemaName}.Sanitize()+" TO "+quoted)
	p.CurrentRoleName = role
	baseOK(t, pool.QueryRow(context.Background(), "SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$1", role).Scan(&p.CurrentRoleOID))
	for _, missing := range []string{"", "SELECT", "UPDATE"} {
		baseSQL(t, pool, "GRANT SELECT,UPDATE ON march_order,field_army,army_troop TO "+quoted)
		if missing != "" {
			baseSQL(t, pool, "REVOKE "+missing+" ON army_troop FROM "+quoted)
		}
		o, a, ctx := baseOwner(t, b)
		_, err := a.Exec(ctx, b, "SET LOCAL ROLE "+quoted)
		baseOK(t, err)
		err = validateReturnCatalog(ctx, a, b, p)
		if (err == nil) != (missing == "") {
			t.Fatalf("missing %q: %v", missing, err)
		}
		baseOK(t, o.Rollback(ctx))
	}
}

func TestPGReturnCatalogReadOnly(t *testing.T) {
	pool, b, p := returnCatalogFixture(t)
	baseSQL(t, pool, "INSERT INTO field_army(server_id,army_id,owner_player_id,x,y) VALUES(1,1,1,0,0); INSERT INTO army_troop VALUES(1,1,1,7); INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at) VALUES(1,1,1,0,0,1,1,1,now(),now())")
	o, a, ctx := baseOwner(t, b)
	_, err := a.Exec(ctx, b, "SET TRANSACTION READ ONLY")
	baseOK(t, err)
	const snapshot = `SELECT jsonb_build_array((SELECT jsonb_agg(t) FROM field_army t),(SELECT jsonb_agg(t) FROM army_troop t),(SELECT jsonb_agg(t) FROM march_order t),(SELECT jsonb_build_array(last_value,log_cnt,is_called) FROM field_army_army_id_seq),(SELECT jsonb_build_array(last_value,log_cnt,is_called) FROM march_order_march_id_seq),(SELECT jsonb_build_array(last_value,log_cnt,is_called) FROM battle_report_report_id_seq))::text`
	var before, after string
	baseOK(t, a.Scan(ctx, b, snapshot, nil, &before))
	baseOK(t, validateReturnCatalog(ctx, a, b, p))
	baseOK(t, a.Scan(ctx, b, snapshot, nil, &after))
	if before != after {
		t.Fatal("rows or sequence changed")
	}
	baseOK(t, o.Commit(ctx)) // Transaction end still belongs to the caller.
}
