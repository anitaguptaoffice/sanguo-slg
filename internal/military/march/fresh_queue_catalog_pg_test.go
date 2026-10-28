package march

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func freshQueueFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool, b, p := freshBaseFixture(t)
	body, err := os.ReadFile("../../../spec/db/003_domestic.sql")
	baseOK(t, err)
	baseSQL(t, pool, string(body))
	for _, name := range freshQueueNames {
		var v freshsource.ObjectIdentity
		baseOK(t, pool.QueryRow(context.Background(), "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&v.OID, &v.OwnerOID))
		p.Objects[name] = v
	}
	return pool, b, p
}

func TestPGFreshMilitaryQueueSourceAndSettings(t *testing.T) {
	pool, b, p := freshQueueFixture(t)
	o, a, ctx := baseOwner(t, b)
	baseOK(t, validateFreshMilitaryQueue(ctx, a, b, p))
	for _, change := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { p.DatabaseOID++ }, func(p *freshsource.Profile) { p.DatabaseName += "wrong" },
		func(p *freshsource.Profile) { p.SchemaOID++ }, func(p *freshsource.Profile) { p.SchemaName += "wrong" },
		func(p *freshsource.Profile) {
			p.SchemaName = strings.Replace(p.SchemaName, "�", string([]byte{0xff}), 1)
		},
		func(p *freshsource.Profile) { p.SchemaOwnerOID++ }, func(p *freshsource.Profile) { p.CurrentRoleOID++ },
		func(p *freshsource.Profile) { p.CurrentRoleName += "wrong" }, func(p *freshsource.Profile) { p.SessionRoleOID++ },
		func(p *freshsource.Profile) { p.SessionRoleName += "wrong" }, func(p *freshsource.Profile) { delete(p.Objects, "work_queue") },
	} {
		bad, err := freshsource.Snapshot(p)
		baseOK(t, err)
		change(&bad)
		if validateFreshMilitaryQueue(ctx, a, b, bad) == nil {
			t.Fatal("wrong source accepted")
		}
	}
	for _, name := range freshQueueNames {
		for _, owner := range []bool{false, true} {
			bad, _ := freshsource.Snapshot(p)
			v := bad.Objects[name]
			if owner {
				v.OwnerOID++
			} else {
				v.OID++
			}
			bad.Objects[name] = v
			if validateFreshMilitaryQueue(ctx, a, b, bad) == nil {
				t.Fatal("wrong object accepted", name)
			}
		}
	}
	wrong, _ := recruittx.NewBinding(pool)
	if validateFreshMilitaryQueue(ctx, a, wrong, p) == nil {
		t.Fatal("wrong binding")
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if validateFreshMilitaryQueue(cancelled, a, b, p) == nil {
		t.Fatal("cancelled access")
	}
	baseOK(t, o.Rollback(ctx))
	if validateFreshMilitaryQueue(ctx, a, b, p) == nil {
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
		if validateFreshMilitaryQueue(ctx, a, b, p) == nil {
			t.Fatal("unsafe deparse accepted")
		}
		baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &after))
		if before != after {
			t.Fatal("settings mutated")
		}
		baseOK(t, o.Rollback(ctx))
	}
}

func TestPGFreshMilitaryQueueMetadataDrift(t *testing.T) {
	cases := map[string]string{
		"missing":          "DROP TABLE work_queue",
		"column":           "ALTER TABLE work_queue ADD COLUMN extra integer",
		"type":             "ALTER TABLE work_queue ALTER COLUMN queue_type TYPE integer",
		"nullable city":    "ALTER TABLE work_queue ALTER COLUMN city_id SET NOT NULL",
		"nullable player":  "ALTER TABLE work_queue ALTER COLUMN player_id DROP NOT NULL",
		"default":          "ALTER TABLE work_queue ALTER COLUMN payload SET DEFAULT '{\"bad\":true}'::jsonb",
		"extra check":      "ALTER TABLE work_queue ADD CHECK(queue_id>0)",
		"extra index":      "CREATE INDEX extra_queue ON work_queue(city_id)",
		"index options":    "ALTER INDEX idx_work_queue_player SET(fillfactor=70)",
		"predicate":        "DROP INDEX idx_work_queue_due; CREATE INDEX idx_work_queue_due ON work_queue(server_id,status,finish_at) WHERE status IN (0,1,2)",
		"key order":        "DROP INDEX idx_work_queue_player; CREATE INDEX idx_work_queue_player ON work_queue(player_id,server_id)",
		"descending":       "DROP INDEX idx_work_queue_player; CREATE INDEX idx_work_queue_player ON work_queue(server_id,player_id DESC)",
		"unique secondary": "DROP INDEX idx_work_queue_player; CREATE UNIQUE INDEX idx_work_queue_player ON work_queue(server_id,player_id)",
		"included column":  "DROP INDEX idx_work_queue_player; CREATE INDEX idx_work_queue_player ON work_queue(server_id,player_id) INCLUDE(city_id)",
	}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := freshQueueFixture(t)
			o, a, ctx := baseOwner(t, b)
			baseOK(t, validateFreshMilitaryQueue(ctx, a, b, p))
			baseOK(t, o.Rollback(ctx))
			baseSQL(t, pool, ddl)
			// Test-only observations isolate shape rejection from changed index OIDs.
			// Runtime must never recapture expectations in this way.
			if strings.HasPrefix(ddl, "DROP INDEX") {
				for _, index := range freshQueueNames[1:] {
					v := p.Objects[index]
					baseOK(t, pool.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, index).Scan(&v.OID, &v.OwnerOID))
					p.Objects[index] = v
				}
			}
			o, a, ctx = baseOwner(t, b)
			if validateFreshMilitaryQueue(ctx, a, b, p) == nil {
				t.Fatal("metadata drift accepted")
			}
			baseOK(t, o.Rollback(ctx))
			// A second fresh transaction still rejects: no repair or adoption occurred.
			_, a, ctx = baseOwner(t, b)
			if validateFreshMilitaryQueue(ctx, a, b, p) == nil {
				t.Fatal("drift repaired or adopted")
			}
		})
	}
}
