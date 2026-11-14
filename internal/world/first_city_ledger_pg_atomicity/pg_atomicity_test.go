package firstcityledgerpgatomicity

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
const testCmd = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

func atomicEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller {
	return &Controller{
		Evidence: atomicEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42, CmdID: testCmd,
		Placement: Placement{CityID: DefaultCityID, MapX: DefaultMapX, MapY: DefaultMapY},
	}
}

func TestPG17FirstCityLedgerAtomicity(t *testing.T) {
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
		label string
		fn    func(*testing.T, *pgxpool.Pool)
	}{
		{"wallet barrier before WORLD", scWallet},
		{"WORLD INSERT before MIL", scWorld},
		{"MIL incomplete before DOM", scMIL},
		{"DOM incomplete before receipt", scDOM},
		{"receipt staged then ROLLBACK before COMMIT", scReceipt},
		{"forbidden rejection append ends in ROLLBACK not COMMIT", scForbiddenReject},
	} {
		t.Run(strings.ReplaceAll(tc.label, " ", "_"), func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			if err := InstallDisposableFixture(ctx, pool); err != nil {
				t.Fatal(err)
			}
			seedPending(t, pool)
			tc.fn(t, pool)
			t.Logf("PASS atomicity: %s", tc.label)
		})
	}
}

func scWallet(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	if err := c.RollbackBarrierTxn(context.Background(), pool, func(tx pgx.Tx) error {
		return c.WalletStep(context.Background(), tx)
	}); err != nil {
		t.Fatal(err)
	}
	assertObserver(t, c, pool)
}

func scWorld(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	if err := c.RollbackBarrierTxn(context.Background(), pool, func(tx pgx.Tx) error {
		if err := c.WalletStep(context.Background(), tx); err != nil {
			return err
		}
		return c.WorldStep(context.Background(), tx)
	}); err != nil {
		t.Fatal(err)
	}
	assertObserver(t, c, pool)
}

func scMIL(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	if err := c.RollbackBarrierTxn(context.Background(), pool, func(tx pgx.Tx) error {
		if err := c.WalletStep(context.Background(), tx); err != nil {
			return err
		}
		if err := c.WorldStep(context.Background(), tx); err != nil {
			return err
		}
		return c.MilOriginOnlyStep(context.Background(), tx)
	}); err != nil {
		t.Fatal(err)
	}
	assertObserver(t, c, pool)
}

func scDOM(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	if err := c.RollbackBarrierTxn(context.Background(), pool, func(tx pgx.Tx) error {
		if err := c.WalletStep(context.Background(), tx); err != nil {
			return err
		}
		if err := c.WorldStep(context.Background(), tx); err != nil {
			return err
		}
		if err := c.MilStep(context.Background(), tx); err != nil {
			return err
		}
		return c.DomCheckpointOnlyStep(context.Background(), tx)
	}); err != nil {
		t.Fatal(err)
	}
	assertObserver(t, c, pool)
}

func scReceipt(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	if err := c.RollbackBarrierTxn(context.Background(), pool, func(tx pgx.Tx) error {
		if err := c.WalletStep(context.Background(), tx); err != nil {
			return err
		}
		if err := c.WorldStep(context.Background(), tx); err != nil {
			return err
		}
		if err := c.MilStep(context.Background(), tx); err != nil {
			return err
		}
		if err := c.DomStep(context.Background(), tx); err != nil {
			return err
		}
		return c.ReceiptStep(context.Background(), tx)
	}); err != nil {
		t.Fatal(err)
	}
	assertObserver(t, c, pool)
}

func scForbiddenReject(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	if err := c.RollbackBarrierTxn(context.Background(), pool, func(tx pgx.Tx) error {
		if err := c.WalletStep(context.Background(), tx); err != nil {
			return err
		}
		if err := c.WorldStep(context.Background(), tx); err != nil {
			return err
		}
		return c.ForbiddenRejectInTxn(context.Background(), tx)
	}); err != nil {
		t.Fatal(err)
	}
	assertObserver(t, c, pool)
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
	seedPending(t, pool)
	c := &Controller{RealmID: testRealm, ServerID: 1, PlayerID: 42, CmdID: testCmd}
	err = c.RollbackBarrierTxn(context.Background(), pool, func(tx pgx.Tx) error {
		return c.WalletStep(context.Background(), tx)
	})
	if err != ErrUnauthorized {
		t.Fatalf("fail-closed: err=%v", err)
	}
}

func assertObserver(t *testing.T, c *Controller, pool *pgxpool.Pool) {
	t.Helper()
	if err := c.AssertRollbackObserver(context.Background(), pool); err != nil {
		t.Fatal(err)
	}
}

func seedPending(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	c1, fct1, sha := `\x01`, `\x`+strings.Repeat("00", 52), `\x`+strings.Repeat("ab", 32)
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('at_u','at_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'at_p')`, acct)
	mustExec(t, pool, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,4)`, DefaultMapX, DefaultMapY)
	mustExec(t, pool, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ('%s'::uuid,1,42,'%s'::uuid,$1,'%s',1,'t','r','c',1,'%s','%s',now())`,
		testRealm, testCmd, c1, fct1, sha), acct)
	mustExec(t, pool, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ('%s'::uuid,1,42,$1,'%s'::uuid)`, testRealm, testCmd), acct)
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-atomicity-specs-")
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
	schema := fmt.Sprintf("fc_at_%x", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, _ := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "5s"
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
