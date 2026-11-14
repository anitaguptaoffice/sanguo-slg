package firstcityledgerpginitial

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

const testRealm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

func initialEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller {
	return &Controller{Evidence: initialEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42}
}

func TestPG17FirstCityLedgerInitial(t *testing.T) {
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
		{"old_intake_ack_loss_readback_reject_empty", scAckLoss},
		{"new_first_late_old_no_regress", scNewWinsLateOld},
		{"open_intake_commit_single_winner", scOpenCommit},
		{"open_intake_rollback_fresh_empty", scOpenRollback},
		{"reject_successor_exact_pred", scRejectSuccessor},
		{"no_lineage_empty_once", scEmptyAllowed},
		{"dual_proposal_canonical_winner", scDualProposal},
		{"pending_rejects_empty", scPendingRejectsEmpty},
		{"succeeded_rejects_empty", scSucceededRejectsEmpty},
		{"rejection_rejects_empty", scRejectionRejectsEmpty},
	} {
		t.Run(tc.tag, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			if err := InstallDisposableFixture(ctx, pool); err != nil {
				t.Fatal(err)
			}
			acct := seed(t, pool)
			tc.fn(t, pool, acct)
			t.Logf("PASS initial: %s", tc.tag)
		})
	}
}

func scAckLoss(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "b1111111-1111-4111-8111-111111111111"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "洛阳", 12, 34)
	}))
	prop, _ := c.ReadProposal(context.Background(), pool, cmd)
	chk(t, prop.CityName == "洛阳" && prop.MapX == 12 && prop.MapY == 34)
	sum, _ := c.BizSum(context.Background(), pool)
	chk(t, sum == 0)
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "b2222222-2222-4222-8222-222222222222", nil, "许昌", 1, 2)
	}))
}

func scNewWinsLateOld(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	newID, oldID := "b3333333-3333-4333-8333-333333333333", "b4444444-4444-4444-8444-444444444444"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TryCommitIntake(context.Background(), tx, acct, newID, nil, "建业", 40, 41) }))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TryCommitIntake(context.Background(), tx, acct, oldID, nil, "庐江", 2, 3) }))
	n, _ := c.CommandCount(context.Background(), pool, oldID)
	h, _ := c.Head(context.Background(), pool)
	sum, _ := c.BizSum(context.Background(), pool)
	chk(t, n == 0 && h == newID && sum == 0)
}

func scOpenCommit(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmdA, cmdB := "b5555555-5555-4555-8555-555555555555", "b6666666-6666-4666-8666-666666666666"
	hold := make(chan struct{})
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
		if err := c.StageCommandOnly(context.Background(), tx, acct, cmdA, "武昌", 7, 8); err != nil {
			t.Error(err)
			return
		}
		close(hold)
		time.Sleep(80 * time.Millisecond)
		if err := c.AdvanceHeadEmptyCAS(context.Background(), tx, cmdA); err != nil {
			t.Error(err)
			return
		}
		if err := tx.Commit(context.Background()); err != nil {
			t.Error(err)
		}
	}()
	<-hold
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmdB, nil, "江陵", 9, 10)
	}))
	h, _ := c.Head(context.Background(), pool)
	chk(t, h == cmdA)
}

func scOpenRollback(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "b7777777-7777-4777-8777-777777777777"
	err := abortConn(pool, func(tx pgx.Tx) error {
		return c.StageCommandOnly(context.Background(), tx, acct, cmd, "襄阳", 11, 12)
	})
	if err != nil {
		t.Fatal(err)
	}
	n, _ := c.CommandCount(context.Background(), pool, cmd)
	chk(t, n == 0)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "襄阳", 11, 12)
	}))
}

func scRejectSuccessor(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmdA, cmdB := "b8888888-8888-4888-8888-888888888888", "b9999999-9999-4999-8999-999999999999"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TryCommitIntake(context.Background(), tx, acct, cmdA, nil, "汉中", 3, 4) }))
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TerminatePending(context.Background(), tx, cmdA, 3) }))
	h, _ := c.Head(context.Background(), pool)
	chk(t, h == cmdA)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TryCommitIntake(context.Background(), tx, acct, cmdB, &cmdA, "益州", 5, 6) }))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", nil, "幽州", 1, 1)
	}))
	bad := "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "bccccccc-cccc-4ccc-8ccc-cccccccccccc", &bad, "并州", 2, 2)
	}))
	h, _ = c.Head(context.Background(), pool)
	chk(t, h == cmdB)
}

func scEmptyAllowed(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmd := "bddddddd-dddd-4ddd-8ddd-dddddddddddd"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, cmd, nil, "空城提案", 20, 21)
	}))
	st, _ := c.DurableState(context.Background(), pool, cmd)
	sum, _ := c.BizSum(context.Background(), pool)
	chk(t, st == 1 && sum == 0)
}

func scDualProposal(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	cmdA, cmdB := "beeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "bfffffff-ffff-4fff-8fff-ffffffffffff"
	begin := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	okA, okB := false, false
	go func() {
		defer wg.Done()
		<-begin
		okA = withConn(pool, func(tx pgx.Tx) (bool, error) {
			return c.TryCommitIntake(context.Background(), tx, acct, cmdA, nil, "甲城", 30, 31)
		})
	}()
	go func() {
		defer wg.Done()
		<-begin
		okB = withConn(pool, func(tx pgx.Tx) (bool, error) {
			return c.TryCommitIntake(context.Background(), tx, acct, cmdB, nil, "乙城", 32, 33)
		})
	}()
	close(begin)
	wg.Wait()
	sum, _ := c.BizSum(context.Background(), pool)
	chk(t, (okA != okB) && sum == 0)
	win, lose := cmdA, cmdB
	if okB {
		win, lose = cmdB, cmdA
	}
	n, _ := c.CommandCount(context.Background(), pool, lose)
	h, _ := c.Head(context.Background(), pool)
	chk(t, n == 0 && h == win)
	prop, _ := c.ReadProposal(context.Background(), pool, win)
	chk(t, prop.CityName != "" && prop.MapX > 0 && prop.MapY > 0)
	pend, _ := c.PendingCount(context.Background(), pool)
	chk(t, pend == 1)
}

func scPendingRejectsEmpty(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	p := "c1111111-1111-4111-8111-111111111111"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TryCommitIntake(context.Background(), tx, acct, p, nil, "p", 1, 2) }))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "c2222222-2222-4222-8222-222222222222", nil, "x", 3, 4)
	}))
}

func scSucceededRejectsEmpty(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	s := "c3333333-3333-4333-8333-333333333333"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TryCommitIntake(context.Background(), tx, acct, s, nil, "s", 5, 6) }))
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TerminatePending(context.Background(), tx, s, 2) }))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "c4444444-4444-4444-8444-444444444444", nil, "y", 7, 8)
	}))
}

func scRejectionRejectsEmpty(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c := ctl()
	r := "c5555555-5555-4555-8555-555555555555"
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TryCommitIntake(context.Background(), tx, acct, r, nil, "r", 9, 10) }))
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.TerminatePending(context.Background(), tx, r, 3) }))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitIntake(context.Background(), tx, acct, "c6666666-6666-4666-8666-666666666666", nil, "z", 11, 12)
	}))
	h, _ := c.Head(context.Background(), pool)
	chk(t, h == r)
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
		return c.TryCommitIntake(context.Background(), tx, 1, "b1111111-1111-4111-8111-111111111111", nil, "x", 1, 1)
	})
	if ok || err != ErrUnauthorized {
		t.Fatalf("fail-closed: ok=%v err=%v", ok, err)
	}
	sum, _ := c.BizSum(context.Background(), pool)
	n, _ := c.CommandCount(context.Background(), pool, "b1111111-1111-4111-8111-111111111111")
	if sum != 0 || n != 0 {
		t.Fatalf("observer: biz=%d cmd=%d", sum, n)
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

func abortConn(pool *pgxpool.Pool, fn func(pgx.Tx) error) error {
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	return tx.Rollback(ctx)
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-initial-specs-")
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
	schema := fmt.Sprintf("fc_initial_%x", time.Now().UnixNano())
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
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('ini_u','ini_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'ini_p')`, acct)
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
