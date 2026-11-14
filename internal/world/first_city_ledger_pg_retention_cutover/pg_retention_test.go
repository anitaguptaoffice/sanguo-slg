package firstcityledgerpgretentioncutover

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

const testRealm = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e44"

func retentionEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller {
	return &Controller{Evidence: retentionEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42}
}

func TestPG17FirstCityLedgerRetentionCutover(t *testing.T) {
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
		fn  func(*testing.T, *pgxpool.Pool, int64)
	}{
		{"succeeded_delete_transfer_no_empty_reopen", scSucceededDeleteTransfer},
		{"rejection_reset_no_empty_initial", scRejectionReset},
		{"account_rebind_fail_closed", scAccountRebind},
		{"incomplete_restore_no_autofill_no_empty", func(t *testing.T, pool *pgxpool.Pool, acct int64) {
			scIncompleteRestore(t, admin, specDir, pool, acct)
		}},
		{"lawful_multi_city_not_blocked", scLawfulMultiCity},
	} {
		t.Run(tc.tag, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			if err := InstallDisposableFixture(ctx, pool); err != nil {
				t.Fatal(err)
			}
			acct := seed(t, pool)
			tc.fn(t, pool, acct)
			t.Logf("PASS retention: %s", tc.tag)
		})
	}
}

func scSucceededDeleteTransfer(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "f1111111-1111-4111-8111-111111111111"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "长安", 10, 11)
	}))
	chk(t, c.MarkTerminal(context.Background(), pool, cmd, 2) == nil)
	mustExec(t, pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'长安',10,11,true)`)
	mustExec(t, pool, `DELETE FROM player_city WHERE server_id=1 AND city_id=88001`)
	mustExec(t, pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88002,999,'迁出城',99,99,false)`)
	v, _ := c.Observe(context.Background(), pool, cmd)
	chk(t, v.Head == cmd && v.DurableState == 2 && v.CityName == "长安" && v.CommandCount == 1)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "f2222222-2222-4222-8222-222222222222", nil, "新城", 12, 13)
	}))
}

func scRejectionReset(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "f3333333-3333-4333-8333-333333333333"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "拒城", 20, 21)
	}))
	chk(t, c.MarkTerminal(context.Background(), pool, cmd, 3) == nil)
	chk(t, c.SimulateHeadReset(context.Background(), pool) == nil)
	v, _ := c.Observe(context.Background(), pool, cmd)
	chk(t, v.CommandCount == 1 && v.DurableState == 3)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "f4444444-4444-4444-8444-444444444444", nil, "清后新城", 22, 23)
	}))
	st, _ := c.CommandState(context.Background(), pool, cmd)
	chk(t, st == 3)
}

func scAccountRebind(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "f5555555-5555-4555-8555-555555555555"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "绑城", 30, 31)
	}))
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('ret_u2','h2',1)`)
	var acct2 int64
	mustRow(t, pool, `SELECT account_id FROM account WHERE login_name='ret_u2'`, &acct2)
	mustExec(t, pool, `UPDATE player SET account_id=$1 WHERE server_id=1 AND player_id=42`, acct2)
	v, _ := c.Observe(context.Background(), pool, cmd)
	chk(t, v.Head == cmd && v.DurableState == 1 && v.CityName == "绑城" && v.CommandCount == 1)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct2, "f6666666-6666-4666-8666-666666666666", nil, "新绑", 32, 33)
	}))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "f7777777-7777-4777-8777-777777777777", nil, "旧绑", 34, 35)
	}))
}

func scIncompleteRestore(t *testing.T, admin *pgxpool.Pool, specDir string, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "f8888888-8888-4888-8888-888888888888"
	chk(t, c.SeedOrphanCommand(context.Background(), pool, acct, cmd, "恢城", 40, 41) == nil)
	var cmds int
	mustRow(t, pool, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, &cmds, cmd)
	chk(t, cmds == 1)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "f9999999-9999-4999-8999-999999999999", nil, "补写", 42, 43)
	}))
	mustExec(t, pool, `UPDATE harness_retention_integrity SET restore_provenance_ok=false`)
	runFresh := func(prep func(*pgxpool.Pool), cmdID, name string, x, y int) {
		pool2, done := freshSchema(t, admin, specDir)
		defer done()
		_ = InstallDisposableFixture(context.Background(), pool2)
		acct2 := seed(t, pool2)
		prep(pool2)
		chk(t, !withConn(pool2, func(tx pgx.Tx) (bool, error) {
			return c.TryCommitIntake(context.Background(), tx, acct2, cmdID, nil, name, x, y)
		}))
	}
	runFresh(func(p *pgxpool.Pool) {
		mustExec(t, p, `UPDATE harness_retention_integrity SET migration_digest_only=true`)
	}, "faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "digest", 1, 2)
	runFresh(func(p *pgxpool.Pool) {
		mustExec(t, p, `UPDATE harness_retention_integrity SET migration_digest_only=false, template_catalog_ok=false`)
	}, "fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "lost tmpl", 3, 4)
	runFresh(func(p *pgxpool.Pool) {
		mustExec(t, p, `UPDATE harness_retention_integrity SET template_catalog_ok=true`)
		mustExec(t, p, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y) VALUES (1,90001,42,'legacy',5,6)`)
		mustExec(t, p, `UPDATE harness_retention_integrity SET allocator_highwater=100`)
	}, "fccccccc-cccc-4ccc-8ccc-cccccccccccc", "zero city", 7, 8)
}

func scLawfulMultiCity(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "fddddddd-dddd-4ddd-8ddd-dddddddddddd"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "首城", 50, 51)
	}))
	chk(t, c.MarkTerminal(context.Background(), pool, cmd, 2) == nil)
	mustExec(t, pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'首城',50,51,true)`)
	mustExec(t, pool, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88010,42,'分城',60,61,false)`)
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
	pool, done := freshSchema(t, admin, specDir)
	defer done()
	_ = InstallDisposableFixture(ctx, pool)
	seed(t, pool)
	c := &Controller{RealmID: testRealm, ServerID: 1, PlayerID: 42}
	ok, err := withConnErr(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, 1, "f1111111-1111-4111-8111-111111111111", nil, "x", 1, 1)
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
	base, err := os.MkdirTemp("", "fc-retention-specs-")
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

func freshSchema(t *testing.T, admin *pgxpool.Pool, specDir string) (*pgxpool.Pool, func()) {
	ctx := context.Background()
	schema := fmt.Sprintf("fc_retention_%x", time.Now().UnixNano())
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
	return pool, func() { pool.Close(); _, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") }
}

func seed(t *testing.T, pool *pgxpool.Pool) int64 {
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('ret_u','ret_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'ret_p')`, acct)
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
