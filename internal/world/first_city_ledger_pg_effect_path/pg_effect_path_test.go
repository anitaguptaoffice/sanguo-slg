package firstcityledgerpgeffectpath

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
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testRealm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	testCmd   = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
)

func pathEvidence() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{
		ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true,
	}
}

func testMatrix() *Matrix {
	return &Matrix{
		Evidence: pathEvidence(), RealmID: testRealm, ServerID: 1, PlayerID: 42, CommandID: testCmd,
		MapX: 10, MapY: 20, RejectionReason: 1,
	}
}

func TestPG17FirstCityLedgerEffectPath(t *testing.T) {
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
	m := testMatrix()
	run := func(fn func(*testing.T, *pgxpool.Pool)) {
		pool, done := freshSchema(t, admin, specDir)
		defer done()
		installMilOrigin(t, pool)
		seedPending(t, pool)
		fn(t, pool)
	}
	run(func(t *testing.T, pool *pgxpool.Pool) {
		racePrimaryFirst(t, pool, m, "effect", 2, "effect business + receipt before finalizer")
	})
	run(func(t *testing.T, pool *pgxpool.Pool) {
		racePrimaryFirst(t, pool, m, "finalizer", 3, "finalizer before effect business path")
	})
	run(func(t *testing.T, pool *pgxpool.Pool) {
		scenarioOpponentOpen(t, pool, m)
	})
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
	installMilOrigin(t, pool)
	seedPending(t, pool)
	m := &Matrix{RealmID: testRealm, ServerID: 1, PlayerID: 42, CommandID: testCmd, MapX: 10, MapY: 20}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	committed, runErr := m.EffectParticipant(ctx, tx)
	_ = tx.Rollback(ctx)
	if !errors.Is(runErr, ErrUnauthorized) || committed {
		t.Fatalf("effect fail-closed: committed=%v err=%v", committed, runErr)
	}
	tx2, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	committed, runErr = m.FinalizerParticipant(ctx, tx2)
	_ = tx2.Rollback(ctx)
	if !errors.Is(runErr, ErrUnauthorized) || committed {
		t.Fatalf("finalizer fail-closed: committed=%v err=%v", committed, runErr)
	}
	st, err := m.DurableState(ctx, pool)
	if err != nil || st != 1 {
		t.Fatalf("pending only: st=%d err=%v", st, err)
	}
	biz, err := m.BizSum(ctx, pool)
	if err != nil || biz != 0 {
		t.Fatalf("no business rows without evidence: biz=%d", biz)
	}
}

type partFn func(context.Context, pgx.Tx) (bool, error)

func racePrimaryFirst(t *testing.T, pool *pgxpool.Pool, m *Matrix, primary string, wantState int16, label string) {
	t.Helper()
	ctx := context.Background()
	var primaryFn, loserFn partFn
	if primary == "effect" {
		primaryFn, loserFn = m.EffectParticipant, m.FinalizerParticipant
	} else {
		primaryFn, loserFn = m.FinalizerParticipant, m.EffectParticipant
	}
	var gate sync.WaitGroup
	gate.Add(1)
	var loserCommitted bool
	go func() {
		gate.Wait()
		c, err := pool.Acquire(ctx)
		if err != nil {
			panic(err)
		}
		defer c.Release()
		tx, err := c.Begin(ctx)
		if err != nil {
			panic(err)
		}
		loserCommitted, err = loserFn(ctx, tx)
		if err != nil && !errors.Is(err, ErrUnauthorized) {
			panic(err)
		}
	}()
	c, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Release()
	tx, err := c.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	gate.Done()
	committed, err := primaryFn(ctx, tx)
	if err != nil {
		t.Fatal(err)
	}
	if !committed {
		t.Fatal("primary COMMIT")
	}
	time.Sleep(50 * time.Millisecond)
	st, err := m.DurableState(ctx, pool)
	if err != nil || st != wantState {
		t.Fatalf("terminal evidence: durable_state=%d err=%v", st, err)
	}
	if wantState == 2 {
		assertFullEffect(t, ctx, pool, m)
	} else {
		biz, err := m.BizSum(ctx, pool)
		if err != nil || biz != 0 {
			t.Fatalf("no business on reject: biz=%d", biz)
		}
	}
	if loserCommitted {
		t.Fatal("loser rolled back")
	}
	t.Log("PASS effect-path race:", label)
}

func scenarioOpponentOpen(t *testing.T, pool *pgxpool.Pool, m *Matrix) {
	t.Helper()
	ctx := context.Background()
	startFin := make(chan struct{})
	go func() {
		<-startFin
		c, err := pool.Acquire(ctx)
		if err != nil {
			panic(err)
		}
		defer c.Release()
		tx, err := c.Begin(ctx)
		if err != nil {
			panic(err)
		}
		_, _ = m.FinalizerParticipant(ctx, tx)
	}()
	tx, err := m.BeginEffectParticipant(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	if err := m.EffectBusiness(ctx, tx); err != nil {
		_ = tx.Rollback(ctx)
		t.Fatal(err)
	}
	close(startFin)
	time.Sleep(80 * time.Millisecond)
	st, err := m.DurableState(ctx, pool)
	if err != nil || st != 1 {
		t.Fatalf("spy: open txn: st=%d", st)
	}
	biz, err := m.BizSum(ctx, pool)
	if err != nil || biz != 0 {
		t.Fatalf("spy: zero committed business: biz=%d", biz)
	}
	ok, err := m.EffectTerminal(ctx, tx)
	if err != nil || !ok {
		t.Fatalf("terminal in open txn: ok=%v err=%v", ok, err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	assertFullEffect(t, ctx, pool, m)
	t.Log("PASS effect-path: no committed business or terminal while opponent open")
}

func assertFullEffect(t *testing.T, ctx context.Context, pool *pgxpool.Pool, m *Matrix) {
	t.Helper()
	st, err := m.DurableState(ctx, pool)
	if err != nil || st != 2 {
		t.Fatalf("durable_state=2: got %d", st)
	}
	var sid int64
	err = pool.QueryRow(ctx, `SELECT success_city_id FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID).Scan(&sid)
	if err != nil || sid != SuccessCityID {
		t.Fatalf("success_city_id: got %d", sid)
	}
	biz, err := m.BizSum(ctx, pool)
	if err != nil || biz != 6 {
		t.Fatalf("success receipt + six business rows: biz=%d", biz)
	}
}

func installMilOrigin(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	mustExec(t, pool, `CREATE TABLE mil_city_origin (
 server_id int NOT NULL CHECK (server_id>0), city_id bigint NOT NULL CHECK (city_id>0),
 owner_player_id bigint NOT NULL CHECK (owner_player_id>0),
 cohort_id bytea NOT NULL CHECK (octet_length(cohort_id)=16 AND cohort_id<>decode(repeat('00',16),'hex')),
 format_version smallint NOT NULL CHECK (format_version=1), created_at timestamptz NOT NULL,
 PRIMARY KEY (server_id,city_id))`)
}

func seedPending(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	c1 := `\x01`
	fct1 := `\x` + strings.Repeat("00", 52)
	sha := `\x` + strings.Repeat("ab", 32)
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('fx_u','fx_h',1)`)
	var acct int64
	mustRow(t, pool, `SELECT account_id FROM account LIMIT 1`, &acct)
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'fx_p')`, acct)
	mustExec(t, pool, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,10,20,4)`)
	mustExec(t, pool, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 SELECT '%s'::uuid,1,42,'%s'::uuid,account_id,'%s',1,'t','r','c',1,'%s','%s',now()
 FROM account LIMIT 1`, testRealm, testCmd, c1, fct1, sha))
	mustExec(t, pool, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 SELECT '%s'::uuid,1,42,account_id,'%s'::uuid FROM account LIMIT 1`, testRealm, testCmd))
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-effect-path-specs-")
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
	schema := fmt.Sprintf("fc_fx_%x", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 8
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
