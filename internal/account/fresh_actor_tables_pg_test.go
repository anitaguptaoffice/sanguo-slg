package account

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func actorOK(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
func actorSQL(t *testing.T, p *pgxpool.Pool, q string) {
	t.Helper()
	_, err := p.Exec(context.Background(), q)
	actorOK(t, err)
}

// Fixtures are newly owned, not production source approval. Use reviewed DDL,
// never a table template built by copying the validator's expected constants.
func freshActorFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned isolated PG17 required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	actorOK(t, err)
	schema := fmt.Sprintf("actor_tables_%d_�\"Q", time.Now().UnixNano())
	actorSQL(t, admin, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize())
	cfg, err := pgxpool.ParseConfig(dsn)
	actorOK(t, err)
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{schema}.Sanitize()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	actorOK(t, err)
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
	body, err := os.ReadFile("../../spec/db/001_account.sql")
	actorOK(t, err)
	actorSQL(t, pool, string(body))
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "owned-test", EvidenceRef: "not-production-evidence", ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	err = pool.QueryRow(ctx, `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid
 FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
 WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID, &p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID)
	actorOK(t, err)
	for _, name := range freshActorTableNames {
		var value freshsource.ObjectIdentity
		err = pool.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&value.OID, &value.OwnerOID)
		actorOK(t, err)
		p.Objects[name] = value
	}
	b, err := recruittx.NewBinding(pool)
	actorOK(t, err)
	return pool, b, p
}

func actorOwner(t *testing.T, b *recruittx.Binding) (*recruittx.Owner, *recruittx.Access, context.Context) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)
	o, err := b.Begin(ctx)
	actorOK(t, err)
	t.Cleanup(func() {
		clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_ = o.Rollback(clean)
	})
	return o, o.Access(), ctx
}

func TestPGFreshActorTablesSourceAndSettings(t *testing.T) {
	pool, b, p := freshActorFixture(t)
	o, a, ctx := actorOwner(t, b)
	actorOK(t, validateFreshActorTables(ctx, a, b, p))
	var triggers int
	actorOK(t, a.Scan(ctx, b, `SELECT count(*) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace=$1 AND t.tgisinternal`, []any{p.SchemaOID}, &triggers))
	if triggers != 8 {
		t.Fatal("fixture must preserve all baseline FK hooks", triggers)
	}
	before, err := freshsource.Snapshot(p)
	actorOK(t, err)
	actorOK(t, validateFreshActorTables(ctx, a, b, p))
	if !reflect.DeepEqual(before, p) {
		t.Fatal("input mutated")
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if validateFreshActorTables(canceled, a, b, p) == nil {
		t.Fatal("canceled access")
	}
	for _, change := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { p.DatabaseOID++ }, func(p *freshsource.Profile) { p.DatabaseName += "wrong" },
		func(p *freshsource.Profile) { p.SchemaOID++ }, func(p *freshsource.Profile) { p.SchemaName += "wrong" },
		func(p *freshsource.Profile) {
			p.SchemaName = strings.Replace(p.SchemaName, "�", string([]byte{0xff}), 1)
		},
		func(p *freshsource.Profile) { p.SchemaOwnerOID++ }, func(p *freshsource.Profile) { p.CurrentRoleOID++ },
		func(p *freshsource.Profile) { p.CurrentRoleName += "wrong" }, func(p *freshsource.Profile) { p.SessionRoleOID++ },
		func(p *freshsource.Profile) { p.SessionRoleName += "wrong" }, func(p *freshsource.Profile) { delete(p.Objects, "player") },
	} {
		bad, err := freshsource.Snapshot(p)
		actorOK(t, err)
		change(&bad)
		if validateFreshActorTables(ctx, a, b, bad) == nil {
			t.Fatal("wrong source accepted")
		}
	}
	for _, name := range freshActorTableNames {
		for _, owner := range []bool{false, true} {
			bad, _ := freshsource.Snapshot(p)
			v := bad.Objects[name]
			if owner {
				v.OwnerOID++
			} else {
				v.OID++
			}
			bad.Objects[name] = v
			if validateFreshActorTables(ctx, a, b, bad) == nil {
				t.Fatal("wrong object accepted", name)
			}
		}
	}
	wrong, _ := recruittx.NewBinding(pool)
	if validateFreshActorTables(ctx, a, wrong, p) == nil {
		t.Fatal("wrong binding")
	}
	actorOK(t, o.Rollback(ctx))
	if validateFreshActorTables(ctx, a, b, p) == nil {
		t.Fatal("ended access")
	}
	for _, setting := range []struct{ sql, name string }{{"SET LOCAL TIME ZONE 'Asia/Shanghai'", "TimeZone"}, {"SET LOCAL DateStyle='SQL, DMY'", "DateStyle"}, {"SET LOCAL search_path=" + pgx.Identifier{p.SchemaName}.Sanitize() + ",pg_catalog", "search_path"}} {
		o, a, ctx = actorOwner(t, b)
		_, err := a.Exec(ctx, b, setting.sql)
		actorOK(t, err)
		var before, after string
		actorOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &before))
		if validateFreshActorTables(ctx, a, b, p) == nil {
			t.Fatal("unsafe deparse accepted")
		}
		actorOK(t, a.Scan(ctx, b, "SELECT pg_catalog.current_setting($1)", []any{setting.name}, &after))
		if before != after {
			t.Fatal("checker mutated settings")
		}
		actorOK(t, o.Rollback(ctx))
	}
}

func TestPGFreshActorTablesMetadataDrift(t *testing.T) {
	cases := map[string]string{
		"missing":            "DROP TABLE player",
		"column":             "ALTER TABLE player ADD COLUMN extra integer",
		"dropped residue":    "ALTER TABLE player ADD COLUMN extra integer; ALTER TABLE player DROP COLUMN extra",
		"type":               "ALTER TABLE player ALTER COLUMN level TYPE bigint",
		"typmod":             "ALTER TABLE player ALTER COLUMN display_name TYPE varchar(33)",
		"nullable":           "ALTER TABLE account ALTER COLUMN status DROP NOT NULL",
		"tightened nullable": "ALTER TABLE player ALTER COLUMN last_login_at SET NOT NULL",
		"default":            "ALTER TABLE account ALTER COLUMN status SET DEFAULT 2",
		"new default":        "ALTER TABLE player ALTER COLUMN last_login_at SET DEFAULT now()",
		"missing default":    "ALTER TABLE account_session ALTER COLUMN session_id DROP DEFAULT",
		"identity mode":      "ALTER TABLE account ALTER COLUMN account_id SET GENERATED BY DEFAULT",
		"identity dropped":   "ALTER TABLE account ALTER COLUMN account_id DROP IDENTITY",
		"collation":          "ALTER TABLE player ALTER COLUMN display_name TYPE varchar(32) COLLATE pg_catalog.\"C\"",
		"unlogged":           "ALTER TABLE player SET UNLOGGED",
		"storage options":    "ALTER TABLE player SET(fillfactor=70)",
		"replica identity":   "ALTER TABLE player REPLICA IDENTITY FULL",
		"inheritance":        "CREATE TABLE child_player() INHERITS(player)",
		"rewrite rule":       "CREATE RULE ignore_player AS ON INSERT TO player DO INSTEAD NOTHING",
	}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := freshActorFixture(t)
			o, a, ctx := actorOwner(t, b)
			actorOK(t, validateFreshActorTables(ctx, a, b, p))
			actorOK(t, o.Rollback(ctx))
			actorSQL(t, pool, ddl)
			_, a, ctx = actorOwner(t, b)
			if validateFreshActorTables(ctx, a, b, p) == nil {
				t.Fatal("metadata drift accepted")
			}
		})
	}
}
