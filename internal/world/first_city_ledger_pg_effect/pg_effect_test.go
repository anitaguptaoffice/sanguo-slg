package firstcityledgerpgeffect

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

const testRealm = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77"

func drainAll() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}
func fx() *Writer { return &Writer{Evidence: drainAll(), Placement: Placement{CityID: int32(DefaultFixtureCityID), MapX: 10, MapY: 20}} }
func act(acct int64) firstcityledgerpgintake.Actor {
	return firstcityledgerpgintake.Actor{RealmID: testRealm, ServerID: 1, PlayerID: 42, AccountID: acct}
}

func TestPG17FirstCityLedgerEffect(t *testing.T) {
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
	specDir := stageSpecs(t)
	defer func() { _ = os.RemoveAll(specDir) }()
	run := func(name string, fn func(*testing.T, *pgxpool.Pool, int64)) {
		t.Run(name, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			fn(t, pool, seedActor(t, pool))
		})
	}
	run("unauthorized_without_obligations_does_not_write_effects", scUnauth)
	run("authorized_pending_commits_full_effect_and_success_receipt", scFull)
	run("no_partial_business_without_receipt", scNoPartial)
	run("in_flight_uncommitted_effect_is_still_pending", scInFlight)
	run("failed_effect_rolls_back_entire_transaction", scRollback)
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, _ := os.MkdirTemp("", "fc-pge-specs-")
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
	schema := fmt.Sprintf("fc_pge_%d", time.Now().UnixNano())
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
	_, err = pool.Exec(ctx, `CREATE TABLE mil_city_origin (server_id int NOT NULL CHECK (server_id>0),city_id bigint NOT NULL,
owner_player_id bigint NOT NULL,cohort_id bytea NOT NULL,format_version smallint NOT NULL,created_at timestamptz NOT NULL,PRIMARY KEY (server_id,city_id))`)
	if err != nil {
		t.Fatal(err)
	}
	return pool, func() { pool.Close(); _, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") }
}

func seedActor(t *testing.T, pool *pgxpool.Pool) int64 {
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('pge_u','pge_h',1)`)
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	_, _ = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'pge_p')`, acct)
	_, _ = pool.Exec(ctx, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,10,20,4)`)
	return acct
}

func commitIntake(pool *pgxpool.Pool, acct int64, cmd string) error {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	p := firstcityledgerpgintake.Payload{CanonicalC1: []byte{1}, TemplateVersion: "t", RulesVersion: "r", CatalogVersion: "c",
		ContentEncodingVersion: 1, TemplateFCT1: make([]byte, 52), ContentSHA256: make([]byte, 32)}
	iw := &firstcityledgerpgintake.Writer{Evidence: drainAll()}
	if err := iw.ApplyPendingIntake(ctx, tx, act(acct), cmd, nil, p); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func bizN(ctx context.Context, pool *pgxpool.Pool) int {
	var n int
	_ = pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+
(SELECT count(*) FROM player_city WHERE server_id=1 AND city_id=$1 AND player_id=42)+
(SELECT count(*) FROM city_troop WHERE server_id=1 AND city_id=$1)+
(SELECT count(*) FROM mil_city_origin WHERE server_id=1 AND city_id=$1)+
(SELECT count(*) FROM city_production_checkpoint WHERE server_id=1 AND city_id=$1)+
(SELECT count(*) FROM city_building WHERE server_id=1 AND city_id=$1)`, DefaultFixtureCityID).Scan(&n)
	return n
}

func assertFull(t *testing.T, pool *pgxpool.Pool, cmd string) {
	var st int16
	var sid int64
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `SELECT durable_state,success_city_id FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).
		Scan(&st, &sid); err != nil || st != 2 || sid != DefaultFixtureCityID || bizN(ctx, pool) != 6 {
		t.Fatalf("full st=%d sid=%d biz=%d err=%v", st, sid, bizN(ctx, pool), err)
	}
}

func scUnauth(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "f1111111-1111-4111-8111-111111111111"
	if err := commitIntake(pool, acct, cmd); err != nil {
		t.Fatal(err)
	}
	err := (&Writer{}).CommitSuccessEffect(context.Background(), pool, act(acct), cmd)
	ctx := context.Background()
	var st int16
	_ = pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st)
	if err == nil || !strings.Contains(err.Error(), "unauthorized") || bizN(ctx, pool) != 0 || st != 1 {
		t.Fatalf("unauth err=%v st=%d biz=%d", err, st, bizN(ctx, pool))
	}
}

func scFull(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "f2222222-2222-4222-8222-222222222222"
	if err := commitIntake(pool, acct, cmd); err != nil {
		t.Fatal(err)
	}
	if err := fx().CommitSuccessEffect(context.Background(), pool, act(acct), cmd); err != nil {
		t.Fatal(err)
	}
	assertFull(t, pool, cmd)
}

func scNoPartial(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "f3333333-3333-4333-8333-333333333333"
	if err := commitIntake(pool, acct, cmd); err != nil {
		t.Fatal(err)
	}
	if err := fx().CommitSuccessEffect(context.Background(), pool, act(acct), cmd); err != nil {
		t.Fatal(err)
	}
	assertFull(t, pool, cmd)
	var n int
	_ = pool.QueryRow(context.Background(), `SELECT count(*) FROM world_first_city_command WHERE durable_state=2 AND success_city_id<>$1`, DefaultFixtureCityID).Scan(&n)
	if n != 0 {
		t.Fatalf("partial n=%d", n)
	}
}

func scInFlight(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "f4444444-4444-4444-8444-444444444444"
	if err := commitIntake(pool, acct, cmd); err != nil {
		t.Fatal(err)
	}
	hold, done := make(chan struct{}), make(chan struct{})
	go func() {
		ctx := context.Background()
		tx, err := pool.Begin(ctx)
		if err != nil {
			panic(err)
		}
		w := fx()
		if err := w.lockPending(ctx, tx, act(acct), cmd); err != nil || w.writeBusiness(ctx, tx, act(acct), w.Placement) != nil {
			panic(err)
		}
		close(hold)
		time.Sleep(80 * time.Millisecond)
		if err := w.writeReceipt(ctx, tx, act(acct), cmd, DefaultFixtureCityID); err != nil || tx.Commit(ctx) != nil {
			panic(err)
		}
		close(done)
	}()
	<-hold
	ctx := context.Background()
	var st int16
	_ = pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st)
	if st != 1 || bizN(ctx, pool) != 0 {
		t.Fatalf("open st=%d biz=%d", st, bizN(ctx, pool))
	}
	<-done
	assertFull(t, pool, cmd)
}

func scRollback(t *testing.T, pool *pgxpool.Pool, acct int64) {
	cmd := "f5555555-5555-4555-8555-555555555555"
	if err := commitIntake(pool, acct, cmd); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
 VALUES (1,$1,99,'blocker',99,99,false,1,1)`, DefaultFixtureCityID)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := fx().applyInTx(ctx, tx, act(acct), cmd); err == nil {
		t.Fatal("wanted failure")
	}
	_ = tx.Rollback(ctx)
	var st int16
	var w int
	_ = pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&st)
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42`).Scan(&w)
	if st != 1 || w != 0 || bizN(ctx, pool) != 0 {
		t.Fatalf("rollback st=%d wallet=%d biz=%d", st, w, bizN(ctx, pool))
	}
}
