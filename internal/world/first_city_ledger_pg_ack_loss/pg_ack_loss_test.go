package firstcityledgerpgackloss

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

const testRealm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

func ackEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller {
	return &Controller{
		Evidence: ackEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42,
		Placement: Placement{CityID: DefaultCityID, MapX: DefaultMapX, MapY: DefaultMapY},
	}
}

func TestPG17FirstCityLedgerAckLoss(t *testing.T) {
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
		name string
		fn   func(*testing.T, *pgxpool.Pool, string)
	}{
		{"pending_intake_restart_readback_no_biz", scPendingRestart},
		{"pre_commit_disconnect_no_partial_row", scPreCommitDisconnect},
		{"intake_commit_ack_loss_no_second_insert", scIntakeAckLoss},
		{"effect_commit_ack_loss_observer_no_double", scEffectAckLoss},
		{"finalizer_reject_ack_loss_no_city", scFinalizerAckLoss},
		{"competitor_ack_loss_no_double_success", scCompetitorAckLoss},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pool, schema, done := freshSchema(t, admin, specDir)
			defer done()
			if err := InstallDisposableFixture(ctx, pool); err != nil {
				t.Fatal(err)
			}
			tc.fn(t, pool, schema)
		})
	}
}

func scPendingRestart(t *testing.T, pool *pgxpool.Pool, schema string) {
	c := ctl()
	cmd := "a1111111-1111-4111-8111-111111111111"
	acct := seedAcctMap(t, pool)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitIntakeInitial(context.Background(), tx, acct, cmd) }))
	peer := peerPool(t, schema, 2)
	defer peer.Close()
	snap, err := c.ReadCommand(context.Background(), peer, cmd)
	if err != nil {
		t.Fatal(err)
	}
	sum, _ := c.BusinessRowSum(context.Background(), peer)
	chk(t, snap.DurableState == 1 && snap.ContentSHA == strings.Repeat("ab", 32) && sum == 0)
}

func scPreCommitDisconnect(t *testing.T, pool *pgxpool.Pool, _ string) {
	c := ctl()
	cmd := "a2222222-2222-4222-8222-222222222222"
	acct := seedAcctMap(t, pool)
	err := abortConn(pool, func(tx pgx.Tx) error {
		return c.RollbackIntakeBeforeCommit(context.Background(), tx, acct, cmd)
	})
	if err != nil {
		t.Fatal(err)
	}
	var n int
	mustRow(t, pool, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, &n, cmd)
	chk(t, n == 0)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitIntakeInitial(context.Background(), tx, acct, cmd) }))
	mustRow(t, pool, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, &n, cmd)
	sum, _ := c.BusinessRowSum(context.Background(), pool)
	chk(t, n == 1 && sum == 0)
}

func scIntakeAckLoss(t *testing.T, pool *pgxpool.Pool, schema string) {
	c := ctl()
	cmd := "a3333333-3333-4333-8333-333333333333"
	acct := seedAcctMap(t, pool)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitIntakeInitial(context.Background(), tx, acct, cmd) }))
	peer := peerPool(t, schema, 2)
	defer peer.Close()
	snap, _ := c.ReadCommand(context.Background(), peer, cmd)
	chk(t, snap.DurableState == 1)
	chk(t, !withConn(peer, func(tx pgx.Tx) (bool, error) { return c.CommitIntakeInitial(context.Background(), tx, acct, cmd) }))
	dup := withConn(peer, func(tx pgx.Tx) (bool, error) { return c.TryDuplicateIntakeInsert(context.Background(), tx, acct, cmd) })
	chk(t, !dup)
	sum, _ := c.BusinessRowSum(context.Background(), peer)
	chk(t, sum == 0)
}

func scEffectAckLoss(t *testing.T, pool *pgxpool.Pool, schema string) {
	c := ctl()
	cmd := "a4444444-4444-4444-8444-444444444444"
	acct := seedAcctMap(t, pool)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitIntakeInitial(context.Background(), tx, acct, cmd) }))
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitEffect(context.Background(), tx, cmd) }))
	obs := peerPool(t, schema, 2)
	defer obs.Close()
	snap, _ := c.ReadCommand(context.Background(), obs, cmd)
	sum, _ := c.BusinessRowSum(context.Background(), obs)
	chk(t, snap.DurableState == 2 && sum == 6)
	chk(t, !withConn(obs, func(tx pgx.Tx) (bool, error) { return c.CommitEffect(context.Background(), tx, cmd) }))
}

func scFinalizerAckLoss(t *testing.T, pool *pgxpool.Pool, schema string) {
	c := ctl()
	cmd := "a5555555-5555-4555-8555-555555555555"
	acct := seedAcctMap(t, pool)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitIntakeInitial(context.Background(), tx, acct, cmd) }))
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitFinalizerReject(context.Background(), tx, cmd) }))
	peer := peerPool(t, schema, 2)
	defer peer.Close()
	snap, _ := c.ReadCommand(context.Background(), peer, cmd)
	sum, _ := c.BusinessRowSum(context.Background(), peer)
	chk(t, snap.DurableState == 3 && sum == 0)
	chk(t, !withConn(peer, func(tx pgx.Tx) (bool, error) { return c.CommitFinalizerReject(context.Background(), tx, cmd) }))
}

func scCompetitorAckLoss(t *testing.T, pool *pgxpool.Pool, schema string) {
	c := ctl()
	cmd := "a6666666-6666-4666-8666-666666666666"
	acct := seedAcctMap(t, pool)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitIntakeInitial(context.Background(), tx, acct, cmd) }))
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) { return c.CommitEffect(context.Background(), tx, cmd) }))
	peer := peerPool(t, schema, 2)
	defer peer.Close()
	chk(t, !withConn(peer, func(tx pgx.Tx) (bool, error) { return c.CommitEffect(context.Background(), tx, cmd) }))
	chk(t, !withConn(peer, func(tx pgx.Tx) (bool, error) { return c.CommitFinalizerReject(context.Background(), tx, cmd) }))
	sum, _ := c.BusinessRowSum(context.Background(), peer)
	chk(t, sum == 6)
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
	if err := InstallDisposableFixture(ctx, pool); err != nil {
		t.Fatal(err)
	}
	c := &Controller{RealmID: testRealm, ServerID: 1, PlayerID: 42}
	ok, err := withConnErr(pool, func(tx pgx.Tx) (bool, error) {
		return c.CommitIntakeInitial(context.Background(), tx, 1, "b1111111-1111-4111-8111-111111111111")
	})
	if ok || err != ErrUnauthorized {
		t.Fatalf("fail-closed: ok=%v err=%v", ok, err)
	}
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

func peerPool(t *testing.T, schema string, max int) *pgxpool.Pool {
	t.Helper()
	cfg, err := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = int32(max)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	p, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-ack-specs-")
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
	schema := fmt.Sprintf("fc_ack_%x", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, _ := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.ApplySpecs(ctx, pool, specDir); err != nil {
		t.Fatal(err)
	}
	return pool, schema, func() { pool.Close(); _, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") }
}

func seedAcctMap(t *testing.T, pool *pgxpool.Pool) int64 {
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('ack_u','ack_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'ack_p')`, acct)
	mustExec(t, pool, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,4)`, DefaultMapX, DefaultMapY)
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
