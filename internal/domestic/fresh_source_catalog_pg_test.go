package domestic

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func freshCatalogPGFixture(t *testing.T, ctx context.Context, quoted bool) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool, b, p := recruitWalletFixture(t, quoted) // Actual 003, including unrelated tables.
	ddl, err := os.ReadFile("../../spec/db/007_domestic_production_checkpoint.sql")
	if err != nil {
		t.Fatal(err)
	}
	freshCatalogPGExec(t, ctx, pool, string(ddl))
	for _, name := range []string{"city_building", "city_building_pkey", "idx_city_building_cfg",
		"city_production_checkpoint", "city_production_checkpoint_pkey", "idx_city_production_player"} {
		freshCatalogPGIdentity(t, ctx, pool, &p, name)
	}
	return pool, b, p
}

// Only fixture identity is discovered. Approved shape always comes from product constants.
func freshCatalogPGIdentity(t *testing.T, ctx context.Context, pool *pgxpool.Pool, p *freshsource.Profile, name string) {
	t.Helper()
	var o freshsource.ObjectIdentity
	if err := pool.QueryRow(ctx, `SELECT oid,relowner FROM pg_catalog.pg_class
WHERE relnamespace=$1 AND relname=$2`, p.SchemaOID, name).Scan(&o.OID, &o.OwnerOID); err != nil {
		t.Fatal(err)
	}
	p.Objects[name] = o
}

func freshCatalogPGExec(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sql string) {
	t.Helper()
	if _, err := pool.Exec(ctx, sql); err != nil {
		t.Fatal(err)
	}
}

func freshCatalogPGRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool, schema string) map[string]string {
	t.Helper()
	out := make(map[string]string)
	for _, table := range []string{"player_wallet", "city_building", "city_production_checkpoint", "player_research", "work_queue"} {
		var rows string
		query := `SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb)::text
FROM ` + pgx.Identifier{schema, table}.Sanitize() + ` r`
		if err := pool.QueryRow(ctx, query).Scan(&rows); err != nil {
			t.Fatal(err)
		}
		out[table] = rows
	}
	return out
}

func freshCatalogPGCheck(t *testing.T, ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile, want error) {
	t.Helper()
	const settings = `SELECT jsonb_build_object('settings',jsonb_object_agg(name,setting),
 'xid',pg_current_xact_id_if_assigned())::text FROM pg_catalog.pg_settings`
	original := p
	original.Objects = maps.Clone(p.Objects)
	var before, after string
	if err := a.Scan(ctx, b, settings, nil, &before); err != nil {
		t.Fatal(err)
	}
	if err := validateFreshSource(ctx, b, a, p); !errors.Is(err, want) {
		t.Fatalf("validation = %v, want %v", err, want)
	}
	if !reflect.DeepEqual(original, p) {
		t.Fatal("caller profile mutated")
	}
	var pins int
	if err := a.Scan(ctx, b, `SELECT count(*) FROM pg_catalog.pg_locks
WHERE pid=pg_backend_pid() AND relation IN (SELECT c.oid FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname=pg_catalog.current_schema())`, nil, &pins); err != nil || pins != 0 {
		t.Fatalf("residual fixture pins = %d: %v", pins, err)
	}
	if err := a.Scan(ctx, b, settings, nil, &after); err != nil || before != after {
		t.Fatal("transaction unusable or caller settings changed", err)
	}
}

func TestPGFreshCatalogReadOnly(t *testing.T) {
	for _, quoted := range []bool{false, true} {
		for _, seeded := range []bool{false, true} {
			t.Run(fmt.Sprintf("quoted_%t/seeded_%t", quoted, seeded), func(t *testing.T) {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				pool, b, p := freshCatalogPGFixture(t, ctx, quoted)
				if seeded {
					freshCatalogPGExec(t, ctx, pool, `
INSERT INTO player_wallet VALUES(1,9,123,456,789,234,567,'2026-01-02T00:00:00Z');
INSERT INTO city_building VALUES(1,7,'hall',3,2,NULL),(1,7,'farm',4,5,'2026-01-03T00:00:00Z');
INSERT INTO city_production_checkpoint VALUES(1,7,9,'2026-01-02T00:00:00Z',999,11,22,33,44);
INSERT INTO player_research VALUES(1,9,8,2);
INSERT INTO work_queue VALUES(1,4,9,7,1,'{"fixture":true}','2026-01-02T00:00:00Z','2026-01-03T00:00:00Z',0);`)
				}
				var opclass string
				if err := pool.QueryRow(ctx, `SELECT n.nspname||'.'||o.opcname
FROM pg_catalog.pg_index i JOIN pg_catalog.pg_opclass o ON o.oid=i.indclass[2]
JOIN pg_catalog.pg_namespace n ON n.oid=o.opcnamespace WHERE i.indexrelid=$1`, p.Objects["city_building_pkey"].OID).Scan(&opclass); err != nil || opclass != "pg_catalog.text_ops" {
					t.Fatal("actual 003 varchar PK opclass", opclass, err)
				}
				before := freshCatalogPGRows(t, ctx, pool, p.SchemaName)
				o, a := recruitWalletBegin(t, ctx, b)
				freshCatalogPGCheck(t, ctx, b, a, p, nil)
				freshCatalogPGCheck(t, ctx, b, a, p, nil) // Stateless repeated validation.
				if err := o.Commit(ctx); err != nil {
					t.Fatal("validator ended caller transaction", err)
				}
				if !reflect.DeepEqual(before, freshCatalogPGRows(t, ctx, pool, p.SchemaName)) {
					t.Fatal("business content changed")
				}
			})
		}
	}
}

func TestPGFreshCatalogExpectedIdentity(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, b, p := freshCatalogPGFixture(t, ctx, false)
	_, a := recruitWalletBegin(t, ctx, b)
	changes := map[string]func(*freshsource.Profile){
		"database_name": func(p *freshsource.Profile) { p.DatabaseName += "x" },
		"database_oid":  func(p *freshsource.Profile) { p.DatabaseOID++ },
		"schema_name":   func(p *freshsource.Profile) { p.SchemaName += "x" },
		"schema_oid":    func(p *freshsource.Profile) { p.SchemaOID++ },
		"schema_owner":  func(p *freshsource.Profile) { p.SchemaOwnerOID++ },
		"current_name":  func(p *freshsource.Profile) { p.CurrentRoleName += "x" },
		"current_oid":   func(p *freshsource.Profile) { p.CurrentRoleOID++ },
		"session_name":  func(p *freshsource.Profile) { p.SessionRoleName += "x" },
		"session_oid":   func(p *freshsource.Profile) { p.SessionRoleOID++ },
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			bad, _ := freshsource.Snapshot(p)
			change(&bad)
			freshCatalogPGCheck(t, ctx, b, a, bad, errFreshSourceMetadata)
		})
	}
	for name := range p.Objects {
		for _, field := range []string{"oid", "owner", "missing", "substituted", "extra"} {
			t.Run(name+"/"+field, func(t *testing.T) {
				bad, _ := freshsource.Snapshot(p)
				o, want := bad.Objects[name], errFreshSourceMetadata
				switch field {
				case "oid":
					o.OID++
					bad.Objects[name] = o
				case "owner":
					o.OwnerOID++
					bad.Objects[name] = o
				default:
					want = freshsource.ErrProfile
					if field != "extra" {
						delete(bad.Objects, name)
					}
					if field != "missing" {
						bad.Objects["unapproved"] = o
					}
				}
				freshCatalogPGCheck(t, ctx, b, a, bad, want)
			})
		}
	}
	freshCatalogPGCheck(t, ctx, b, a, p, nil)
}

func TestPGFreshCatalogOperationalErrors(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, b, p := freshCatalogPGFixture(t, ctx, false)
	o, a := recruitWalletBegin(t, ctx, b)
	wrong, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	canceled, cancelNow := context.WithCancel(ctx)
	cancelNow()
	expired, expire := context.WithDeadline(ctx, time.Now().Add(-time.Second))
	defer expire()
	for _, tc := range []struct {
		name    string
		ctx     context.Context
		binding *recruittx.Binding
		access  *recruittx.Access
		want    error
	}{
		{"wrong_binding", ctx, wrong, a, recruittx.ErrBinding},
		{"nil_access", ctx, b, nil, recruittx.ErrBinding},
		{"zero_access", ctx, b, &recruittx.Access{}, recruittx.ErrBinding},
		{"nil_context", nil, b, a, recruittx.ErrDeadline},
		{"canceled", canceled, b, a, context.Canceled},
		{"expired", expired, b, a, context.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateFreshSource(tc.ctx, tc.binding, tc.access, p); !errors.Is(err, tc.want) {
				t.Fatal("operational error changed", err)
			}
		})
	}
	freshCatalogPGCheck(t, ctx, b, a, p, nil)
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	t.Run("ended", func(t *testing.T) {
		err := validateFreshSource(ctx, b, a, p)
		if !errors.Is(err, recruittx.ErrInactive) && !errors.Is(err, context.Canceled) {
			t.Fatal("ended access misclassified", err)
		}
	})
	t.Run("sql_aborted_transaction", func(t *testing.T) {
		_, next := recruitWalletBegin(t, ctx, b)
		if _, err := next.Exec(ctx, b, `SELECT 1/0`); err == nil {
			t.Fatal("expected real SQL failure")
		}
		var original, got *pgconn.PgError
		var one int
		if err := next.Scan(ctx, b, `SELECT 1`, nil, &one); !errors.As(err, &original) || original.Code != "25P02" {
			t.Fatal("missing aborted-transaction error", err)
		}
		if err := validateFreshSource(ctx, b, next, p); !errors.As(err, &got) || got.Code != original.Code || errors.Is(err, errFreshSourceMetadata) {
			t.Fatal("SQL error changed", err)
		}
	})
}

func TestPGFreshCatalogHostileShape(t *testing.T) {
	cases := map[string]string{
		"building_varchar_length":    "ALTER TABLE city_building ALTER slot_key TYPE varchar(33)",
		"building_collation":         `ALTER TABLE city_building ALTER slot_key TYPE varchar(32) COLLATE "C"`,
		"building_default":           "ALTER TABLE city_building ALTER level SET DEFAULT 2",
		"building_missing_default":   "ALTER TABLE city_building ALTER level DROP DEFAULT",
		"timestamp_not_null":         "ALTER TABLE city_building ALTER upgrade_finish_at SET NOT NULL",
		"timestamp_default":          "ALTER TABLE city_building ALTER upgrade_finish_at SET DEFAULT now()",
		"extra_column":               "ALTER TABLE city_building ADD surprise integer",
		"dropped_column":             "ALTER TABLE city_building DROP upgrade_finish_at",
		"extra_check":                "ALTER TABLE city_building ADD CHECK(level>=0)",
		"extra_index":                "CREATE INDEX surprise ON city_building(level)",
		"view_dependency":            "CREATE VIEW surprise AS SELECT level FROM city_building",
		"foreign_key_dependency":     "CREATE TABLE surprise(s int,c bigint,slot varchar(32), FOREIGN KEY(s,c,slot) REFERENCES city_building)",
		"rule":                       "CREATE RULE surprise AS ON UPDATE TO city_building DO ALSO SELECT 1",
		"trigger":                    "CREATE FUNCTION surprise() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END'; CREATE TRIGGER surprise BEFORE UPDATE ON city_building FOR EACH ROW EXECUTE FUNCTION surprise()",
		"wallet_default":             "ALTER TABLE player_wallet ALTER food SET DEFAULT 1",
		"building_type":              "ALTER TABLE city_building ALTER level TYPE bigint",
		"building_nullable":          "ALTER TABLE city_building ALTER level DROP NOT NULL",
		"building_column_order":      "ALTER TABLE city_building DROP upgrade_finish_at; ALTER TABLE city_building ADD upgrade_finish_at timestamptz",
		"building_storage":           "ALTER TABLE city_building SET (fillfactor=80)",
		"index_storage":              "ALTER INDEX idx_city_building_cfg SET (fillfactor=80)",
		"checkpoint_extra_column":    "ALTER TABLE city_production_checkpoint ADD surprise integer",
		"checkpoint_extra_index":     "CREATE INDEX surprise ON city_production_checkpoint(settled_at)",
		"checkpoint_view_dependency": "CREATE VIEW surprise AS SELECT player_id FROM city_production_checkpoint",
		"checkpoint_outgoing_fk":     "CREATE TABLE surprise(s int,c bigint,PRIMARY KEY(s,c)); ALTER TABLE city_production_checkpoint ADD FOREIGN KEY(server_id,city_id) REFERENCES surprise",
		"checkpoint_incoming_fk":     "CREATE TABLE surprise(s int,c bigint,FOREIGN KEY(s,c) REFERENCES city_production_checkpoint)",
	}
	for _, column := range []string{"server_id", "city_id", "player_id", "settled_at", "settled_submicro_ns", "food_remainder", "wood_remainder", "stone_remainder", "iron_remainder"} {
		prefix := "ALTER TABLE city_production_checkpoint ALTER " + column
		cases["checkpoint_type/"+column] = prefix + " TYPE numeric USING " + column + "::numeric"
		if column == "settled_at" {
			cases["checkpoint_type/"+column] = prefix + " TYPE timestamp"
		}
		cases["checkpoint_default/"+column] = prefix + " SET DEFAULT 1"
		if column == "settled_at" {
			cases["checkpoint_default/"+column] = prefix + " SET DEFAULT '2026-01-02T00:00:00Z'"
		}
		if column != "server_id" && column != "city_id" {
			cases["checkpoint_nullable/"+column] = prefix + " DROP NOT NULL"
		}
	}
	for _, column := range []string{"settled_submicro_ns", "food_remainder", "wood_remainder", "stone_remainder", "iron_remainder"} {
		upper := "3600000000000"
		if column == "settled_submicro_ns" {
			upper = "1000"
		}
		constraint := "city_production_checkpoint_" + column + "_check"
		prefix := "ALTER TABLE city_production_checkpoint DROP CONSTRAINT " + constraint + "; ALTER TABLE city_production_checkpoint ADD CONSTRAINT " + constraint
		check := " CHECK (" + column + ">=0 AND " + column + "<" + upper + ")"
		cases["check_weakened/"+column] = prefix + " CHECK (" + column + ">=0)"
		cases["check_missing_lower/"+column] = prefix + " CHECK (" + column + "<" + upper + ")"
		cases["check_missing/"+column] = "ALTER TABLE city_production_checkpoint DROP CONSTRAINT " + constraint
		cases["check_not_valid/"+column] = prefix + check + " NOT VALID"
		cases["check_no_inherit/"+column] = prefix + check + " NO INHERIT"
	}
	for name, definition := range map[string]string{
		"key_order":       "ON city_building(building_cfg_id,server_id)",
		"target":          "ON player_research(server_id,tech_cfg_id)",
		"options":         "ON city_building(server_id DESC,building_cfg_id)",
		"include":         "ON city_building(server_id,building_cfg_id) INCLUDE(level)",
		"partial":         "ON city_building(server_id,building_cfg_id) WHERE level>0",
		"expression":      "ON city_building(server_id,(building_cfg_id+1))",
		"key_and_opclass": "ON city_building(server_id,slot_key text_pattern_ops)",
		"method":          "ON city_building USING hash(server_id)",
	} {
		cases["index/"+name] = "DROP INDEX idx_city_building_cfg; CREATE INDEX idx_city_building_cfg " + definition
	}
	cases["index/unique"] = "DROP INDEX idx_city_building_cfg; CREATE UNIQUE INDEX idx_city_building_cfg ON city_building(server_id,building_cfg_id)"
	cases["index/primary_order"] = "ALTER TABLE city_building DROP CONSTRAINT city_building_pkey; ALTER TABLE city_building ADD PRIMARY KEY(city_id,server_id,slot_key)"
	cases["stale_oid_replacement"] = "DROP INDEX idx_city_building_cfg; CREATE INDEX idx_city_building_cfg ON city_building(server_id,building_cfg_id)"
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			pool, b, p := freshCatalogPGFixture(t, ctx, false)
			o, a := recruitWalletBegin(t, ctx, b)
			freshCatalogPGCheck(t, ctx, b, a, p, nil)
			if err := o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			freshCatalogPGExec(t, ctx, pool, ddl)
			if strings.HasPrefix(name, "index/") || strings.HasPrefix(name, "checkpoint_type/") || strings.HasPrefix(name, "building_") {
				// ALTER TYPE can also rebuild indexes. Refresh identities, never shapes.
				for object := range p.Objects {
					freshCatalogPGIdentity(t, ctx, pool, &p, object)
				}
			}
			before := freshCatalogPGRows(t, ctx, pool, p.SchemaName)
			_, a = recruitWalletBegin(t, ctx, b)
			freshCatalogPGCheck(t, ctx, b, a, p, errFreshSourceMetadata)
			if !reflect.DeepEqual(before, freshCatalogPGRows(t, ctx, pool, p.SchemaName)) {
				t.Fatal("rejected validation changed content")
			}
		})
	}
}
