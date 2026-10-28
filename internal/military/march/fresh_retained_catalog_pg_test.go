package march

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func freshRetainedFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool, b, p := freshQueueFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "target="+p.SchemaName, "-d", os.Getenv("DATABASE_URL"))
	cmd.Stdin = strings.NewReader("SELECT pg_catalog.set_config('search_path',pg_catalog.format('%I,pg_catalog', :'target'),false);\n\\ir ../../../spec/db/m4_008_work_queue_id_sequence.sql\n\\ir ../../../spec/db/migrations/008_create_recruit_storage.psql\n")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("reviewed retained entry: %v\n%s", err, out)
	}
	for _, name := range freshRetainedNames {
		var v freshsource.ObjectIdentity
		baseOK(t, pool.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&v.OID, &v.OwnerOID))
		p.Objects[name] = v
	}
	return pool, b, p
}

func TestPGFreshMilitaryRetainedSourceAndSettings(t *testing.T) {
	pool, b, p := freshRetainedFixture(t)
	o, a, ctx := baseOwner(t, b)
	baseOK(t, validateFreshMilitaryRetained(ctx, a, b, p))
	for _, change := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { p.DatabaseOID++ }, func(p *freshsource.Profile) { p.DatabaseName += "wrong" },
		func(p *freshsource.Profile) { p.SchemaOID++ }, func(p *freshsource.Profile) { p.SchemaName += "wrong" },
		func(p *freshsource.Profile) {
			p.SchemaName = strings.Replace(p.SchemaName, "�", string([]byte{0xff}), 1)
		},
		func(p *freshsource.Profile) { p.SchemaOwnerOID++ }, func(p *freshsource.Profile) { p.CurrentRoleOID++ },
		func(p *freshsource.Profile) { p.CurrentRoleName += "wrong" }, func(p *freshsource.Profile) { p.SessionRoleOID++ },
		func(p *freshsource.Profile) { p.SessionRoleName += "wrong" }, func(p *freshsource.Profile) { delete(p.Objects, "mil_recruit_origin") },
	} {
		bad, err := freshsource.Snapshot(p)
		baseOK(t, err)
		change(&bad)
		if validateFreshMilitaryRetained(ctx, a, b, bad) == nil {
			t.Fatal("wrong source accepted")
		}
	}
	for _, name := range freshRetainedNames {
		for _, owner := range []bool{false, true} {
			bad, _ := freshsource.Snapshot(p)
			v := bad.Objects[name]
			if owner {
				v.OwnerOID++
			} else {
				v.OID++
			}
			bad.Objects[name] = v
			if validateFreshMilitaryRetained(ctx, a, b, bad) == nil {
				t.Fatal("wrong object accepted", name)
			}
		}
	}
	wrong, _ := recruittx.NewBinding(pool)
	if validateFreshMilitaryRetained(ctx, a, wrong, p) == nil {
		t.Fatal("wrong binding")
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if validateFreshMilitaryRetained(cancelled, a, b, p) == nil {
		t.Fatal("cancelled access")
	}
	baseOK(t, o.Rollback(ctx))
	if validateFreshMilitaryRetained(ctx, a, b, p) == nil {
		t.Fatal("ended access")
	}
	for _, setting := range []struct{ sql, name string }{
		{"SET LOCAL TIME ZONE 'Asia/Shanghai'", "TimeZone"},
		{"SET LOCAL DateStyle='SQL, DMY'", "DateStyle"},
		{"SET LOCAL search_path=public,pg_catalog", "search_path"},
	} {
		o, a, ctx = baseOwner(t, b)
		_, err := a.Exec(ctx, b, setting.sql)
		baseOK(t, err)
		var before, after string
		baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &before))
		if validateFreshMilitaryRetained(ctx, a, b, p) == nil {
			t.Fatal("unsafe deparse accepted")
		}
		baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &after))
		if before != after {
			t.Fatal("settings mutated")
		}
		baseOK(t, o.Rollback(ctx))
	}
}

func TestPGFreshMilitaryRetainedMetadataDrift(t *testing.T) {
	cases := map[string]string{
		"disabled RI":  "ALTER TABLE mil_recruit_receipt DISABLE TRIGGER ALL",
		"user trigger": "CREATE FUNCTION retained_extra_hook() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE TRIGGER retained_extra_hook BEFORE INSERT ON mil_recruit_receipt FOR EACH ROW EXECUTE FUNCTION retained_extra_hook()",
		"unvalidated":  "ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_count_check; ALTER TABLE mil_recruit_receipt ADD CHECK(count>0) NOT VALID",

		"missing":          "DROP TABLE mil_recruit_receipt",
		"column":           "ALTER TABLE mil_recruit_origin ADD COLUMN extra integer",
		"type":             "ALTER TABLE mil_recruit_receipt ALTER COLUMN count TYPE bigint",
		"nullable":         "ALTER TABLE mil_recruit_origin ALTER COLUMN command_id DROP NOT NULL",
		"default":          "ALTER TABLE mil_recruit_origin ALTER COLUMN operation SET DEFAULT 1",
		"extra check":      "ALTER TABLE mil_recruit_receipt ADD CHECK(city_id>0)",
		"weaker check":     "ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_count_check; ALTER TABLE mil_recruit_receipt ADD CHECK(count>=0)",
		"extra index":      "CREATE INDEX extra_retained ON mil_recruit_origin(player_id)",
		"index options":    "ALTER INDEX mil_recruit_origin_pkey SET(fillfactor=70)",
		"FK action":        "ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_server_id_queue_id_fkey; ALTER TABLE mil_recruit_receipt ADD FOREIGN KEY(server_id,queue_id) REFERENCES mil_recruit_origin(server_id,queue_id) ON UPDATE RESTRICT ON DELETE CASCADE",
		"FK deferred":      "ALTER TABLE mil_recruit_receipt ALTER CONSTRAINT mil_recruit_receipt_server_id_queue_id_fkey DEFERRABLE INITIALLY DEFERRED",
		"FK target":        "CREATE TABLE impostor (LIKE mil_recruit_origin INCLUDING ALL); ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_server_id_queue_id_fkey; ALTER TABLE mil_recruit_receipt ADD FOREIGN KEY(server_id,queue_id) REFERENCES impostor(server_id,queue_id) ON UPDATE RESTRICT ON DELETE RESTRICT",
		"unique key order": "ALTER TABLE mil_recruit_origin DROP CONSTRAINT mil_recruit_origin_server_id_player_id_operation_command_id_key; ALTER TABLE mil_recruit_origin ADD CONSTRAINT mil_recruit_origin_server_id_player_id_operation_command_id_key UNIQUE(player_id,server_id,operation,command_id)",
	}
	for _, col := range []string{"accepted_at", "initial_start_at", "initial_finish_at"} {
		cases["literal whitespace "+col] = fmt.Sprintf("ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_%[1]s_check; ALTER TABLE mil_recruit_receipt ADD CHECK(isfinite(%[1]s) AND %[1]s >= '0001-01-01T00:00:00Z' AND %[1]s < '10000-01-01T00:00:00Z' AND date_trunc('milli seconds',%[1]s)=%[1]s)", col)
	}

	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := freshRetainedFixture(t)
			o, a, ctx := baseOwner(t, b)
			baseOK(t, validateFreshMilitaryRetained(ctx, a, b, p))
			baseOK(t, o.Rollback(ctx))
			baseSQL(t, pool, ddl)
			// Test-only observations isolate shape rejection from changed index OIDs.
			// Runtime must never recapture expectations in this way.
			if name == "unique key order" {
				for _, index := range freshRetainedNames[2:] {
					v := p.Objects[index]
					baseOK(t, pool.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, index).Scan(&v.OID, &v.OwnerOID))
					p.Objects[index] = v
				}
			}
			o, a, ctx = baseOwner(t, b)
			if validateFreshMilitaryRetained(ctx, a, b, p) == nil {
				t.Fatal("metadata drift accepted")
			}
			baseOK(t, o.Rollback(ctx))
			// A second fresh transaction still rejects: no repair or adoption occurred.
			_, a, ctx = baseOwner(t, b)
			if validateFreshMilitaryRetained(ctx, a, b, p) == nil {
				t.Fatal("drift repaired or adopted")
			}
		})
	}
}
