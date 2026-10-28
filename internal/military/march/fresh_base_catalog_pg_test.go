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
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func baseOK(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
func baseSQL(t *testing.T, p *pgxpool.Pool, q string) {
	t.Helper()
	_, err := p.Exec(context.Background(), q)
	baseOK(t, err)
}

// Fixtures are newly owned, not production source approval. Use reviewed DDL,
// never a table template built by copying the validator's expected constants.
func freshBaseFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned isolated PG17 required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	baseOK(t, err)
	schema := fmt.Sprintf("mil_base_%d_�\"Q", time.Now().UnixNano())
	baseSQL(t, admin, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize())
	cfg, err := pgxpool.ParseConfig(dsn)
	baseOK(t, err)
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{schema}.Sanitize()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	baseOK(t, err)
	t.Cleanup(func() {
		pool.Close()
		clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_, err := admin.Exec(clean, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		admin.Close()
		if err != nil {
			t.Error(err)
		}
	})
	body, err := os.ReadFile("../../../spec/db/004_military.sql")
	baseOK(t, err)
	baseSQL(t, pool, string(body))
	cmd := exec.CommandContext(ctx, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "city_origin_schema="+schema, "-d", dsn, "-f", "../../../spec/db/migrations/010_create_mil_city_origin.psql")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("reviewed marker entry: %v\n%s", err, out)
	}
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "owned-test", EvidenceRef: "not-production-evidence", ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	err = pool.QueryRow(ctx, `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid
 FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
 WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID, &p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID)
	baseOK(t, err)
	for _, name := range freshBaseNames {
		var value freshsource.ObjectIdentity
		err = pool.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&value.OID, &value.OwnerOID)
		baseOK(t, err)
		p.Objects[name] = value
	}
	b, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	return pool, b, p
}

func baseOwner(t *testing.T, b *recruittx.Binding) (*recruittx.Owner, *recruittx.Access, context.Context) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)
	o, err := b.Begin(ctx)
	baseOK(t, err)
	t.Cleanup(func() {
		clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_ = o.Rollback(clean)
	})
	return o, o.Access(), ctx
}

func TestPGFreshMilitaryBaseSourceAndSettings(t *testing.T) {
	pool, b, p := freshBaseFixture(t)
	o, a, ctx := baseOwner(t, b)
	baseOK(t, validateFreshMilitaryBase(ctx, a, b, p))
	for _, change := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { p.DatabaseOID++ }, func(p *freshsource.Profile) { p.DatabaseName += "wrong" },
		func(p *freshsource.Profile) { p.SchemaOID++ }, func(p *freshsource.Profile) { p.SchemaName += "wrong" },
		func(p *freshsource.Profile) {
			p.SchemaName = strings.Replace(p.SchemaName, "�", string([]byte{0xff}), 1)
		},
		func(p *freshsource.Profile) { p.SchemaOwnerOID++ }, func(p *freshsource.Profile) { p.CurrentRoleOID++ },
		func(p *freshsource.Profile) { p.CurrentRoleName += "wrong" }, func(p *freshsource.Profile) { p.SessionRoleOID++ },
		func(p *freshsource.Profile) { p.SessionRoleName += "wrong" }, func(p *freshsource.Profile) { delete(p.Objects, "city_troop") },
	} {
		bad, err := freshsource.Snapshot(p)
		baseOK(t, err)
		change(&bad)
		if validateFreshMilitaryBase(ctx, a, b, bad) == nil {
			t.Fatal("wrong source accepted")
		}
	}
	for _, name := range freshBaseNames {
		for _, owner := range []bool{false, true} {
			bad, _ := freshsource.Snapshot(p)
			v := bad.Objects[name]
			if owner {
				v.OwnerOID++
			} else {
				v.OID++
			}
			bad.Objects[name] = v
			if validateFreshMilitaryBase(ctx, a, b, bad) == nil {
				t.Fatal("wrong object accepted", name)
			}
		}
	}
	wrong, _ := recruittx.NewBinding(pool)
	if validateFreshMilitaryBase(ctx, a, wrong, p) == nil {
		t.Fatal("wrong binding")
	}
	baseOK(t, o.Rollback(ctx))
	if validateFreshMilitaryBase(ctx, a, b, p) == nil {
		t.Fatal("ended access")
	}
	for _, setting := range []struct{ sql, name string }{{"SET LOCAL TIME ZONE 'Asia/Shanghai'", "TimeZone"}, {"SET LOCAL DateStyle='SQL, DMY'", "DateStyle"}, {"SET LOCAL search_path=" + pgx.Identifier{p.SchemaName}.Sanitize() + ",pg_catalog", "search_path"}} {
		o, a, ctx = baseOwner(t, b)
		_, err := a.Exec(ctx, b, setting.sql)
		baseOK(t, err)
		var before, after string
		baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &before))
		if validateFreshMilitaryBase(ctx, a, b, p) == nil {
			t.Fatal("unsafe deparse accepted")
		}
		baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &after))
		if before != after {
			t.Fatal("checker mutated settings")
		}
		baseOK(t, o.Rollback(ctx))
	}
}

func TestPGFreshMilitaryBaseMetadataDrift(t *testing.T) {
	cases := map[string]string{
		"missing":            "DROP TABLE mil_city_origin",
		"column":             "ALTER TABLE mil_city_origin ADD COLUMN extra integer",
		"type":               "ALTER TABLE city_troop ALTER COLUMN count TYPE bigint",
		"nullable":           "ALTER TABLE city_troop ALTER COLUMN wounded DROP NOT NULL",
		"default":            "ALTER TABLE city_troop ALTER COLUMN count SET DEFAULT 1",
		"marker default":     "ALTER TABLE mil_city_origin ALTER COLUMN server_id SET DEFAULT 1",
		"extra index":        "CREATE INDEX extra ON city_troop(wounded)",
		"index options":      "ALTER INDEX city_troop_pkey SET(fillfactor=70)",
		"weaker check":       "ALTER TABLE mil_city_origin DROP CONSTRAINT mil_city_origin_format_version_check; ALTER TABLE mil_city_origin ADD CONSTRAINT mil_city_origin_format_version_check CHECK(format_version>=1)",
		"unvalidated":        "ALTER TABLE city_troop DROP CONSTRAINT city_troop_wounded_check; ALTER TABLE city_troop ADD CONSTRAINT city_troop_wounded_check CHECK(wounded>=0) NOT VALID",
		"literal whitespace": `ALTER TABLE mil_city_origin DROP CONSTRAINT mil_city_origin_created_at_check; ALTER TABLE mil_city_origin ADD CONSTRAINT mil_city_origin_created_at_check CHECK(isfinite(created_at) AND created_at >= '0001-01-01T00:00:00Z' AND created_at < '10000-01-01T00:00:00Z' AND date_trunc('milli seconds',created_at)=created_at)`,
	}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := freshBaseFixture(t)
			o, a, ctx := baseOwner(t, b)
			baseOK(t, validateFreshMilitaryBase(ctx, a, b, p))
			baseOK(t, o.Rollback(ctx))
			baseSQL(t, pool, ddl)
			_, a, ctx = baseOwner(t, b)
			if validateFreshMilitaryBase(ctx, a, b, p) == nil {
				t.Fatal("metadata drift accepted")
			}
		})
	}
}
