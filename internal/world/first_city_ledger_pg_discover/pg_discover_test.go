package firstcityledgerpgdiscover

import (
	"bytes"
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
	"github.com/jackc/pgx/v5/pgxpool"
)

const testRealm = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77"

func drainAll() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func TestPG17FirstCityLedgerDiscover(t *testing.T) {
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
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	specDir, _ := os.MkdirTemp("", "fc-pg-discover-specs-")
	defer func() { _ = os.RemoveAll(specDir) }()
	var paths []string
	for _, pat := range []string{"00*.sql", "m3_*.sql", "m4_*.sql"} {
		m, _ := filepath.Glob(filepath.Join(dir, "spec/db", pat))
		paths = append(paths, m...)
	}
	sort.Strings(paths)
	for _, p := range paths {
		b, _ := os.ReadFile(p)
		_ = os.WriteFile(filepath.Join(specDir, filepath.Base(p)), b, 0o600)
	}
	run := func(name string, fn func(*testing.T, *pgxpool.Pool, int64)) {
		t.Run(name, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			fn(t, pool, seedActor(t, pool))
			t.Logf("PASS pg_discover: %s", name)
		})
	}
	run("unauthorized_without_obligations_does_not_invent_empty", sceneUnauthorizedNoEmpty)
	run("certified_empty_head_maps_to_first_city_empty", sceneCertifiedEmpty)
	run("pending_head_returns_original_id_and_payload", scenePendingOriginal)
	run("in_flight_uncommitted_intake_is_not_empty", sceneInFlightNotEmpty)
	run("local_cleanup_does_not_clear_pending", sceneLocalCleanupNoClear)
}
func freshSchema(t *testing.T, admin *pgxpool.Pool, specDir string) (*pgxpool.Pool, func()) {
	t.Helper()
	ctx := context.Background()
	schema := fmt.Sprintf("fc_pg_discover_%d", time.Now().UnixNano())
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
	t.Helper()
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('pgd_u','pgd_h',1)`)
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	_, _ = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'pgd_p')`, acct)
	return acct
}
func act(acct int64) firstcityledgerpgintake.Actor {
	return firstcityledgerpgintake.Actor{RealmID: testRealm, ServerID: 1, PlayerID: 42, AccountID: acct}
}

func samplePayload() firstcityledgerpgintake.Payload {
	return firstcityledgerpgintake.Payload{CanonicalC1: []byte{0x01, 'd', 'i', 's', 'c'}, TemplateVersion: "t-disc",
		RulesVersion: "r", CatalogVersion: "c", ContentEncodingVersion: 1, TemplateFCT1: make([]byte, 52), ContentSHA256: make([]byte, 32)}
}

func commitIntake(pool *pgxpool.Pool, acct int64, cmd string, p firstcityledgerpgintake.Payload) error {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	w := firstcityledgerpgintake.Writer{Evidence: drainAll()}
	if err := w.ApplyPendingIntake(ctx, tx, act(acct), cmd, nil, p); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func sceneUnauthorizedNoEmpty(t *testing.T, pool *pgxpool.Pool, acct int64) {
	h, err := (&Discoverer{}).DiscoverSnapshot(context.Background(), pool, act(acct))
	if err == nil || !strings.Contains(err.Error(), "unauthorized") || h.Outcome == OutcomeFirstCityEmpty {
		t.Fatalf("unauth: h=%+v err=%v", h, err)
	}
}

func sceneCertifiedEmpty(t *testing.T, pool *pgxpool.Pool, acct int64) {
	h, err := (&Discoverer{Evidence: drainAll()}).DiscoverSnapshot(context.Background(), pool, act(acct))
	if err != nil || h.Outcome != OutcomeFirstCityEmpty {
		t.Fatalf("empty: %+v err=%v", h, err)
	}
}

func scenePendingOriginal(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd, want := "e7777777-7777-4777-8777-777777777777", samplePayload()
	if err := commitIntake(pool, acct, cmd, want); err != nil {
		t.Fatal(err)
	}
	h, err := (&Discoverer{Evidence: drainAll()}).DiscoverSnapshot(context.Background(), pool, act(acct))
	if err != nil || h.Outcome != OutcomePendingHead || h.CommandID != cmd || h.Durable != 1 ||
		!bytes.Equal(h.Payload.CanonicalC1, want.CanonicalC1) {
		t.Fatalf("pending %+v err=%v", h, err)
	}
}

func sceneInFlightNotEmpty(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "e8888888-8888-4888-8888-888888888888"
	hold, done := make(chan struct{}), make(chan struct{})
	p := samplePayload()
	go func() {
		ctx := context.Background()
		tx, err := pool.Begin(ctx)
		if err != nil {
			panic(err)
		}
		exec := func(sql string, args ...any) {
			if _, e := tx.Exec(ctx, sql, args...); e != nil {
				panic(e)
			}
		}
		exec(`SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, testRealm)
		exec(`INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT DO NOTHING`, testRealm, acct)
		exec(`INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,$5,$6,$7,$8,$9,$10,now())`,
			testRealm, cmd, acct, p.CanonicalC1, p.TemplateVersion, p.RulesVersion, p.CatalogVersion, p.ContentEncodingVersion, p.TemplateFCT1, p.ContentSHA256)
		close(hold)
		time.Sleep(60 * time.Millisecond)
		exec(`UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, testRealm, cmd)
		if err := tx.Commit(ctx); err != nil {
			panic(err)
		}
		close(done)
	}()
	<-hold
	h, _ := (&Discoverer{Evidence: drainAll()}).DiscoverSnapshot(context.Background(), pool, act(acct))
	if h.Outcome == OutcomeFirstCityEmpty || h.Outcome != OutcomeUnknown {
		t.Fatalf("in-flight snap %+v", h)
	}
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx := context.Background()
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Error(err)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()
		h2, err := (&Discoverer{Evidence: drainAll()}).DiscoverWithLockBoundary(ctx, tx, act(acct))
		if err != nil || h2.CommandID != cmd || h2.Outcome != OutcomePendingHead {
			t.Errorf("lock %+v err=%v", h2, err)
			return
		}
		_ = tx.Commit(ctx)
	}()
	wg.Wait()
	<-done
	h3, err := (&Discoverer{Evidence: drainAll()}).DiscoverSnapshot(context.Background(), pool, act(acct))
	if err != nil || h3.CommandID != cmd || h3.Outcome != OutcomePendingHead {
		t.Fatalf("post %+v err=%v", h3, err)
	}
}

func sceneLocalCleanupNoClear(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "e9999999-9999-4999-8999-999999999999"
	if err := commitIntake(pool, acct, cmd, samplePayload()); err != nil {
		t.Fatal(err)
	}
	h, err := (&Discoverer{Evidence: drainAll(), LocalPath: LocalPath{LeaseReleased: true, Cleanup: true, Timeout: true}}).
		DiscoverSnapshot(context.Background(), pool, act(acct))
	if err != nil || h.CommandID != cmd || h.Outcome != OutcomePendingHead {
		t.Fatalf("cleanup %+v err=%v", h, err)
	}
	ctx := context.Background()
	var head string
	var st int16
	_ = pool.QueryRow(ctx, `SELECT s.head_command_id::text,c.durable_state FROM world_first_city_actor_slot s
 JOIN world_first_city_command c ON c.command_id=s.head_command_id
 WHERE s.realm_id=$1::uuid AND s.server_id=1 AND s.player_id=42`, testRealm).Scan(&head, &st)
	if head != cmd || st != 1 {
		t.Fatalf("row head=%q st=%d", head, st)
	}
}
