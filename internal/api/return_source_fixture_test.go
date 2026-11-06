package api

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Independently enumerated contract union, not discovery or production enrollment.
var returnPGNames = strings.Fields(`account account_pkey uq_account_login_name account_account_id_seq
account_session account_session_pkey idx_account_session_account player player_pkey uq_player_account_per_server idx_player_account
player_wallet player_wallet_pkey map_cell map_cell_pkey player_city player_city_pkey player_city_server_id_x_y_key idx_player_city_owner player_city_id_seq
mil_city_origin mil_city_origin_pkey city_troop city_troop_pkey work_queue work_queue_pkey idx_work_queue_due idx_work_queue_player
mil_recruit_origin mil_recruit_receipt mil_recruit_origin_pkey mil_recruit_origin_server_id_player_id_operation_command_id_key mil_recruit_receipt_pkey work_queue_id_seq
march_order march_order_pkey idx_march_arrive idx_march_return field_army field_army_pkey idx_field_army_owner army_troop army_troop_pkey`)

func returnPGOK(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
func returnPGContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)
	return ctx
}
func returnPGExec(t *testing.T, ctx context.Context, conn *pgx.Conn, sql string) {
	t.Helper()
	_, err := conn.Exec(ctx, sql)
	returnPGOK(t, err)
}

// Only the pool has the optional test tracer; observers never share its connection.
func returnPGFixture(t *testing.T, tracer pgx.QueryTracer, configure ...func(*pgxpool.Config)) (*pgxpool.Pool, *pgx.Conn, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned isolated PG17 and host psql required")
	}
	_, err := exec.LookPath("psql")
	returnPGOK(t, err)
	ctx := returnPGContext(t)
	admin, err := pgx.Connect(ctx, dsn)
	returnPGOK(t, err)
	schema := fmt.Sprintf("api_return_%d_\"Q", time.Now().UnixNano())
	var pool *pgxpool.Pool
	var observer *pgx.Conn
	t.Cleanup(func() {
		clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		if observer != nil {
			_ = observer.Close(clean)
		}
		if pool != nil {
			done := make(chan struct{})
			go func() { pool.Close(); close(done) }()
			select {
			case <-done:
			case <-clean.Done():
				t.Error("return fixture pool cleanup timed out")
			}
		}
		cleanDDL, stopDDL := context.WithTimeout(context.Background(), 5*time.Second)
		defer stopDDL()
		_, err := admin.Exec(cleanDDL, "DROP SCHEMA IF EXISTS "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		if err != nil {
			t.Error(err)
		}
		_ = admin.Close(cleanDDL)
	})
	returnPGExec(t, ctx, admin, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize())
	cfg, err := pgxpool.ParseConfig(dsn)
	returnPGOK(t, err)
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{schema}.Sanitize()
	cfg.ConnConfig.RuntimeParams["timezone"] = "UTC"
	cfg.ConnConfig.RuntimeParams["datestyle"] = "ISO, YMD"
	observer, err = pgx.ConnectConfig(ctx, cfg.ConnConfig.Copy())
	returnPGOK(t, err)
	for _, file := range []string{"001_account.sql", "002_world.sql", "003_domestic.sql", "004_military.sql", "m4_008_work_queue_id_sequence.sql"} {
		body, err := os.ReadFile("../../spec/db/" + file)
		returnPGOK(t, err)
		returnPGExec(t, ctx, observer, string(body))
	}
	cmd := exec.CommandContext(ctx, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "target="+schema, "-v", "city_origin_schema="+schema, "-d", dsn)
	cmd.Stdin = strings.NewReader("SET TIME ZONE 'UTC'; SET datestyle = 'ISO, YMD';\nSELECT pg_catalog.set_config('search_path',pg_catalog.format('%I,pg_catalog', :'target'),false);\n\\ir ../../spec/db/migrations/008_create_recruit_storage.psql\n\\ir ../../spec/db/migrations/010_create_mil_city_origin.psql\n")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("reviewed manual entries: %v\n%s", err, out)
	}
	body, err := os.ReadFile("../../spec/db/m4_009_march_identity.sql")
	returnPGOK(t, err)
	returnPGExec(t, ctx, observer, string(body))
	// Exact reviewed WORLD test DDL only: no adopted provisioning migration exists.
	returnPGExec(t, ctx, observer, "CREATE SEQUENCE player_city_id_seq AS bigint START 1 MINVALUE 1 MAXVALUE 9223372036854775807 INCREMENT 1 CACHE 1 NO CYCLE OWNED BY NONE")
	returnPGExec(t, ctx, observer, `INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(1,'fixture','not-a-credential');
INSERT INTO account_session(session_id,account_id,expires_at) VALUES('00000000-0000-0000-0000-000000000001',1,'2030-01-01');
INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,1,1,'fixture');
INSERT INTO player_wallet(server_id,player_id,food,wood,iron,stone,gold) VALUES(1,1,100,200,300,400,500);
INSERT INTO map_cell(server_id,x,y,terrain) VALUES(1,0,0,1);
INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,1,1,'fixture',0,0);
INSERT INTO mil_city_origin VALUES(1,1,1,decode('03000000000000000000000000000000','hex'),1,'2026-01-01');
INSERT INTO city_troop SELECT 1,1,u,10+u,u FROM generate_series(1,4) u;
INSERT INTO work_queue(server_id,queue_id,player_id,city_id,queue_type,start_at,finish_at) VALUES(1,1,1,1,1,'2026-01-01','2026-01-02');
INSERT INTO field_army(server_id,army_id,owner_player_id,x,y) VALUES(1,1,1,0,0);
INSERT INTO army_troop VALUES(1,1,1,7);
INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at) VALUES(1,1,1,0,0,1,1,1,'2026-01-01','2026-01-02')`)
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "owned-fixture", EvidenceRef: "not-production-evidence", ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	returnPGOK(t, observer.QueryRow(ctx, `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid
FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(
		&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID, &p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID))
	for _, name := range returnPGNames {
		var id freshsource.ObjectIdentity
		returnPGOK(t, observer.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&id.OID, &id.OwnerOID))
		p.Objects[name] = id
	}
	if len(p.Objects) != 43 {
		t.Fatal("fixture inventory is not the independent 43-object union")
	}
	cfg.ConnConfig.Tracer = tracer
	for _, change := range configure {
		change(cfg)
	}
	pool, err = pgxpool.NewWithConfig(ctx, cfg)
	returnPGOK(t, err)
	binding, err := recruittx.NewBinding(pool)
	returnPGOK(t, err)
	return pool, observer, binding, p
}

func returnPGCatalog(t *testing.T) *march.RecruitCatalog {
	t.Helper()
	var rules [4]march.RecruitRule
	for i := range rules {
		rules[i] = march.RecruitRule{UnitCfgID: int32(i + 1), SecondsPerUnit: int64(i + 1)}
	}
	version, err := march.RecruitManifestVersion(rules)
	returnPGOK(t, err)
	catalog, err := march.NewRecruitCatalog([]march.RecruitManifest{{Version: version, Rules: rules}}, version)
	returnPGOK(t, err)
	return catalog
}

// Includes every baseline business table and every sequence, not just captured objects.
func returnPGSnapshot(t *testing.T, ctx context.Context, observer *pgx.Conn, p freshsource.Profile) map[string]string {
	t.Helper()
	rows, err := observer.Query(ctx, "SELECT relname,relkind::text FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relkind IN ('r','S') ORDER BY relname", p.SchemaOID)
	returnPGOK(t, err)
	names, err := pgx.CollectRows(rows, pgx.RowToStructByPos[struct{ Name, Kind string }])
	returnPGOK(t, err)
	out := make(map[string]string)
	for _, object := range names {
		expr := "jsonb_build_array(t,t.xmin::text,t.ctid::text) ORDER BY t.ctid"
		if object.Kind == "S" {
			expr = "jsonb_build_array(t.last_value,t.log_cnt,t.is_called)"
		}
		var value string
		returnPGOK(t, observer.QueryRow(ctx, "SELECT COALESCE(jsonb_agg("+expr+")::text,'[]') FROM "+pgx.Identifier{p.SchemaName, object.Name}.Sanitize()+" t").Scan(&value))
		out[object.Name] = value
	}
	return out
}

type returnPGQuery struct {
	sql string
	pid uint32
	err error
}
type returnPGTrace struct {
	mu      sync.Mutex
	queries []returnPGQuery
}
type returnPGTraceKey struct{}

func (r *returnPGTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	r.mu.Lock()
	defer r.mu.Unlock()
	i := len(r.queries)
	r.queries = append(r.queries, returnPGQuery{sql: data.SQL, pid: conn.PgConn().PID()})
	return context.WithValue(ctx, returnPGTraceKey{}, i)
}
func (r *returnPGTrace) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.queries[ctx.Value(returnPGTraceKey{}).(int)].err = data.Err
}
func (r *returnPGTrace) events() []returnPGQuery {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]returnPGQuery(nil), r.queries...)
}
