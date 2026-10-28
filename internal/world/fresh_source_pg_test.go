package world

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func freshFixture(t *testing.T, quoted bool) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool := creationPool(t)
	if quoted {
		base := pool
		cfg := base.Config()
		schema := cfg.ConnConfig.RuntimeParams["search_path"] + `_Q"`
		creationSQL(t, base, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize())
		cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{schema}.Sanitize()
		var err error
		pool, err = pgxpool.NewWithConfig(context.Background(), cfg)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			pool.Close()
			creationSQL(t, base, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		})
		body, err := os.ReadFile("../../spec/db/002_world.sql")
		if err != nil {
			t.Fatal(err)
		}
		creationSQL(t, pool, string(body))
	}
	creationSQL(t, pool, "CREATE SEQUENCE player_city_id_seq AS bigint START 1 MINVALUE 1 MAXVALUE 9223372036854775807 INCREMENT 1 CACHE 1 NO CYCLE OWNED BY NONE")
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "owned-fixture", EvidenceRef: "not-production-evidence", ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	err := pool.QueryRow(context.Background(), `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid
 FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
 WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(
		&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID, &p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range worldSourceNames {
		var object freshsource.ObjectIdentity
		if err = pool.QueryRow(context.Background(), "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&object.OID, &object.OwnerOID); err != nil {
			t.Fatal(err)
		}
		p.Objects[name] = object
	}
	b, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	return pool, b, p
}

func TestPGFreshSourceBindingAndPin(t *testing.T) {
	for _, quoted := range []bool{false, true} {
		t.Run(map[bool]string{false: "ordinary", true: "quoted"}[quoted], func(t *testing.T) {
			pool, b, p := freshFixture(t, quoted)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			o, a := sequenceOwner(t, b, ctx)
			s, err := NewFreshCityParticipant(ctx, b, a, p)
			if err != nil {
				t.Fatal("construct", err)
			}
			p.Objects["map_cell"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1}
			p.SchemaName = "caller replaced profile"
			var before, after string
			if err = a.Scan(ctx, b, "SELECT current_setting('search_path')", nil, &before); err != nil {
				t.Fatal(err)
			}
			if err = s.Pin(ctx, a); err != nil {
				t.Fatal("pin", err)
			}
			var pins int
			if err = a.Scan(ctx, b, `SELECT count(*) FROM pg_catalog.pg_locks WHERE pid=pg_backend_pid() AND granted AND
 ((relation=$1 AND mode='RowShareLock') OR (relation=$2 AND mode='RowExclusiveLock'))`, []any{s.profile.Objects["map_cell"].OID, s.profile.Objects["player_city"].OID}, &pins); err != nil || pins != 2 {
				t.Fatal("relation pins", pins, err)
			}
			if err = a.Scan(ctx, b, "SELECT current_setting('search_path')", nil, &after); err != nil || before != after {
				t.Fatal("settings changed", err)
			}
			var value int64
			var called bool
			if err = a.Scan(ctx, b, "SELECT last_value,is_called FROM "+pgx.Identifier{s.profile.SchemaName, "player_city_id_seq"}.Sanitize(), nil, &value, &called); err != nil || value != 1 || called {
				t.Fatal("allocated during binding", err)
			}
			if err = o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			if err = s.Pin(ctx, a); err == nil {
				t.Fatal("post-end pin")
			}
			wrong, _ := recruittx.NewBinding(pool)
			_, foreign := sequenceOwner(t, wrong, ctx)
			if err = s.Pin(ctx, foreign); err == nil {
				t.Fatal("foreign binding")
			}
		})
	}
}

func TestPGFreshSourceIndependentExpectations(t *testing.T) {
	_, b, p := freshFixture(t, false)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, a := sequenceOwner(t, b, ctx)
	changes := []func(*freshsource.Profile){
		func(p *freshsource.Profile) { p.DatabaseOID++ }, func(p *freshsource.Profile) { p.DatabaseName += "wrong" },
		func(p *freshsource.Profile) { p.SchemaOID++ }, func(p *freshsource.Profile) { p.SchemaName += "wrong" },
		func(p *freshsource.Profile) { p.SchemaOwnerOID++ }, func(p *freshsource.Profile) { p.CurrentRoleOID++ },
		func(p *freshsource.Profile) { p.CurrentRoleName += "wrong" }, func(p *freshsource.Profile) { p.SessionRoleOID++ },
		func(p *freshsource.Profile) { p.SessionRoleName += "wrong" }, func(p *freshsource.Profile) { delete(p.Objects, "map_cell") },
		func(p *freshsource.Profile) { p.Objects["extra"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1} },
	}
	for _, change := range changes {
		bad, err := freshsource.Snapshot(p)
		if err != nil {
			t.Fatal(err)
		}
		change(&bad)
		if s, err := NewFreshCityParticipant(ctx, b, a, bad); err == nil || s != nil {
			t.Fatal("adopted mismatched expectation")
		}
	}
	for _, name := range worldSourceNames {
		for _, owner := range []bool{false, true} {
			bad, _ := freshsource.Snapshot(p)
			value := bad.Objects[name]
			if owner {
				value.OwnerOID++
			} else {
				value.OID++
			}
			bad.Objects[name] = value
			if s, err := NewFreshCityParticipant(ctx, b, a, bad); err == nil || s != nil {
				t.Fatal("object expectation", name, owner)
			}
		}
	}
}

func TestPGFreshSourceCatalogDrift(t *testing.T) {
	cases := map[string]string{
		"rename away":     "ALTER TABLE map_cell RENAME TO parked",
		"column":          "ALTER TABLE player_city ADD COLUMN surprise integer",
		"type":            "ALTER TABLE player_city ALTER COLUMN morale TYPE bigint",
		"nullable":        "ALTER TABLE player_city ALTER COLUMN name DROP NOT NULL",
		"default":         "ALTER TABLE player_city ALTER COLUMN wall_level SET DEFAULT 2",
		"check":           "ALTER TABLE player_city ADD CONSTRAINT surprise CHECK(morale>=0)",
		"extra index":     "CREATE INDEX surprise ON player_city(morale)",
		"index direction": "DROP INDEX idx_player_city_owner; CREATE INDEX idx_player_city_owner ON player_city(server_id DESC,player_id)",
		"index rename":    "ALTER INDEX idx_player_city_owner RENAME TO surprise",
		"sequence":        "ALTER SEQUENCE player_city_id_seq CACHE 2",
	}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := freshFixture(t, false)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			o, a := sequenceOwner(t, b, ctx)
			s, err := NewFreshCityParticipant(ctx, b, a, p)
			if err != nil {
				t.Fatal(err)
			}
			if err = o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			creationSQL(t, pool, ddl)
			o, a = sequenceOwner(t, b, ctx)
			if err = s.Pin(ctx, a); err == nil || !s.sequence.retired.Load() {
				t.Fatal("drift admitted or not retired", err)
			}
			if name == "rename away" {
				if err = o.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
				creationSQL(t, pool, "ALTER TABLE parked RENAME TO map_cell")
				_, a = sequenceOwner(t, b, ctx)
				if err = s.Pin(ctx, a); err == nil {
					t.Fatal("retired source reopened")
				}
			}
		})
	}
}

func TestPGFreshSourcePreservesUnsafeSearchPath(t *testing.T) {
	_, b, p := freshFixture(t, false)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, a := sequenceOwner(t, b, ctx)
	if _, err := a.Exec(ctx, b, "SET LOCAL search_path = "+pgx.Identifier{p.SchemaName}.Sanitize()+", pg_catalog"); err != nil {
		t.Fatal(err)
	}
	var before, after string
	if err := a.Scan(ctx, b, "SELECT pg_catalog.current_setting('search_path')", nil, &before); err != nil {
		t.Fatal(err)
	}
	if s, err := NewFreshCityParticipant(ctx, b, a, p); err == nil || s != nil {
		t.Fatal("unsafe default deparse admitted")
	}
	if err := a.Scan(ctx, b, "SELECT pg_catalog.current_setting('search_path')", nil, &after); err != nil || before != after {
		t.Fatal("checker mutated settings", err)
	}
}
