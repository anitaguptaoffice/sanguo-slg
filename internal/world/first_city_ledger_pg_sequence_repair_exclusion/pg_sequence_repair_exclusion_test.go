package firstcityledgerpgsequencerepairexclusion

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
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testRealm   = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e88"
	workerPkg   = "./spec/db/tests/first_city_ledger_sequence_repair_exclusion/seq_repair_worker"
	retainedID  = "a1111111-1111-4111-8111-111111111111"
	retainedCID = int64(88001)
)

func seqEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller {
	return &Controller{Evidence: seqEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42}
}

func TestPG17FirstCityLedgerSequenceRepairExclusion(t *testing.T) {
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
	t.Log("PostgreSQL", ver, "seq_repair_entry:", workerPkg, "(harness seq_repair_worker; not production controller)")
	if err := admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major); err != nil {
		t.Fatal(err)
	}
	if major != "17" {
		t.Fatalf("PostgreSQL 17 required; got %s", ver)
	}
	repoRoot := findRepoRoot(t)
	workerBin := buildSeqWorker(t, repoRoot)
	specDir := stageSpecs(t, repoRoot)
	defer func() { _ = os.RemoveAll(specDir) }()
	for _, tc := range []struct {
		tag string
		fn  func(*testing.T, *pgxpool.Pool, string, int64, string, string)
	}{
		{"seq_repair_no_visible_first_city", scNoVisibleFirstCity},
		{"no_empty_reopen_or_command_id_reuse", scNoEmptyReuse},
		{"table_lock_alone_not_seq_repair_entry_stopped", scTableLockAlone},
		{"seq_repair_no_false_drain", scNoFalseDrain},
		{"lawful_multi_city_not_blocked", scLawfulMultiCity},
	} {
		t.Run(tc.tag, func(t *testing.T) {
			pool, schema, done := freshSchema(t, admin, specDir, dsn)
			defer done()
			installMapCells(t, pool)
			if err := InstallDisposableFixture(ctx, pool, testRealm, 1, 42); err != nil {
				t.Fatal(err)
			}
			acct := seed(t, pool)
			tc.fn(t, pool, schema, acct, dsn, workerBin)
			t.Logf("PASS seq_exclusion: %s", tc.tag)
		})
	}
}

func scNoVisibleFirstCity(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.SeedRetention(ctx, pool, acct, retainedID, "保留城", 5, 6, retainedCID) == nil)
	chk(t, SetExclusion(ctx, pool, true) == nil)
	out := runWorker(t, repoRootFromWD(), workerBin, dsn, schema, "city_setval", "commit", "序列首城", 41, 42, true, 88002, "")
	rc, err := c.Counts(ctx, pool)
	hw, errHW := c.AllocatorHighwater(ctx, pool)
	seqVal, errSeq := c.CitySeqLastValue(ctx, pool)
	chk(t, err == nil && errHW == nil && errSeq == nil && rc.CommandN == 1 && rc.PlayerCityN == 1 && hw == retainedCID && seqVal >= 88000)
	chk(t, strings.Contains(out, "SEQ_ERR"))
}

func scNoEmptyReuse(t *testing.T, pool *pgxpool.Pool, _ string, acct int64, _, _ string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.SeedRetention(ctx, pool, acct, retainedID, "保留城", 5, 6, retainedCID) == nil)
	_, err := pool.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=NULL WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, testRealm)
	chk(t, err != nil)
	head, err := c.HeadCommandID(ctx, pool)
	chk(t, err == nil && head == retainedID)
	_, err = pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 SELECT realm_id,server_id,player_id,$2::uuid,account_id,canonical_c1,1,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,now() FROM world_first_city_command WHERE command_id=$1::uuid`, retainedID, retainedID)
	chk(t, err != nil)
}

func scTableLockAlone(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.SeedRetention(ctx, pool, acct, retainedID, "保留城", 5, 6, retainedCID) == nil)
	chk(t, SetExclusion(ctx, pool, true) == nil)
	chk(t, SetPriorOIDStopFlags(ctx, pool) == nil)
	cmd, buf := startWorkerHold(t, repoRootFromWD(), workerBin, dsn, schema, "city_nextval", "序列锁城", 9, 10, 88009)
	defer killWorker(cmd)
	obs, err := OpenHarnessConn(ctx, dsn, schema)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = obs.Close(ctx) }()
	lockCmd, locked := TryLedgerCommandRowLockObserver(ctx, obs, testRealm, 1, 42)
	chk(t, locked && lockCmd == retainedID)
	chk(t, strings.Contains(buf.String(), "WORKER_HOLDING") && pollSeqBusy(ctx, dsn, schema))
	killWorker(cmd)
	chk(t, SetCityNextvalStopped(ctx, pool) == nil)
	cmd2, buf2 := startWorkerHold(t, repoRootFromWD(), workerBin, dsn, schema, "city_setval", "仅setval", 9, 10, 88019)
	defer killWorker(cmd2)
	chk(t, pollSeqBusy(ctx, dsn, schema) && strings.Contains(buf2.String(), "WORKER_HOLDING"))
	killWorker(cmd2)
	chk(t, SetCityPathsStopped(ctx, pool) == nil)
	cmd3, buf3 := startWorkerHold(t, repoRootFromWD(), workerBin, dsn, schema, "queue_nextval", "queue活", 9, 10, 90009)
	defer killWorker(cmd3)
	chk(t, pollSeqBusy(ctx, dsn, schema) && strings.Contains(buf3.String(), "WORKER_HOLDING"))
}

func scNoFalseDrain(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl()
	chk(t, SetExclusion(ctx, pool, true) == nil)
	cmd, buf := startWorkerHold(t, repoRootFromWD(), workerBin, dsn, schema, "city_nextval", "排空城", 7, 8, 88007)
	defer killWorker(cmd)
	chk(t, BumpProfileDrain(ctx, pool) == nil)
	chk(t, strings.Contains(buf.String(), "WORKER_HOLDING") && strings.Contains(buf.String(), "SEQ_ADVANCE") && pollSeqBusy(ctx, dsn, schema))
	chk(t, !withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitEmptyIntake(ctx, tx, acct, "f5555555-5555-4555-8555-555555555555", "假排空", 7, 8)
	}))
	killWorker(cmd)
	time.Sleep(300 * time.Millisecond)
	chk(t, withConn(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitEmptyIntake(ctx, tx, acct, "f6666666-6666-4666-8666-666666666666", "排空后续", 7, 8)
	}))
}

func scLawfulMultiCity(t *testing.T, pool *pgxpool.Pool, schema string, acct int64, dsn, workerBin string) {
	ctx := context.Background()
	c := ctl()
	chk(t, c.SeedRetention(ctx, pool, acct, retainedID, "保留城", 5, 6, retainedCID) == nil)
	chk(t, SetExclusion(ctx, pool, true) == nil)
	out := runWorker(t, repoRootFromWD(), workerBin, dsn, schema, "queue_repair", "commit", "分城", 60, 61, false, 88060, "")
	rc, err := c.Counts(ctx, pool)
	chk(t, err == nil && strings.Contains(out, "SEQ_COMMITTED") && rc.PlayerCityN == 2)
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
	pool, _, done := freshSchema(t, admin, specDir, os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	defer done()
	installMapCells(t, pool)
	_ = InstallDisposableFixture(ctx, pool, testRealm, 1, 42)
	seed(t, pool)
	c := &Controller{RealmID: testRealm, ServerID: 1, PlayerID: 42}
	ok, err := withConnErr(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryCommitEmptyIntake(ctx, tx, 1, retainedID, "x", 1, 1)
	})
	if ok || err != ErrUnauthorized {
		t.Fatalf("fail-closed: ok=%v err=%v", ok, err)
	}
	if err := c.SeedRetention(ctx, pool, 1, retainedID, "x", 1, 1, retainedCID); err != ErrUnauthorized {
		t.Fatalf("SeedRetention fail-closed: %v", err)
	}
}

func pollSeqBusy(ctx context.Context, dsn, schema string) bool {
	for range 40 {
		c, err := pgx.Connect(ctx, dsn)
		if err != nil {
			time.Sleep(50 * time.Millisecond)
			continue
		}
		_, _ = c.Exec(ctx, "SET search_path TO "+schema)
		var slot int
		busy := c.QueryRow(ctx, `SELECT slot FROM harness_seq_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&slot) != nil
		_ = c.Close(ctx)
		if busy {
			return true
		}
		time.Sleep(50 * time.Millisecond)
	}
	return false
}

func killWorker(cmd *osexec.Cmd) {
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
		_, _ = cmd.Process.Wait()
	}
	time.Sleep(300 * time.Millisecond)
}

func workerEnv(dsn, schema, entry, mode, name string, x, y int, capital bool, cityID int64, holdSec string) []string {
	cap := "1"
	if !capital {
		cap = "0"
	}
	e := append(os.Environ(), "GOTOOLCHAIN=local", "HARNESS_DSN="+dsn, "HARNESS_SCHEMA="+schema,
		"HARNESS_ENTRY="+entry, "HARNESS_MODE="+mode, "HARNESS_NAME="+name, "HARNESS_IS_CAPITAL="+cap,
		fmt.Sprintf("HARNESS_X=%d", x), fmt.Sprintf("HARNESS_Y=%d", y), fmt.Sprintf("HARNESS_CITY_ID=%d", cityID))
	if holdSec != "" {
		e = append(e, "HARNESS_HOLD_SEC="+holdSec)
	}
	return e
}

func runWorker(t *testing.T, repoRoot, workerBin, dsn, schema, entry, mode, name string, x, y int, capital bool, cityID int64, holdSec string) string {
	t.Helper()
	cmd := osexec.Command(workerBin)
	cmd.Dir, cmd.Env = repoRoot, workerEnv(dsn, schema, entry, mode, name, x, y, capital, cityID, holdSec)
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	_ = cmd.Run()
	return out.String()
}

func startWorkerHold(t *testing.T, repoRoot, workerBin, dsn, schema, entry, name string, x, y int, cityID int64) (*osexec.Cmd, *bytes.Buffer) {
	t.Helper()
	cmd := osexec.Command(workerBin)
	cmd.Dir, cmd.Env = repoRoot, workerEnv(dsn, schema, entry, "hold", name, x, y, true, cityID, "30")
	var buf bytes.Buffer
	cmd.Stdout, cmd.Stderr = &buf, &buf
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	for dl := time.Now().Add(60 * time.Second); time.Now().Before(dl); time.Sleep(200 * time.Millisecond) {
		if strings.Contains(buf.String(), "WORKER_HOLDING") {
			return cmd, &buf
		}
	}
	t.Fatal("seq worker hold did not start")
	return nil, nil
}

func buildSeqWorker(t *testing.T, repoRoot string) string {
	t.Helper()
	bin := filepath.Join(os.TempDir(), "fc_seq_repair_worker_pkg_bin")
	bld := osexec.Command("go", "build", "-o", bin, workerPkg)
	bld.Dir, bld.Env = repoRoot, append(os.Environ(), "GOTOOLCHAIN=local")
	if err := bld.Run(); err != nil {
		t.Fatal(err)
	}
	return bin
}

func installMapCells(t *testing.T, pool *pgxpool.Pool) {
	for _, xy := range [][2]int{{5, 6}, {7, 8}, {9, 10}, {41, 42}, {60, 61}} {
		mustExec(t, pool, `INSERT INTO map_cell (server_id,x,y,terrain,resource_type) VALUES (1,$1,$2,0,0) ON CONFLICT DO NOTHING`, xy[0], xy[1])
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
	base, err := os.MkdirTemp("", "fc-seq-specs-")
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
	schema := fmt.Sprintf("fc_seq_pkg_%x", time.Now().UnixNano())
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
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('seq_pkg_u','seq_pkg_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'seq_pkg_p')`, acct)
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
