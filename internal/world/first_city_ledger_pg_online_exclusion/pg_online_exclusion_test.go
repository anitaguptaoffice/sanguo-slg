package firstcityledgerpgonlineexclusion

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

const testRealm = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55"

func onlineEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller {
	return &Controller{Evidence: onlineEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42}
}

func TestPG17FirstCityLedgerOnlineExclusion(t *testing.T) {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" || os.Getenv("FIRST_CITY_LEDGER_TEST_DSN") == "" {
		t.Skip("owned isolated PG17 required: ALLOW_OWNED_PG17_TEST=1 and FIRST_CITY_LEDGER_TEST_DSN")
	}
	ctx := context.Background()
	dsn := os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	admin, err := pgxpool.New(ctx, dsn)
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
		fn  func(*testing.T, *pgxpool.Pool, string, int64, string)
	}{
		{"old_connection_uncommitted_txn_blocked", scOldConnUncommitted},
		{"direct_sql_bypass_intake_fail_closed", scDirectSQLBypass},
		{"independent_nextval_setval_fail_closed", scNextvalSetval},
		{"last_active_txn_no_false_drain", scLastTxnFalseDrain},
		{"lawful_multi_city_not_blocked", scLawfulMultiCity},
	} {
		t.Run(tc.tag, func(t *testing.T) {
			pool, schema, done := freshSchema(t, admin, specDir)
			defer done()
			if err := InstallDisposableFixture(ctx, pool); err != nil {
				t.Fatal(err)
			}
			acct := seed(t, pool)
			tc.fn(t, pool, schema, acct, dsn)
			t.Logf("PASS online_exclusion: %s", tc.tag)
		})
	}
}

func scOldConnUncommitted(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.WriteFullMapping(ctx, pool, acct, schema) == nil)
	chk(t, c.SeedRetention(ctx, pool, acct, "b1111111-1111-4111-8111-111111111111", "保留城", 5, 6) == nil)
	chk(t, SetExclusion(ctx, pool, true) == nil)
	legacy, err := OpenHarnessConn(ctx, dsn, schema)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = legacy.Close(ctx) }()
	tx, err := legacy.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE`)
	if err != nil {
		t.Fatal(err)
	}
	c1b, fct1, sha := canonicalPayload("旧连接城", 7, 8)
	_, bypassErr := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,'b2222222-2222-4222-8222-222222222222'::uuid,$2,$3,1,'t','r','c',1,$4,$5,now())`,
		testRealm, acct, c1b, fct1, sha)
	chk(t, bypassErr != nil)
	rc, _ := c.Counts(ctx, pool)
	chk(t, rc.CommandN == 1 && rc.ProposalN == 1)
	_ = tx.Rollback(ctx)
	rc, _ = c.Counts(ctx, pool)
	chk(t, rc.CommandN == 1 && rc.ProposalN == 1)
}

func scDirectSQLBypass(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, _ string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.WriteFullMapping(ctx, pool, acct, schema) == nil)
	chk(t, c.SeedRetention(ctx, pool, acct, "b1111111-1111-4111-8111-111111111111", "保留城", 5, 6) == nil)
	chk(t, SetExclusion(ctx, pool, true) == nil)
	c1b, fct1, sha := canonicalPayload("伪造", 1, 1)
	_, err := pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,
 success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,1,42,'b4444444-4444-4444-8444-444444444444'::uuid,$2,$3,2,'t','r','c',1,$4,$5,now(),now(),88002,1,42,true,1,100)`,
		testRealm, acct, c1b, fct1, sha)
	chk(t, err != nil)
	rc, _ := c.Counts(ctx, pool)
	chk(t, rc.CommandN == 1 && rc.ProposalN == 1)
}

func scNextvalSetval(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, _ string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.WriteFullMapping(ctx, pool, acct, schema) == nil)
	chk(t, c.SeedRetention(ctx, pool, acct, "b1111111-1111-4111-8111-111111111111", "保留城", 5, 6) == nil)
	chk(t, SetExclusion(ctx, pool, true) == nil)
	_, err := pool.Exec(ctx, `SELECT harness_city_alloc()`)
	chk(t, err != nil)
	_, err = pool.Exec(ctx, `SELECT harness_city_alloc(88100)`)
	chk(t, err != nil)
	var seq int64
	mustRow(t, pool, `SELECT last_value FROM harness_city_queue_alloc_seq`, &seq)
	chk(t, seq == 88000)
	rc, _ := c.Counts(ctx, pool)
	chk(t, rc.CommandN == 1 && rc.ProposalN == 1)
}

func scLastTxnFalseDrain(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.WriteFullMapping(ctx, pool, acct, schema) == nil)
	chk(t, SetExclusion(ctx, pool, true) == nil)
	legacy, err := OpenHarnessConn(ctx, dsn, schema)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = legacy.Close(ctx) }()
	tx, err := legacy.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `SELECT slot FROM harness_legacy_hold WHERE slot=1 FOR UPDATE`)
	if err != nil {
		t.Fatal(err)
	}
	chk(t, BumpLocalDrainCounter(ctx, pool) == nil)
	obs, err := OpenHarnessConn(ctx, dsn, schema)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = obs.Close(ctx) }()
	chk(t, LegacyDrainOpen(ctx, obs))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(ctx, tx, acct, "b5555555-5555-4555-8555-555555555555", nil, "假排空", 11, 12)
	}))
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	chk(t, !LegacyDrainOpen(ctx, obs))
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(ctx, tx, acct, "b6666666-6666-4666-8666-666666666666", nil, "排空后续", 13, 14)
	}))
	rc, _ := c.Counts(ctx, pool)
	chk(t, rc.CommandN == 1 && rc.ProposalN == 1)
}

func scLawfulMultiCity(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, _ string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.WriteFullMapping(ctx, pool, acct, schema) == nil)
	cmd := "b7777777-7777-4777-8777-777777777777"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(ctx, tx, acct, cmd, nil, "首城", 20, 21)
	}))
	mustExec(t, pool, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),success_city_id=88001,
 success_server_id=1,success_player_id=42,success_is_capital=true,success_wall_level=1,success_morale=100 WHERE command_id=$1::uuid`, cmd)
	mustExec(t, pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'首城',20,21,true)`)
	mustExec(t, pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88020,42,'分城',30,31,false)`)
	var n int
	mustRow(t, pool, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`, &n)
	chk(t, n == 2)
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
		return c.TryCommitIntake(ctx, tx, 1, "b1111111-1111-4111-8111-111111111111", nil, "x", 1, 1)
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
	base, err := os.MkdirTemp("", "fc-online-specs-")
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
	schema := fmt.Sprintf("fc_online_%x", time.Now().UnixNano())
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
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('on_u','on_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'on_p')`, acct)
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
