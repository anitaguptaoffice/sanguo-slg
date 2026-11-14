package firstcityledgerpgslotisolation

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
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	realmA  = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	realmB  = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22"
)

func samplePayload() Payload {
	return Payload{
		CanonicalC1: []byte{0x01}, TemplateVersion: "t", RulesVersion: "r", CatalogVersion: "c",
		ContentEncodingVersion: 1, TemplateFCT1: make([]byte, 52), ContentSHA256: make([]byte, 32),
	}
}

func pg17OrSkip(t *testing.T) (*pgxpool.Pool, string) {
	t.Helper()
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" || os.Getenv("FIRST_CITY_LEDGER_TEST_DSN") == "" {
		t.Skip("owned isolated PG17 required: ALLOW_OWNED_PG17_TEST=1 and FIRST_CITY_LEDGER_TEST_DSN")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })
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
	return admin, ver
}

func TestPG17CrossActorSlotIsolation(t *testing.T) {
	admin, _ := pg17OrSkip(t)
	ctx := context.Background()
	specDir := stageSpecs(t)
	t.Cleanup(func() { _ = os.RemoveAll(specDir) })

	run := func(fn func(*testing.T, *pgxpool.Pool)) {
		pool, done := freshSchema(t, admin, specDir)
		defer done()
		fn(t, pool)
	}

	run(func(t *testing.T, pool *pgxpool.Pool) {
		scenarioDistinctPlayers(t, ctx, pool)
		t.Log("PASS slot_isolation: distinct player_id concurrent INITIAL")
	})
	run(func(t *testing.T, pool *pgxpool.Pool) {
		scenarioDistinctKeys(t, ctx, pool)
		t.Log("PASS slot_isolation: isolation key is full (realm_id, server_id, player_id)")
	})
	run(func(t *testing.T, pool *pgxpool.Pool) {
		scenarioMidIntakePeer(t, ctx, pool)
		t.Log("PASS slot_isolation: mid-intake holder does not block peer INITIAL")
	})
	run(func(t *testing.T, pool *pgxpool.Pool) {
		scenarioSharedCmdIDHeadConflict(t, ctx, pool)
		t.Log("PASS slot_isolation: HEAD_CONFLICT on one actor does not touch peer rows")
	})
}

func TestUnauthorizedFailClosed(t *testing.T) {
	admin, _ := pg17OrSkip(t)
	ctx := context.Background()
	specDir := stageSpecs(t)
	t.Cleanup(func() { _ = os.RemoveAll(specDir) })
	pool, done := freshSchema(t, admin, specDir)
	defer done()

	acct := seedAccount(t, pool, "iso_unauth")
	actor := Actor{RealmID: realmA, ServerID: 1, PlayerID: 99, AccountID: acct}
	ensurePlayer(t, pool, actor, "iso_unauth_p")
	m := UnauthorizedMatrix(actor, "90000000-0000-4000-8000-000000000099", samplePayload())
	if err := m.FailClosedIntake(ctx, pool); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid`, realmA).Scan(&n); err != nil || n != 0 {
		t.Fatalf("no commands: n=%d err=%v", n, err)
	}
}

func scenarioDistinctPlayers(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	ev := FullObligationEvidence()
	cmdA := "11000000-0000-4000-8000-000000000001"
	cmdB := "11000000-0000-4000-8000-000000000002"
	aAcct := seedAccount(t, pool, "iso_p42")
	bAcct := seedAccount(t, pool, "iso_p43")
	aActor := Actor{RealmID: realmA, ServerID: 1, PlayerID: 42, AccountID: aAcct}
	bActor := Actor{RealmID: realmA, ServerID: 1, PlayerID: 43, AccountID: bAcct}
	ensurePlayer(t, pool, aActor, "iso_p42")
	ensurePlayer(t, pool, bActor, "iso_p43")
	ma := NewMatrix(ev, aActor, cmdA, nil, samplePayload())
	mb := NewMatrix(ev, bActor, cmdB, nil, samplePayload())
	okA, okB, err := DualConcurrentInitial(ctx, pool, ma, mb)
	if err != nil {
		t.Fatal(err)
	}
	if !okA || !okB {
		t.Fatalf("both actors must commit INITIAL: okA=%v okB=%v", okA, okB)
	}
	if err := ma.AssertHead(ctx, pool, cmdA); err != nil {
		t.Fatal(err)
	}
	if err := mb.AssertHead(ctx, pool, cmdB); err != nil {
		t.Fatal(err)
	}
	if err := ma.AssertSingleCommand(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := mb.AssertSingleCommand(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := ma.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := mb.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
}

func scenarioDistinctKeys(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	ev := FullObligationEvidence()
	cmdA := "12000000-0000-4000-8000-000000000001"
	cmdB := "12000000-0000-4000-8000-000000000002"
	aAcct := seedAccount(t, pool, "iso_k42s1")
	bAcct := seedAccount(t, pool, "iso_k42s2")
	aActor := Actor{RealmID: realmA, ServerID: 1, PlayerID: 42, AccountID: aAcct}
	bActor := Actor{RealmID: realmB, ServerID: 2, PlayerID: 42, AccountID: bAcct}
	ensurePlayer(t, pool, aActor, "iso_k42s1")
	ensurePlayer(t, pool, bActor, "iso_k42s2")
	ma := NewMatrix(ev, aActor, cmdA, nil, samplePayload())
	mb := NewMatrix(ev, bActor, cmdB, nil, samplePayload())
	okA, okB, err := DualConcurrentInitial(ctx, pool, ma, mb)
	if err != nil {
		t.Fatal(err)
	}
	if !okA || !okB {
		t.Fatalf("same player_id different realm+server: okA=%v okB=%v", okA, okB)
	}
	if err := ma.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := mb.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
}

func scenarioMidIntakePeer(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	ev := FullObligationEvidence()
	cmdA := "13000000-0000-4000-8000-000000000001"
	cmdB := "13000000-0000-4000-8000-000000000002"
	aAcct := seedAccount(t, pool, "iso_m44")
	bAcct := seedAccount(t, pool, "iso_m45")
	aActor := Actor{RealmID: realmA, ServerID: 1, PlayerID: 44, AccountID: aAcct}
	bActor := Actor{RealmID: realmA, ServerID: 1, PlayerID: 45, AccountID: bAcct}
	ensurePlayer(t, pool, aActor, "iso_m44")
	ensurePlayer(t, pool, bActor, "iso_m45")
	ma := NewMatrix(ev, aActor, cmdA, nil, samplePayload())
	mb := NewMatrix(ev, bActor, cmdB, nil, samplePayload())

	hold := make(chan struct{})
	doneA := make(chan struct{})
	go func() {
		defer close(doneA)
		if err := ma.MidIntakeHold(ctx, pool, 150, hold); err != nil {
			panic(err)
		}
	}()
	<-hold
	okB, err := mb.IntakeOnce(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	if !okB {
		t.Fatal("peer B must commit while A mid-intake")
	}
	<-doneA
	if err := mb.AssertHead(ctx, pool, cmdB); err != nil {
		t.Fatal(err)
	}
	if err := mb.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := ma.AssertHead(ctx, pool, cmdA); err != nil {
		t.Fatal(err)
	}
	if err := ma.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
}

func scenarioSharedCmdIDHeadConflict(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	ev := FullObligationEvidence()
	shared := "14000000-0000-4000-8000-00000000beef"
	failCmd := "14000000-0000-4000-8000-00000000c0de"
	aAcct := seedAccount(t, pool, "iso_s46")
	bAcct := seedAccount(t, pool, "iso_s47")
	aActor := Actor{RealmID: realmA, ServerID: 1, PlayerID: 46, AccountID: aAcct}
	bActor := Actor{RealmID: realmA, ServerID: 1, PlayerID: 47, AccountID: bAcct}
	ensurePlayer(t, pool, aActor, "iso_s46")
	ensurePlayer(t, pool, bActor, "iso_s47")
	ma := NewMatrix(ev, aActor, shared, nil, samplePayload())
	mb := NewMatrix(ev, bActor, shared, nil, samplePayload())
	okA, okB, err := DualConcurrentInitial(ctx, pool, ma, mb)
	if err != nil {
		t.Fatal(err)
	}
	if !okA || !okB {
		t.Fatalf("same command_id string in two namespaces: okA=%v okB=%v", okA, okB)
	}
	snapA, err := ma.Snapshot(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	snapB, err := mb.Snapshot(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	ok, err := mb.HeadConflictEmptyPredecessor(ctx, pool, failCmd)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("B stale EMPTY predecessor must HEAD_CONFLICT roll back")
	}
	snapA2, err := ma.Snapshot(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	snapB2, err := mb.Snapshot(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	if !PeersUnchanged(snapA, snapA2) {
		t.Fatal("A rows unchanged after B failure")
	}
	if !PeersUnchanged(snapB, snapB2) {
		t.Fatal("B committed rows unchanged after failed intake")
	}
	if err := ma.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := mb.ObserveInvariants(ctx, pool); err != nil {
		t.Fatal(err)
	}
}

func stageSpecs(t *testing.T) string {
	t.Helper()
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-slot-iso-specs-")
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

var schemaSerial int

func freshSchema(t *testing.T, admin *pgxpool.Pool, specDir string) (*pgxpool.Pool, func()) {
	t.Helper()
	ctx := context.Background()
	schemaSerial++
	schema := fmt.Sprintf("fc_slot_iso_%x_%d", time.Now().UnixNano(), schemaSerial)
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 12
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

func seedAccount(t *testing.T, pool *pgxpool.Pool, login string) int64 {
	t.Helper()
	ctx := context.Background()
	_, err := pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ($1,'iso_h',1)`, login)
	if err != nil {
		t.Fatal(err)
	}
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name=$1`, login).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	return acct
}

func ensurePlayer(t *testing.T, pool *pgxpool.Pool, actor Actor, login string) {
	t.Helper()
	ctx := context.Background()
	_, err := pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name)
 VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, actor.ServerID, actor.PlayerID, actor.AccountID, login)
	if err != nil {
		t.Fatal(err)
	}
}
