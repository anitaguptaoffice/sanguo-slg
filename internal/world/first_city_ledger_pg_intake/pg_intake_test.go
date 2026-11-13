package firstcityledgerpgintake

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
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
)

const testRealm = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77"

func TestPG17FirstCityLedgerIntake(t *testing.T) {
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
	_ = admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major)
	if major != "17" {
		t.Fatalf("PostgreSQL 17 required; got %s", ver)
	}
	t.Log("PostgreSQL", ver)
	specDir := stageSpecs(t)
	defer os.RemoveAll(specDir)
	for _, sc := range []struct {
		name string
		run  func(*testing.T, *pgxpool.Pool, int64)
	}{
		{"unauthorized_without_obligations_keeps_closed", sceneUnauthorized},
		{"substitute_fence_not_authorization", sceneSubstituteFence},
		{"partial_obligations_not_partial_enablement", scenePartialObligations},
		{"authorized_pending_intake_and_slot_cas", sceneAuthorizedPending},
		{"lawful_multi_city_not_blocked", sceneLawfulMultiCity},
	} {
		t.Run(sc.name, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			sc.run(t, pool, seedActor(t, pool))
			t.Logf("PASS pg_intake: %s", sc.name)
		})
	}
}

func stageSpecs(t *testing.T) string {
	t.Helper()
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, _ := os.MkdirTemp("", "fc-pg-intake-specs-")
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
	schema := fmt.Sprintf("fc_pg_intake_%d", time.Now().UnixNano())
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
	for _, xy := range [][2]int{{5, 6}, {30, 31}} {
		_, _ = pool.Exec(ctx, `INSERT INTO map_cell (server_id,x,y,terrain,resource_type) VALUES (1,$1,$2,0,0)`, xy[0], xy[1])
	}
	return pool, func() { pool.Close(); _, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") }
}

func seedActor(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('pgi_u','pgi_h',1)`)
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	_, _ = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'pgi_p')`, acct)
	return acct
}

func samplePayload() Payload {
	return Payload{CanonicalC1: []byte{0x01, 't'}, TemplateVersion: "t", RulesVersion: "r", CatalogVersion: "c",
		ContentEncodingVersion: 1, TemplateFCT1: make([]byte, 52), ContentSHA256: make([]byte, 32)}
}

func runIntake(pool *pgxpool.Pool, w Writer, acct int64, cmd string, commit bool) error {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	act := Actor{RealmID: testRealm, ServerID: 1, PlayerID: 42, AccountID: acct}
	if err := w.ApplyPendingIntake(ctx, tx, act, cmd, nil, samplePayload()); err != nil {
		return err
	}
	if commit {
		return tx.Commit(ctx)
	}
	return nil
}

func sceneUnauthorized(t *testing.T, pool *pgxpool.Pool, acct int64) {
	err := runIntake(pool, Writer{}, acct, "a1111111-1111-4111-8111-111111111111", false)
	if err == nil || !strings.Contains(err.Error(), "unauthorized") {
		t.Fatalf("want unauthorized, got %v", err)
	}
	var n int
	_ = pool.QueryRow(context.Background(), `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid`, testRealm).Scan(&n)
	if n != 0 {
		t.Fatalf("commands=%d", n)
	}
}

func sceneSubstituteFence(t *testing.T, pool *pgxpool.Pool, acct int64) {
	ctx := context.Background()
	tx, _ := pool.Begin(ctx)
	_, _ = tx.Exec(ctx, `CREATE TABLE harness_sub (slot int PRIMARY KEY); INSERT INTO harness_sub VALUES (1)`)
	var slot int
	_ = tx.QueryRow(ctx, `SELECT slot FROM harness_sub WHERE slot=1 FOR UPDATE`).Scan(&slot)
	w := Writer{Evidence: ObligationEvidence{ProfileComplete: true, SubstituteRowLockHeld: true, SubstituteDrainCounter: 99}}
	err := w.ApplyPendingIntake(ctx, tx, Actor{RealmID: testRealm, ServerID: 1, PlayerID: 42, AccountID: acct},
		"a2222222-2222-4222-8222-222222222222", nil, samplePayload())
	_ = tx.Rollback(ctx)
	if err == nil || !strings.Contains(err.Error(), "unauthorized") {
		t.Fatalf("substitute fence: %v", err)
	}
}

func scenePartialObligations(t *testing.T, pool *pgxpool.Pool, acct int64) {
	var inv [11]bool
	for i := 0; i < 10; i++ {
		inv[i] = true
	}
	err := runIntake(pool, Writer{Evidence: ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}},
		acct, "a3333333-3333-4333-8333-333333333333", false)
	if err == nil || !strings.Contains(err.Error(), "unauthorized") {
		t.Fatalf("partial: %v", err)
	}
}

func sceneAuthorizedPending(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "b4444444-4444-4444-8444-444444444444"
	if err := runIntake(pool, Writer{Evidence: drainAll()}, acct, cmd, true); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	var st int16
	var head string
	_ = pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st)
	_ = pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, testRealm).Scan(&head)
	var pc int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM player_city`).Scan(&pc)
	if st != 1 || head != cmd || pc != 0 {
		t.Fatalf("st=%d head=%q pc=%d", st, head, pc)
	}
}

func sceneLawfulMultiCity(t *testing.T, pool *pgxpool.Pool, acct int64) {
	ctx := context.Background()
	ret := "d5555555-5555-4555-8555-555555555555"
	p := samplePayload()
	_, _ = pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,
 terminal_at,success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,2,'t','r','c',1,$5,$6,now(),now(),88101,1,42,true,1,100)`, testRealm, ret, acct, p.CanonicalC1, p.TemplateFCT1, p.ContentSHA256)
	_, _ = pool.Exec(ctx, `INSERT INTO world_first_city_actor_slot VALUES ($1::uuid,1,42,$3,$2::uuid)`, testRealm, ret, acct)
	_, _ = pool.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88101,42,'首都',5,6,true)`)
	svc := world.NewService(world.NewPGStore(pool))
	tx, _ := pool.Begin(ctx)
	if _, err := svc.CreateCityInTx(ctx, tx, world.City{ServerID: 1, PlayerID: 42, Name: "分城", X: 30, Y: 31, WallLevel: 1, Morale: 100}); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&n)
	if n != 2 {
		t.Fatalf("cities=%d", n)
	}
}
