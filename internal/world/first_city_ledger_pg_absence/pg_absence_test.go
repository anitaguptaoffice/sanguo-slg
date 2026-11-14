package firstcityledgerpgabsence

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const testRealm = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33"

func absenceEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller {
	return &Controller{Evidence: absenceEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42}
}

func TestPG17FirstCityLedgerAbsence(t *testing.T) {
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
		{"open_txn_lookup_miss_no_empty_substitute", scOpenMiss},
		{"open_txn_pending_lock_wait_identity", scOpenPending},
		{"continuation_same_lock_reads_original", scContinuation},
		{"unknown_local_cleanup_no_empty_clear", scUnknownNoClear},
	} {
		t.Run(tc.tag, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			if err := InstallDisposableFixture(ctx, pool); err != nil {
				t.Fatal(err)
			}
			acct := seed(t, pool)
			tc.fn(t, pool, acct)
			t.Logf("PASS absence: %s", tc.tag)
		})
	}
}

func scOpenMiss(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmdA, cmdB := "d1111111-1111-4111-8111-111111111111", "d2222222-2222-4222-8222-222222222222"
	hold, done := make(chan struct{}), make(chan struct{})
	go func() {
		conn, err := pool.Acquire(context.Background())
		if err != nil {
			t.Error(err)
			return
		}
		defer conn.Release()
		tx, err := conn.Begin(context.Background())
		if err != nil {
			t.Error(err)
			return
		}
		if err := c.StageOpenCommand(context.Background(), tx, acct, cmdA, "成都", 50, 51); err != nil {
			t.Error(err)
			return
		}
		close(hold)
		time.Sleep(60 * time.Millisecond)
		if err := c.AdvanceHeadEmptyCAS(context.Background(), tx, cmdA); err != nil {
			t.Error(err)
			return
		}
		if err := tx.Commit(context.Background()); err != nil {
			t.Error(err)
			return
		}
		close(done)
	}()
	<-hold
	view, _ := c.LookupDiscover(context.Background(), pool)
	chk(t, view.CommandRows == 0 || view.Head == nil)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmdB, nil, "重庆", 52, 53)
	}))
	<-done
	view, _ = c.LookupDiscover(context.Background(), pool)
	chk(t, view.SlotRows == 1 && view.Head != nil && *view.Head == cmdA && view.CommandRows == 1)
	chk(t, view.CityName == "成都" && view.MapX == 50 && view.MapY == 51)
	chk(t, view.DurableState != nil && *view.DurableState == 1)
}

func scOpenPending(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "d3333333-3333-4333-8333-333333333333"
	hold, done := make(chan struct{}), make(chan struct{})
	go func() {
		conn, err := pool.Acquire(context.Background())
		if err != nil {
			t.Error(err)
			return
		}
		defer conn.Release()
		tx, err := conn.Begin(context.Background())
		if err != nil {
			t.Error(err)
			return
		}
		if err := c.StageOpenCommand(context.Background(), tx, acct, cmd, "荆州", 60, 61); err != nil {
			t.Error(err)
			return
		}
		if err := c.SetHeadInOpenTxn(context.Background(), tx, cmd); err != nil {
			t.Error(err)
			return
		}
		close(hold)
		time.Sleep(70 * time.Millisecond)
		if err := tx.Commit(context.Background()); err != nil {
			t.Error(err)
			return
		}
		close(done)
	}()
	<-hold
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
			return c.ContinuationRead(context.Background(), tx, cmd)
		}))
	}()
	wg.Wait()
	<-done
	view, _ := c.LookupDiscover(context.Background(), pool)
	chk(t, view.Head != nil && *view.Head == cmd && view.CityName == "荆州" && view.MapX == 60 && view.MapY == 61)
	chk(t, view.DurableState != nil && *view.DurableState == 1)
}

func scContinuation(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "d4444444-4444-4444-8444-444444444444"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "武昌", 70, 71)
	}))
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.ContinuationRead(context.Background(), tx, cmd)
	}))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "d5555555-5555-4555-8555-555555555555", nil, "江陵", 72, 73)
	}))
}

func scUnknownNoClear(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "d6666666-6666-4666-8666-666666666666"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "襄阳", 80, 81)
	}))
	chk(t, c.MarkUnknownSide(context.Background(), pool, cmd) == nil)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		if err := c.SimulateLocalCleanup(context.Background(), pool, cmd); err != nil {
			return false, err
		}
		return c.ContinuationRead(context.Background(), tx, cmd)
	}))
	_ = c.SimulateLocalCleanup(context.Background(), pool, cmd)
	h, _ := c.Head(context.Background(), pool)
	chk(t, h == cmd)
	var st int16
	mustRow(t, pool, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, &st, cmd)
	chk(t, st == 1)
	var ending string
	mustRow(t, pool, `SELECT source_ending FROM harness_absence_side WHERE command_id=$1`, &ending, cmd)
	chk(t, ending == "unknown")
	sum, _ := c.BizSum(context.Background(), pool)
	chk(t, sum == 0)
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
	if err := InstallDisposableFixture(ctx, pool); err != nil {
		t.Fatal(err)
	}
	seed(t, pool)
	c := &Controller{RealmID: testRealm, ServerID: 1, PlayerID: 42}
	ok, err := withConnErr(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, 1, "d1111111-1111-4111-8111-111111111111", nil, "x", 1, 1)
	})
	if ok || err != ErrUnauthorized {
		t.Fatalf("fail-closed: ok=%v err=%v", ok, err)
	}
	sum, _ := c.BizSum(context.Background(), pool)
	if sum != 0 {
		t.Fatalf("observer: biz=%d", sum)
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
	base, err := os.MkdirTemp("", "fc-absence-specs-")
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
	schema := fmt.Sprintf("fc_absence_%x", time.Now().UnixNano())
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
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('abs_u','abs_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'abs_p')`, acct)
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
