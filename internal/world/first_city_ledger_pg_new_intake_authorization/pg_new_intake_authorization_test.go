package firstcityledgerpgnewintakeauthorization

import (
	"bytes"
	"context"
	"fmt"
	"os"
	osexec "os/exec"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testRealm      = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e66"
	workerPkg      = "./spec/db/tests/first_city_ledger_new_intake_authorization/new_ledger_route_worker"
	retainedCmd    = "d2222222-2222-4222-8222-222222222222"
	retainedCityID = int64(88101)
)

func niaEvidenceAll() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func niaEvidenceProfileOnly() firstcityledgerpgintake.ObligationEvidence {
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true}
}

func ctl(ev firstcityledgerpgintake.ObligationEvidence) *Controller {
	return &Controller{Evidence: ev, RealmID: testRealm, ServerID: 1, PlayerID: 42}
}

func TestPG17FirstCityLedgerNewIntakeAuthorization(t *testing.T) {
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
	t.Log("new_ledger_route_entry:", workerPkg, "(harness new_ledger_route_worker; not_production_route=true)")
	if err := admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major); err != nil {
		t.Fatal(err)
	}
	if major != "17" {
		t.Fatalf("PostgreSQL 17 required; got %s", ver)
	}
	repoRoot := findRepoRoot(t)
	workerBin := buildNiaWorker(t, repoRoot)
	specDir := stageSpecs(t, repoRoot)
	defer func() { _ = os.RemoveAll(specDir) }()
	for _, tc := range []struct {
		tag string
		fn  func(*testing.T, *pgxpool.Pool, string, int64, string, string)
	}{
		{"incomplete_profile_or_inventory_keeps_closed", scIncompleteClosed},
		{"substitute_fence_not_authorization", scSubstituteFence},
		{"partial_drain_not_partial_enablement", scPartialDrain},
		{"unauthorized_intake_no_empty_reopen_or_id_reuse", scNoEmptyReuse},
		{"lawful_multi_city_not_blocked", scLawfulMultiCity},
	} {
		t.Run(tc.tag, func(t *testing.T) {
			pool, schema, done := freshSchema(t, admin, specDir, dsn)
			defer done()
			installMapCells(t, pool)
			if err := InstallDisposableFixture(ctx, pool, testRealm); err != nil {
				t.Fatal(err)
			}
			acct := seed(t, pool)
			tc.fn(t, pool, schema, acct, dsn, workerBin)
			t.Logf("PASS new_intake_authorization: %s", tc.tag)
		})
	}
}

func scIncompleteClosed(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl(firstcityledgerpgintake.ObligationEvidence{})
	chk(t, c.SyncObligationsToDB(ctx, pool, acct, schema) == nil)
	out := runWorker(t, repoRootFromWD(), workerBin, dsn, schema, "commit", "未授权首城", "a1111111-1111-4111-8111-111111111111", 11, 12, true, 88211, "")
	rc, err := c.Counts(ctx, pool)
	chk(t, err == nil && rc.PlayerCityN == 0 && strings.Contains(out, "NIA_ERR"))
}

func scSubstituteFence(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl(niaEvidenceProfileOnly())
	chk(t, c.SyncObligationsToDB(ctx, pool, acct, schema) == nil)
	chk(t, BumpLocalDrainCounter(ctx, pool, 99) == nil)
	obs, err := OpenHarnessConn(ctx, dsn, schema)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = obs.Close(ctx) }()
	held, err := TryHoldRowLockObserver(ctx, obs)
	chk(t, err == nil && held)
	out := runWorker(t, repoRootFromWD(), workerBin, dsn, schema, "commit", "替代围栏", "a2222222-2222-4222-8222-222222222222", 11, 12, true, 88212, "")
	_, _ = obs.Exec(ctx, `ROLLBACK`)
	chk(t, strings.Contains(out, "NIA_ERR"))
}

func scPartialDrain(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl(niaEvidenceProfileOnly())
	chk(t, c.SyncObligationsToDB(ctx, pool, acct, schema) == nil)
	chk(t, SetInventoryDrainUpTo(ctx, pool, 10, true) == nil)
	out := runWorker(t, repoRootFromWD(), workerBin, dsn, schema, "commit", "部分排空", "a3333333-3333-4333-8333-333333333333", 11, 12, true, 88213, "")
	chk(t, strings.Contains(out, "NIA_ERR"))
}

func scNoEmptyReuse(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl(niaEvidenceAll())
	chk(t, c.SyncObligationsToDB(ctx, pool, acct, schema) == nil)
	chk(t, c.SeedRetention(ctx, pool, acct, retainedCmd, "保留城", 5, 6, retainedCityID) == nil)
	_, err := pool.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=NULL WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, testRealm)
	chk(t, err != nil)
	head, err := c.HeadCommandID(ctx, pool)
	chk(t, err == nil && head == retainedCmd)
	hw, err := c.AllocatorHighwater(ctx, pool)
	chk(t, err == nil && hw == retainedCityID)
	out := runWorker(t, repoRootFromWD(), workerBin, dsn, schema, "commit", "未授权", "a4444444-4444-4444-8444-444444444444", 11, 12, true, 88214, "")
	hwAfter, _ := c.AllocatorHighwater(ctx, pool)
	chk(t, strings.Contains(out, "NIA_ERR") && hwAfter == retainedCityID)
}

func scLawfulMultiCity(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl(niaEvidenceAll())
	chk(t, c.SyncObligationsToDB(ctx, pool, acct, schema) == nil)
	chk(t, c.SeedRetention(ctx, pool, acct, retainedCmd, "保留城", 5, 6, retainedCityID) == nil)
	out := runWorker(t, repoRootFromWD(), workerBin, dsn, schema, "commit", "分城", "a5555555-5555-4555-8555-555555555555", 30, 31, false, 88301, "")
	rc, err := c.Counts(ctx, pool)
	chk(t, err == nil && strings.Contains(out, "NIA_COMMITTED") && rc.PlayerCityN == 2)
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
	repoRoot := findRepoRoot(t)
	specDir := stageSpecs(t, repoRoot)
	defer func() { _ = os.RemoveAll(specDir) }()
	pool, schema, done := freshSchema(t, admin, specDir, os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	defer done()
	installMapCells(t, pool)
	_ = InstallDisposableFixture(ctx, pool, testRealm)
	acct := seed(t, pool)
	c := &Controller{RealmID: testRealm, ServerID: 1, PlayerID: 42}
	if err := c.SeedRetention(ctx, pool, acct, retainedCmd, "x", 1, 1, retainedCityID); err != ErrUnauthorized {
		t.Fatalf("SeedRetention fail-closed: %v", err)
	}
	if err := c.SyncObligationsToDB(ctx, pool, acct, schema); err != nil {
		t.Fatal(err)
	}
	var ok bool
	if err := pool.QueryRow(ctx, `SELECT harness_nia_route_authorized()`).Scan(&ok); err != nil || ok {
		t.Fatalf("route still closed without obligations: ok=%v err=%v", ok, err)
	}
}

func workerEnv(dsn, schema, mode, name, cmdID string, x, y int, capital bool, cityID int64) []string {
	cap := "0"
	if capital {
		cap = "1"
	}
	return append(os.Environ(), "GOTOOLCHAIN=local", "HARNESS_DSN="+dsn, "HARNESS_SCHEMA="+schema,
		"HARNESS_MODE="+mode, "HARNESS_NAME="+name, "HARNESS_IS_CAPITAL="+cap, "HARNESS_CMD_ID="+cmdID,
		fmt.Sprintf("HARNESS_X=%d", x), fmt.Sprintf("HARNESS_Y=%d", y), fmt.Sprintf("HARNESS_CITY_ID=%d", cityID))
}

func runWorker(t *testing.T, repoRoot, workerBin, dsn, schema, mode, name, cmdID string, x, y int, capital bool, cityID int64, _ string) string {
	t.Helper()
	cmd := osexec.Command(workerBin)
	cmd.Dir, cmd.Env = repoRoot, workerEnv(dsn, schema, mode, name, cmdID, x, y, capital, cityID)
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	_ = cmd.Run()
	return out.String()
}

func buildNiaWorker(t *testing.T, repoRoot string) string {
	t.Helper()
	bin := filepath.Join(os.TempDir(), "fc_new_ledger_route_worker_pkg_bin")
	bld := osexec.Command("go", "build", "-o", bin, workerPkg)
	bld.Dir, bld.Env = repoRoot, append(os.Environ(), "GOTOOLCHAIN=local")
	if err := bld.Run(); err != nil {
		t.Fatal(err)
	}
	return bin
}

func installMapCells(t *testing.T, pool *pgxpool.Pool) {
	for _, xy := range [][2]int{{5, 6}, {11, 12}, {30, 31}} {
		mustExec(t, pool, `INSERT INTO map_cell (server_id,x,y,terrain,resource_type) VALUES (1,$1,$2,0,0) ON CONFLICT DO NOTHING`, xy[0], xy[1])
	}
}

func findRepoRoot(t *testing.T) string {
	dir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		if dir == "/" {
			t.Fatal("go.mod not found")
		}
		dir = filepath.Dir(dir)
	}
}

func repoRootFromWD() string {
	dir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		if dir == "/" {
			return "."
		}
		dir = filepath.Dir(dir)
	}
}

func stageSpecs(t *testing.T, repoRoot string) string {
	base, err := os.MkdirTemp("", "fc-nia-specs-")
	if err != nil {
		t.Fatal(err)
	}
	var paths []string
	for _, pat := range []string{"00*.sql", "m3_*.sql", "m4_*.sql"} {
		m, _ := filepath.Glob(filepath.Join(repoRoot, "spec/db", pat))
		paths = append(paths, m...)
	}
	sort.Strings(paths)
	for _, p := range paths {
		b, _ := os.ReadFile(p)
		_ = os.WriteFile(filepath.Join(base, filepath.Base(p)), b, 0o600)
	}
	return base
}

func freshSchema(t *testing.T, admin *pgxpool.Pool, specDir, dsn string) (*pgxpool.Pool, string, func()) {
	ctx := context.Background()
	schema := fmt.Sprintf("fc_nia_pkg_%x", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, _ := pgxpool.ParseConfig(dsn)
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "90s"
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
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('nia_pkg_u','nia_pkg_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'nia_pkg_p')`, acct)
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
