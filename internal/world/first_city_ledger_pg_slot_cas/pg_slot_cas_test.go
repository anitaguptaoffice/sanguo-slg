package firstcityledgerpgslotcas

import (
	"context"
	"errors"
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
	"github.com/jackc/pgx/v5/pgxpool"
)

const testRealm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

func slotEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{
		ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true,
	}
}

func samplePayload() firstcityledgerpgintake.Payload {
	return firstcityledgerpgintake.Payload{
		CanonicalC1: []byte{0x01}, TemplateVersion: "t", RulesVersion: "r", CatalogVersion: "c",
		ContentEncodingVersion: 1, TemplateFCT1: make([]byte, 52), ContentSHA256: make([]byte, 32),
	}
}

func testActor(acct int64) firstcityledgerpgintake.Actor {
	return firstcityledgerpgintake.Actor{RealmID: testRealm, ServerID: 1, PlayerID: 42, AccountID: acct}
}

func matrix(acct int64, cmd string, pred *string) *Matrix {
	return &Matrix{
		Evidence: slotEvidence(), Actor: testActor(acct), CommandID: cmd, Predecessor: pred, Payload: samplePayload(),
	}
}

func TestPG17FirstCityLedgerSlotCAS(t *testing.T) {
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
	for _, sc := range []struct {
		name string
		run  func(*testing.T, *pgxpool.Pool, int64)
	}{
		{"competing_initial_empty_slot", scenarioCompetingInitial},
		{"two_command_id_same_predecessor", scenarioSamePredecessor},
		{"stale_predecessor", scenarioStalePredecessor},
		{"no_transient_empty", scenarioNoTransientEmpty},
	} {
		t.Run(sc.name, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			sc.run(t, pool, seedActor(t, pool))
			t.Logf("PASS slot_cas: %s", sc.name)
		})
	}
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
	acct := seedActor(t, pool)
	m := &Matrix{Actor: testActor(acct), CommandID: "90000000-0000-4000-8000-000000000099", Payload: samplePayload()}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	committed, runErr := m.IntakeParticipant(ctx, tx)
	if !errors.Is(runErr, ErrUnauthorized) || committed {
		t.Fatalf("fail-closed: committed=%v err=%v", committed, runErr)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid`, testRealm).Scan(&n); err != nil || n != 0 {
		t.Fatalf("no commands: n=%d", n)
	}
}

func dualIntakeRace(pool *pgxpool.Pool, acct int64, cmdA, cmdB string) (bool, bool) {
	ctx := context.Background()
	begin := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	var okA, okB bool
	run := func(cmd string, dst *bool) {
		defer wg.Done()
		<-begin
		c, err := pool.Acquire(ctx)
		if err != nil {
			panic(err)
		}
		defer c.Release()
		tx, err := c.Begin(ctx)
		if err != nil {
			panic(err)
		}
		m := matrix(acct, cmd, nil)
		*dst, err = m.IntakeParticipant(ctx, tx)
		if err != nil {
			panic(err)
		}
	}
	go run(cmdA, &okA)
	go run(cmdB, &okB)
	close(begin)
	wg.Wait()
	return okA, okB
}

func scenarioCompetingInitial(t *testing.T, pool *pgxpool.Pool, acct int64) {
	t.Helper()
	okA, okB := dualIntakeRace(pool, acct,
		"c1000000-0000-4000-8000-000000000001", "c2000000-0000-4000-8000-000000000002")
	wins := 0
	if okA {
		wins++
	}
	if okB {
		wins++
	}
	if wins != 1 {
		t.Fatalf("competing INITIAL: wins=%d", wins)
	}
	m := matrix(acct, "c1000000-0000-4000-8000-000000000001", nil)
	ctx := context.Background()
	if err := m.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
	n, err := m.PendingCount(ctx, pool)
	if err != nil || n != 1 {
		t.Fatalf("single PENDING: n=%d err=%v", n, err)
	}
}

func scenarioSamePredecessor(t *testing.T, pool *pgxpool.Pool, acct int64) {
	t.Helper()
	okA, okB := dualIntakeRace(pool, acct,
		"d1000000-0000-4000-8000-000000000001", "d2000000-0000-4000-8000-000000000002")
	if (okA && okB) || (!okA && !okB) {
		t.Fatalf("same predecessor: okA=%v okB=%v", okA, okB)
	}
	m := matrix(acct, "d1000000-0000-4000-8000-000000000001", nil)
	if err := m.ObserveInvariants(context.Background(), pool); err != nil {
		t.Fatal(err)
	}
}

func scenarioStalePredecessor(t *testing.T, pool *pgxpool.Pool, acct int64) {
	t.Helper()
	ctx := context.Background()
	cmdA := "e1000000-0000-4000-8000-000000000001"
	cmdB := "e2000000-0000-4000-8000-000000000002"
	if ok, err := runIntake(pool, matrix(acct, cmdA, nil)); err != nil || !ok {
		t.Fatalf("seed A: ok=%v err=%v", ok, err)
	}
	ok, err := runIntake(pool, matrix(acct, cmdB, nil))
	if err != nil || ok {
		t.Fatalf("stale NULL pred: ok=%v err=%v", ok, err)
	}
	m := matrix(acct, cmdA, nil)
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, testRealm).Scan(&n); err != nil || n != 1 {
		t.Fatalf("commands=%d", n)
	}
	head, err := m.HeadCommandID(ctx, pool)
	if err != nil || head != cmdA {
		t.Fatalf("head=%q", head)
	}
	if err := m.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
}

func scenarioNoTransientEmpty(t *testing.T, pool *pgxpool.Pool, acct int64) {
	t.Helper()
	ctx := context.Background()
	cmdA := "f1000000-0000-4000-8000-000000000001"
	cmdB := "f2000000-0000-4000-8000-000000000002"
	hold := make(chan struct{})
	go func() {
		staged, err := matrix(acct, cmdA, nil).BeginStagedIntake(ctx, pool)
		if err != nil {
			panic(err)
		}
		close(hold)
		time.Sleep(120 * time.Millisecond)
		if err := staged.CommitHeadCAS(ctx); err != nil {
			panic(err)
		}
	}()
	<-hold
	ok, err := runIntake(pool, matrix(acct, cmdB, nil))
	if err != nil || ok {
		t.Fatalf("second EMPTY blocked: ok=%v err=%v", ok, err)
	}
	m := matrix(acct, cmdA, nil)
	if err := m.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
	head, err := m.HeadCommandID(ctx, pool)
	if err != nil || head != cmdA {
		t.Fatalf("head=%q", head)
	}
}

func runIntake(pool *pgxpool.Pool, m *Matrix) (bool, error) {
	ctx := context.Background()
	c, err := pool.Acquire(ctx)
	if err != nil {
		return false, err
	}
	defer c.Release()
	tx, err := c.Begin(ctx)
	if err != nil {
		return false, err
	}
	return m.IntakeParticipant(ctx, tx)
}

func stageSpecs(t *testing.T) string {
	t.Helper()
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-slot-cas-specs-")
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
	t.Helper()
	ctx := context.Background()
	schema := fmt.Sprintf("fc_slot_cas_%x", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
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

func seedActor(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('cas_u','cas_h',1)`)
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	_, _ = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'cas_p')`, acct)
	return acct
}
