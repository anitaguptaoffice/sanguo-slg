package firstcityledgerpgfinalizer

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
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testRealm = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77"
	mapX      = int32(10)
	mapY      = int32(20)
)

func drainAll() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func act(acct int64) firstcityledgerpgintake.Actor {
	return firstcityledgerpgintake.Actor{RealmID: testRealm, ServerID: 1, PlayerID: 42, AccountID: acct}
}

func fx(reason int16) *Finalizer {
	return &Finalizer{Evidence: drainAll(), MapX: mapX, MapY: mapY, Reason: reason}
}

func TestPG17FirstCityLedgerFinalizer(t *testing.T) {
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
	_ = admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major)
	if major != "17" {
		t.Fatalf("PostgreSQL 17 required; got %s", ver)
	}
	specDir := stageSpecs(t)
	defer func() { _ = os.RemoveAll(specDir) }()
	run := func(name string, fn func(*testing.T, *pgxpool.Pool, int64)) {
		t.Run(name, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			fn(t, pool, seedActor(t, pool))
		})
	}
	run("unauthorized_without_obligations_does_not_finalize", scUnauth)
	run("reason_1_non_buildable_terrain_commits_rejection", scReason1)
	run("reason_2_committed_occupier_commits_rejection", scReason2)
	run("buildable_unoccupied_rolls_back_still_pending", scBuildableOpen)
	run("reason_disagrees_with_evidence_rolls_back_still_pending", scMismatch)
	run("zero_row_terminal_update_is_not_authoritative", scZeroRow)
	run("rollback_after_reread_before_terminal_update_stays_pending", scStopBefore)
	run("in_flight_uncommitted_finalizer_is_still_pending", scInFlight)
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, _ := os.MkdirTemp("", "fc-pgf-specs-")
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
	schema := fmt.Sprintf("fc_pgf_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, _ := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
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
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('pgf_u','pgf_h',1)`)
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	_, _ = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'pgf_p')`, acct)
	return acct
}

func seedMap(t *testing.T, pool *pgxpool.Pool, terrain int16) {
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,$3)`, mapX, mapY, terrain)
}

func seedOccupier(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('pgf_occ','pgf_h',1)`)
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name='pgf_occ'`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	_, _ = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,99,$1,'occ')`, acct)
	_, _ = pool.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
 VALUES (1,77001,99,'occ-city',$1,$2,false,1,100)`, mapX, mapY)
}

func commitIntake(t *testing.T, pool *pgxpool.Pool, acct int64, cmd string) {
	t.Helper()
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	p := firstcityledgerpgintake.Payload{CanonicalC1: []byte{1}, TemplateVersion: "t", RulesVersion: "r", CatalogVersion: "c",
		ContentEncodingVersion: 1, TemplateFCT1: make([]byte, 52), ContentSHA256: make([]byte, 32)}
	iw := &firstcityledgerpgintake.Writer{Evidence: drainAll()}
	if err := iw.ApplyPendingIntake(ctx, tx, act(acct), cmd, nil, p); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
}

type cmdSnap struct {
	state           int16
	hasTerm, hasRej bool
	rej             int16
}

func readSnap(ctx context.Context, pool *pgxpool.Pool, cmd string) cmdSnap {
	var s cmdSnap
	var term *time.Time
	var rej *int16
	_ = pool.QueryRow(ctx, `SELECT durable_state,terminal_at,rejection_reason FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).
		Scan(&s.state, &term, &rej)
	s.hasTerm = term != nil
	s.hasRej = rej != nil
	if rej != nil {
		s.rej = *rej
	}
	return s
}

func bizRows(ctx context.Context, pool *pgxpool.Pool) int {
	var n int
	_ = pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+
(SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42)`).Scan(&n)
	return n
}

func assertPending(t *testing.T, s cmdSnap) {
	t.Helper()
	if s.state != 1 || s.hasTerm || s.hasRej {
		t.Fatalf("want PENDING; got st=%d term=%v rej=%v", s.state, s.hasTerm, s.hasRej)
	}
}

func scUnauth(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "a1111111-1111-4111-8111-111111111111"
	seedMap(t, pool, 1)
	commitIntake(t, pool, acct, cmd)
	err := (&Finalizer{Reason: 1, MapX: mapX, MapY: mapY}).CommitRejection(context.Background(), pool, act(acct), cmd)
	ctx := context.Background()
	assertPending(t, readSnap(ctx, pool, cmd))
	if err == nil || !strings.Contains(err.Error(), "unauthorized") || bizRows(ctx, pool) != 0 {
		t.Fatalf("unauth err=%v biz=%d", err, bizRows(ctx, pool))
	}
}

func scReason1(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "a2222222-2222-4222-8222-222222222222"
	seedMap(t, pool, 1)
	commitIntake(t, pool, acct, cmd)
	ctx := context.Background()
	if err := fx(1).CommitRejection(ctx, pool, act(acct), cmd); err != nil {
		t.Fatal(err)
	}
	s := readSnap(ctx, pool, cmd)
	if s.state != 3 || !s.hasTerm || s.rej != 1 || bizRows(ctx, pool) != 0 {
		t.Fatalf("reason1 s=%+v biz=%d", s, bizRows(ctx, pool))
	}
}

func scReason2(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "a3333333-3333-4333-8333-333333333333"
	seedMap(t, pool, 4)
	seedOccupier(t, pool)
	commitIntake(t, pool, acct, cmd)
	ctx := context.Background()
	if err := fx(2).CommitRejection(ctx, pool, act(acct), cmd); err != nil {
		t.Fatal(err)
	}
	s := readSnap(ctx, pool, cmd)
	if s.state != 3 || !s.hasTerm || s.rej != 2 || bizRows(ctx, pool) != 0 {
		t.Fatalf("reason2 s=%+v biz=%d", s, bizRows(ctx, pool))
	}
}

func scBuildableOpen(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "a4444444-4444-4444-8444-444444444444"
	seedMap(t, pool, 4)
	commitIntake(t, pool, acct, cmd)
	ctx := context.Background()
	before := readSnap(ctx, pool, cmd)
	err := fx(1).CommitRejection(ctx, pool, act(acct), cmd)
	after := readSnap(ctx, pool, cmd)
	if err == nil || bizRows(ctx, pool) != 0 {
		t.Fatalf("buildable err=%v biz=%d", err, bizRows(ctx, pool))
	}
	assertPending(t, after)
	if before != after {
		t.Fatalf("mutated on rollback")
	}
}

func scMismatch(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "a5555555-5555-4555-8555-555555555555"
	seedMap(t, pool, 4)
	commitIntake(t, pool, acct, cmd)
	ctx := context.Background()
	if err := fx(1).CommitRejection(ctx, pool, act(acct), cmd); err == nil {
		t.Fatal("wanted whitelist failure")
	}
	assertPending(t, readSnap(ctx, pool, cmd))
	if bizRows(ctx, pool) != 0 {
		t.Fatal("business leaked")
	}
}

func scZeroRow(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "a6666666-6666-4666-8666-666666666666"
	seedMap(t, pool, 1)
	commitIntake(t, pool, acct, cmd)
	ctx := context.Background()
	err := fx(1).CommitRejectionWithHook(ctx, pool, act(acct), cmd, FinalizerTestHook{
		WrongCommandID: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
	})
	if err == nil {
		t.Fatal("wanted zero-row rollback")
	}
	assertPending(t, readSnap(ctx, pool, cmd))
}

func scStopBefore(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "a7777777-7777-4777-8777-777777777777"
	seedMap(t, pool, 1)
	commitIntake(t, pool, acct, cmd)
	ctx := context.Background()
	before := readSnap(ctx, pool, cmd)
	err := fx(1).CommitRejectionWithHook(ctx, pool, act(acct), cmd, FinalizerTestHook{StopBeforeTerminalUpdate: true})
	if err == nil {
		t.Fatal("wanted hold rollback")
	}
	after := readSnap(ctx, pool, cmd)
	assertPending(t, after)
	if before != after {
		t.Fatalf("partial terminal columns? before=%+v after=%+v", before, after)
	}
}

func scInFlight(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "a8888888-8888-4888-8888-888888888888"
	seedMap(t, pool, 1)
	commitIntake(t, pool, acct, cmd)
	hold, done := make(chan struct{}), make(chan struct{})
	go func() {
		ctx := context.Background()
		tx, err := fx(1).BeginRejectionTx(ctx, pool, act(acct), cmd)
		if err != nil {
			panic(err)
		}
		close(hold)
		time.Sleep(80 * time.Millisecond)
		if err := fx(1).FinishRejectionTx(ctx, tx, act(acct), cmd); err != nil {
			panic(err)
		}
		close(done)
	}()
	<-hold
	ctx := context.Background()
	assertPending(t, readSnap(ctx, pool, cmd))
	if bizRows(ctx, pool) != 0 {
		t.Fatal("in-flight business visible")
	}
	<-done
	s := readSnap(ctx, pool, cmd)
	if s.state != 3 || s.rej != 1 {
		t.Fatalf("after commit s=%+v", s)
	}
}
