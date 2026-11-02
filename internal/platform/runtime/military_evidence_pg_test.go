package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/url"
	"os"
	"os/exec"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func writeMilProfile(t *testing.T, f militaryStartupProfile) string {
	return writeMilRaw(t, milJSON(t, f))
}

func TestPGComposeMilitary(t *testing.T) {
	pool, p := milFixture(t)
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	handle := ComposeMilitary(ctx, log, pool, writeMilProfile(t, milFile(p)))
	if handle == nil || !reflect.DeepEqual(handle.Profile(), p) {
		t.Fatal("valid profile not composed from expectations")
	}
	srv := api.NewServer(nil, nil, nil, nil, nil)
	if srv.AttachMilitaryDurable(handle); srv.MilitaryDurable() != handle {
		t.Fatal("handle not injectable")
	}
	forged := handle.Profile()
	forged.Objects["city_troop"] = freshsource.ObjectIdentity{}
	if forged = handle.Profile(); forged.Objects["city_troop"].OID == 0 {
		t.Fatal("profile not copy-safe")
	}
	for name, mutate := range map[string]func(*militaryStartupProfile){
		"schema":       func(f *militaryStartupProfile) { f.SchemaName += "_wrong" },
		"schema oid":   func(f *militaryStartupProfile) { f.SchemaOID++ },
		"database oid": func(f *militaryStartupProfile) { f.DatabaseOID++ },
		"object oid":   func(f *militaryStartupProfile) { o := f.Objects["city_troop"]; o.OID++; f.Objects["city_troop"] = o },
		"object owner": func(f *militaryStartupProfile) {
			o := f.Objects["work_queue"]
			o.OwnerOID++
			f.Objects["work_queue"] = o
		},
		"role":         func(f *militaryStartupProfile) { f.CurrentRoleName += "_wrong" },
		"session role": func(f *militaryStartupProfile) { f.SessionRoleOID++ },
		"shard":        func(f *militaryStartupProfile) { f.ServerID = defaultShardID + 1 },
	} {
		f := milFile(p)
		mutate(&f)
		if ComposeMilitary(ctx, log, pool, writeMilProfile(t, f)) != nil {
			t.Fatalf("%s: mismatched profile enabled", name)
		}
	}
	if _, err := pool.Exec(ctx, "ALTER INDEX "+pgx.Identifier{p.SchemaName, "idx_work_queue_due"}.Sanitize()+" RENAME TO idx_work_queue_due_retired"); err != nil {
		t.Fatal(err)
	}
	if ComposeMilitary(ctx, log, pool, writeMilProfile(t, milFile(p))) != nil {
		t.Fatal("constructor failure kept the handle")
	}
	assertMilSourceUnchanged(t, pool, p)
}

func milFixture(t *testing.T) (*pgxpool.Pool, freshsource.Profile) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned disposable PG17 required")
	}
	u, err := url.Parse(dsn)
	if err != nil || u.Host == "" {
		t.Fatalf("DATABASE_URL must be a postgres URL: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("mil_compose_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{name}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), "DROP DATABASE "+pgx.Identifier{name}.Sanitize()+" WITH (FORCE)")
		admin.Close()
	})
	u.Path = "/" + name
	dsn = u.String()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	cmd := exec.CommandContext(ctx, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "city_origin_schema=public", "-d", dsn)
	cmd.Stdin = strings.NewReader("\\ir ../../../spec/db/004_military.sql\n\\ir ../../../spec/db/003_domestic.sql\n" +
		"\\ir ../../../spec/db/migrations/010_create_mil_city_origin.psql\n" +
		"\\ir ../../../spec/db/m4_008_work_queue_id_sequence.sql\n" +
		"\\ir ../../../spec/db/migrations/008_create_recruit_storage.psql\n")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("reviewed source entry: %v\n%s", err, out)
	}
	p, doc := milProfile(), []byte(nil)
	if err := pool.QueryRow(ctx, `SELECT pg_catalog.json_build_object('DatabaseName',d.datname,'DatabaseOID',d.oid::pg_catalog.int8,
 'SchemaName',n.nspname,'SchemaOID',n.oid::pg_catalog.int8,'SchemaOwnerOID',n.nspowner::pg_catalog.int8,
 'CurrentRoleName',current_user,'CurrentRoleOID',r.oid::pg_catalog.int8,'SessionRoleName',session_user,
 'SessionRoleOID',s.oid::pg_catalog.int8,'Objects',(SELECT pg_catalog.json_object_agg(relname,
 pg_catalog.json_build_object('OID',oid::pg_catalog.int8,'OwnerOID',relowner::pg_catalog.int8))
 FROM pg_catalog.pg_class WHERE relnamespace=n.oid AND relname=ANY($1)))
 FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
 WHERE d.datname=current_database() AND n.nspname='public' AND r.rolname=current_user AND s.rolname=session_user`,
		militaryObjects).Scan(&doc); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(doc, &p); err != nil {
		t.Fatal(err)
	}
	return pool, p
}

func assertMilSourceUnchanged(t *testing.T, pool *pgxpool.Pool, p freshsource.Profile) {
	ctx := context.Background()
	q := func(name string) string { return pgx.Identifier{p.SchemaName, name}.Sanitize() }
	var rows, last, locks int64
	var called bool
	err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM `+q("mil_city_origin")+`)+(SELECT count(*) FROM `+q("city_troop")+
		`)+(SELECT count(*) FROM `+q("work_queue")+`)+(SELECT count(*) FROM `+q("mil_recruit_origin")+
		`)+(SELECT count(*) FROM `+q("mil_recruit_receipt")+`), s.last_value, s.is_called,
  (SELECT count(*) FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) l.relation
   WHERE l.pid <> pg_catalog.pg_backend_pid() AND c.relnamespace OPERATOR(pg_catalog.=) $1 AND c.relname OPERATOR(pg_catalog.=) ANY($2::pg_catalog.name[]))
  FROM `+q("work_queue_id_seq")+` s`, p.SchemaOID, militaryObjects[:5]).Scan(&rows, &last, &called, &locks)
	if err != nil || rows != 0 || last != 1 || called || locks != 0 {
		t.Fatalf("source changed: rows=%d last=%d called=%v locks=%d err=%v", rows, last, called, locks, err)
	}
}
