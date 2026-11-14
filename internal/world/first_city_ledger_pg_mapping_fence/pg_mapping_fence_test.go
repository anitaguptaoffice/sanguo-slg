package firstcityledgerpgmappingfence

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const testRealm = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11"

func mappingEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller {
	return &Controller{Evidence: mappingEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42}
}

func TestPG17FirstCityLedgerMappingFence(t *testing.T) {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" || os.Getenv("FIRST_CITY_LEDGER_TEST_DSN") == "" {
		t.Skip("owned isolated PG17 required: ALLOW_OWNED_PG17_TEST=1 and FIRST_CITY_LEDGER_TEST_DSN")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	var ver, major string
	if err := admin.QueryRow(ctx, "SHOW server_version").Scan(&ver); err != nil {
		t.Fatal(err)
	}
	t.Log("PostgreSQL", ver)
	if err := admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major); err != nil {
		t.Fatal(err)
	}
	if major != "17" {
		t.Fatalf("PostgreSQL 17 required; got %s", ver)
	}
	specDir := stageSpecs(t)
	defer func() { _ = os.RemoveAll(specDir) }()
	for _, tc := range []struct {
		tag string
		fn  func(*testing.T, *pgxpool.Pool, string, int64)
	}{
		{"missing_physical_mapping_no_empty_initial", scMissingMapping},
		{"namespace_label_only_fail_closed", scNamespaceOnly},
		{"broken_or_stale_mapping_no_empty_no_autofill", scBrokenMapping},
		{"mapping_or_fence_invalidation_blocks_empty", scFenceInvalidAfterGood},
		{"lawful_multi_city_not_blocked", scLawfulMultiCity},
	} {
		t.Run(tc.tag, func(t *testing.T) {
			pool, schema, done := freshSchema(t, admin, specDir)
			defer done()
			if err := InstallDisposableFixture(ctx, pool); err != nil {
				t.Fatal(err)
			}
			acct := seed(t, pool)
			tc.fn(t, pool, schema, acct)
			t.Logf("PASS mapping_fence: %s", tc.tag)
		})
	}
}

func scMissingMapping(t *testing.T, pool *pgxpool.Pool, _ string, acct int64) {
	c := ctl()
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "a1111111-1111-4111-8111-111111111111", nil, "无映射", 1, 2)
	}))
	v, _ := c.Observe(context.Background(), pool, "")
	chk(t, v.CommandCount == 0 && v.ProposalCount == 0)
}

func scNamespaceOnly(t *testing.T, pool *pgxpool.Pool, _ string, acct int64) {
	c := ctl()
	ns := "label-only-realm-ns"
	chk(t, c.WriteMapping(context.Background(), pool, MappingColumns{LedgerNamespace: &ns, MappingRowValid: true, ContinuousFenceOK: true}) == nil)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "a2222222-2222-4222-8222-222222222222", nil, "仅标签", 3, 4)
	}))
	v, _ := c.Observe(context.Background(), pool, "")
	chk(t, v.CommandCount == 0 && v.ProposalCount == 0)
}

func scBrokenMapping(t *testing.T, pool *pgxpool.Pool, schema string, acct int64) {
	c := ctl()
	var dbName string
	mustRow(t, pool, `SELECT current_database()`, &dbName)
	ns, cluster, sh, alloc, w := "harness-ledger-ns", "harness-cluster-1", "shard:1:actor:42", "harness-city-queue-alloc", "harness-writer-v1"
	bind := BindingAuthority(1, 42, acct)
	chk(t, c.WriteMapping(context.Background(), pool, MappingColumns{
		LedgerNamespace: &ns, ClusterID: &cluster, DatabaseName: &dbName, SchemaName: &schema,
		CityQueueAllocator: &alloc, AccountBindingAuthority: &bind, WriterAuthority: &w,
		MappingRowValid: true, ContinuousFenceOK: true,
	}) == nil)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "a4444444-4444-4444-8444-444444444444", nil, "缺段", 12, 13)
	}))
	bad := "server:1:player:99:account:0"
	chk(t, c.WriteMapping(context.Background(), pool, MappingColumns{
		LedgerNamespace: &ns, ClusterID: &cluster, DatabaseName: &dbName, SchemaName: &schema,
		ShardActorDomain: &sh, CityQueueAllocator: &alloc, AccountBindingAuthority: &bad, WriterAuthority: &w,
		MappingRowValid: true, ContinuousFenceOK: true,
	}) == nil)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "a5555555-5555-4555-8555-555555555555", nil, "矛盾", 14, 15)
	}))
	cmd := "a3333333-3333-4333-8333-333333333333"
	c1b, fct1, sha := canonicalPayload("保留城", 10, 11)
	chk(t, c.WriteFullMapping(context.Background(), pool, acct, schema) == nil)
	mustExec(t, pool, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,
 success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,2,'t','r','c',1,$5,$6,now(),now(),88001,1,42,true,1,100)`, testRealm, cmd, acct, c1b, fct1, sha)
	mustExec(t, pool, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, testRealm, acct, cmd)
	mustExec(t, pool, `INSERT INTO harness_mapping_proposal VALUES ($1::uuid,'保留城',10,11)`, cmd)
	chk(t, c.WriteMapping(context.Background(), pool, MappingColumns{
		LedgerNamespace: &ns, ClusterID: &cluster, DatabaseName: &dbName, SchemaName: &schema,
		ShardActorDomain: &sh, CityQueueAllocator: &alloc, AccountBindingAuthority: &bad, WriterAuthority: &w,
		MappingRowValid: true, ContinuousFenceOK: true,
	}) == nil)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "a6666666-6666-4666-8666-666666666666", nil, "旧未知", 16, 17)
	}))
	v, _ := c.Observe(context.Background(), pool, cmd)
	chk(t, v.Head == cmd && v.DurableState == 2 && v.CityName == "保留城" && v.CommandCount == 1)
}

func scFenceInvalidAfterGood(t *testing.T, pool *pgxpool.Pool, schema string, acct int64) {
	c := ctl()
	chk(t, c.WriteFullMapping(context.Background(), pool, acct, schema) == nil)
	cmd := "a6666666-6666-4666-8666-666666666666"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "合法 intake", 20, 21)
	}))
	chk(t, c.MarkTerminal(context.Background(), pool, cmd) == nil)
	v, _ := c.Observe(context.Background(), pool, cmd)
	chk(t, v.Head == cmd && v.DurableState == 2 && v.CityName == "合法 intake" && v.CommandCount == 1)
	mustExec(t, pool, `UPDATE harness_mapping_fence_realm SET mapping_row_valid=false WHERE realm_id=$1::uuid`, testRealm)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "a7777777-7777-4777-8777-777777777777", nil, "映射失效", 22, 23)
	}))
	mustExec(t, pool, `UPDATE harness_mapping_fence_realm SET mapping_row_valid=true,continuous_fence_ok=false WHERE realm_id=$1::uuid`, testRealm)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "a8888888-8888-4888-8888-888888888888", nil, "fence失效", 24, 25)
	}))
	v, _ = c.Observe(context.Background(), pool, cmd)
	chk(t, v.Head == cmd && v.DurableState == 2 && v.CityName == "合法 intake" && v.CommandCount == 1)
}

func scLawfulMultiCity(t *testing.T, pool *pgxpool.Pool, schema string, acct int64) {
	c := ctl()
	chk(t, c.WriteFullMapping(context.Background(), pool, acct, schema) == nil)
	cmd := "a9999999-9999-4999-8999-999999999999"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "首城", 30, 31)
	}))
	chk(t, c.MarkTerminal(context.Background(), pool, cmd) == nil)
	mustExec(t, pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'首城',30,31,true)`)
	mustExec(t, pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88020,42,'分城',40,41,false)`)
	var n int
	mustRow(t, pool, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`, &n)
	chk(t, n == 2)
	v, _ := c.Observe(context.Background(), pool, cmd)
	chk(t, v.Head == cmd && v.DurableState == 2)
}

func TestUnauthorizedFailClosed(t *testing.T) {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" || os.Getenv("FIRST_CITY_LEDGER_TEST_DSN") == "" {
		t.Skip("owned isolated PG17 required: ALLOW_OWNED_PG17_TEST=1 and FIRST_CITY_LEDGER_TEST_DSN")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	specDir := stageSpecs(t)
	defer func() { _ = os.RemoveAll(specDir) }()
	pool, _, done := freshSchema(t, admin, specDir)
	defer done()
	_ = InstallDisposableFixture(ctx, pool)
	seed(t, pool)
	c := &Controller{RealmID: testRealm, ServerID: 1, PlayerID: 42}
	ok, err := withConnErr(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, 1, "a1111111-1111-4111-8111-111111111111", nil, "x", 1, 1)
	})
	if ok || err != ErrUnauthorized {
		t.Fatalf("fail-closed: ok=%v err=%v", ok, err)
	}
}

func withConn(pool *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) bool {
	ok, err := withConnErr(pool, fn)
	if err != nil {
		panic(err)
	}
	return ok
}

func withConnErr(pool *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) (bool, error) {
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return false, err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return false, err
	}
	ok, err := fn(tx)
	if err != nil {
		_ = tx.Rollback(ctx)
		return false, err
	}
	if ok {
		if err := tx.Commit(ctx); err != nil {
			return false, err
		}
	} else {
		_ = tx.Rollback(ctx)
	}
	return ok, nil
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-mapping-specs-")
	if err != nil {
		t.Fatal(err)
	}
	var paths []string
	for _, pat := range []string{"00*.sql", "m3_*.sql", "m4_*.sql"} {
		m, _ := filepath.Glob(filepath.Join(dir, "spec/db", pat))
		paths = append(paths, m...)
	}
	sort.Strings(paths)
	for _, p := range paths {
		b, _ := os.ReadFile(p)
		_ = os.WriteFile(filepath.Join(base, filepath.Base(p)), b, 0o600)
	}
	return base
}

func freshSchema(t *testing.T, admin *pgxpool.Pool, specDir string) (*pgxpool.Pool, string, func()) {
	ctx := context.Background()
	schema := fmt.Sprintf("fc_mapping_%x", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, _ := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.ApplySpecs(ctx, pool, specDir); err != nil {
		t.Fatal(err)
	}
	return pool, schema, func() { pool.Close(); _, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") }
}

func seed(t *testing.T, pool *pgxpool.Pool) int64 {
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('map_u','map_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'map_p')`, acct)
	return acct
}

func mustExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func mustRow(t *testing.T, pool *pgxpool.Pool, sql string, dst any, args ...any) {
	t.Helper()
	if err := pool.QueryRow(context.Background(), sql, args...).Scan(dst); err != nil {
		t.Fatal(err)
	}
}

func chk(t *testing.T, ok bool) {
	t.Helper()
	if !ok {
		t.Fatal("assertion failed")
	}
}
