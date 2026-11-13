package firstcityledgerpgphaseadmission

import (
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
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const testRealm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const testCmd = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"

func drainAll() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}
func ctl() *Controller { return &Controller{Evidence: drainAll(), RealmID: testRealm} }

func TestPG17FirstCityLedgerPhaseAdmission(t *testing.T) {
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
	for _, tc := range []struct{ name string; fn func(*testing.T, *pgxpool.Pool) }{
		{"unauthorized_fail_closed", scUnauth},
		{"close_wins_rejects_new_admission_held_lease_may_finish", scCloseHeld},
		{"poison_wins_rejects_new_lease_or_begin_pending_unchanged", scPoisonPending},
		{"check_then_begin_without_gate_is_not_contract_legal", scLinearization},
		{"ended_lease_begin_without_new_admission_rejected", scEndedLease},
		{"cleanup_after_poison_leaves_drain_unresolved", scCleanupDrain},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pool, done := freshSchema(t, admin, specDir)
			defer done()
			if err := InstallDisposableFixture(ctx, pool, testRealm); err != nil {
				t.Fatal(err)
			}
			tc.fn(t, pool)
		})
	}
}

func scUnauth(t *testing.T, pool *pgxpool.Pool) {
	c := &Controller{RealmID: testRealm}
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	ok, err := c.TryAcquireAdmission(ctx, tx, testCmd, 1)
	_ = tx.Rollback(ctx)
	if ok || err != ErrUnauthorized {
		t.Fatalf("fail-closed: ok=%v err=%v", ok, err)
	}
}

func scCloseHeld(t *testing.T, pool *pgxpool.Pool) {
	c, held, newL := ctl(), "f1111111-1111-4111-8111-111111111111", "f2222222-2222-4222-8222-222222222222"
	mustExec(t, pool, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1::uuid,$2::uuid,1,'held')`, held, testRealm)
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.RequestClose(context.Background(), tx) }))
	adm, drain, _ := readGate(t, pool)
	chk(t, adm == "closed" && drain == "pending")
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryAcquireAdmission(context.Background(), tx, newL, 1) }))
	ex := leaseExists(t, pool, newL)
	chk(t, !ex)
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryRecordBegin(context.Background(), tx, held, "effect_begin") }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.EndLease(context.Background(), tx, held) }))
	st, ph := readLease(t, pool, held)
	chk(t, st == "ended" && ph == "effect_begin")
}

func scPoisonPending(t *testing.T, pool *pgxpool.Pool) {
	c, lease := ctl(), "f3333333-3333-4333-8333-333333333333"
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryAcquireAdmission(context.Background(), tx, lease, 1) }))
	acct := seedAcct(t, pool)
	seedPending(t, pool, acct)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		wg.Wait()
		chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.ApplyPoison(context.Background(), tx) }))
	}()
	conn, _ := pool.Acquire(context.Background())
	tx, _ := conn.Begin(context.Background())
	wg.Done()
	time.Sleep(20 * time.Millisecond)
	ok, err := c.TryRecordBegin(context.Background(), tx, lease, "finalizer_begin")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		_ = tx.Commit(context.Background())
	} else {
		_ = tx.Rollback(context.Background())
	}
	conn.Release()
	adm, drain, _ := readGate(t, pool)
	chk(t, adm == "poisoned" && drain == "unresolved" && !ok && cmdState(t, pool) == 1)
}

func scLinearization(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	l1, l2 := "f4444444-4444-4444-8444-444444444444", "f5555555-5555-4555-8555-555555555555"
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryAcquireAdmission(context.Background(), tx, l1, 1) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.IllegalCheckThenBegin(context.Background(), tx, l1) }))
	st, ph := readLease(t, pool, l1)
	chk(t, st == "held" && ph == "finalizer_begin")
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryRecordBegin(context.Background(), tx, l1, "effect_begin") }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.ApplyPoison(context.Background(), tx) }))
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) { return c.IllegalCheckThenBegin(context.Background(), tx, l1) }))
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryRecordBegin(context.Background(), tx, l1, "finalizer_begin") }))
	mustExec(t, pool, `UPDATE harness_source_gate SET admission='open', drain='pending' WHERE realm_id=$1::uuid`, testRealm)
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryAcquireAdmission(context.Background(), tx, l2, 1) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryRecordBegin(context.Background(), tx, l2, "effect_begin") }))
}

func scEndedLease(t *testing.T, pool *pgxpool.Pool) {
	c, l := ctl(), "f6666666-6666-4666-8666-666666666666"
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryAcquireAdmission(context.Background(), tx, l, 1) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.EndLease(context.Background(), tx, l) }))
	st, _ := readLease(t, pool, l)
	adm, _, _ := readGate(t, pool)
	chk(t, st == "ended" && adm == "open")
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryRecordBegin(context.Background(), tx, l, "effect_begin") }))
}

func scCleanupDrain(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.ApplyPoison(context.Background(), tx) }))
	mustExec(t, pool, `UPDATE harness_source_gate SET cleanup_attempts=cleanup_attempts+1 WHERE realm_id=$1::uuid`, testRealm)
	adm, drain, cleanup := readGate(t, pool)
	chk(t, adm == "poisoned" && drain == "unresolved" && cleanup == 1)
}

func doTx(pool *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) bool {
	ctx := context.Background()
	c, err := pool.Acquire(ctx)
	if err != nil {
		panic(err)
	}
	defer c.Release()
	tx, err := c.Begin(ctx)
	if err != nil {
		panic(err)
	}
	ok, err := fn(tx)
	if err != nil {
		_ = tx.Rollback(ctx)
		panic(err)
	}
	if ok {
		if err := tx.Commit(ctx); err != nil {
			panic(err)
		}
	} else {
		_ = tx.Rollback(ctx)
	}
	return ok
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-pha-specs-")
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
	schema := fmt.Sprintf("fc_pha_%d", time.Now().UnixNano())
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

func seedAcct(t *testing.T, pool *pgxpool.Pool) int64 {
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('pha_u','pha_h',1)`)
	var acct int64
	if err := pool.QueryRow(context.Background(), `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'pha_p')`, acct)
	return acct
}

func seedPending(t *testing.T, pool *pgxpool.Pool, acct int64) {
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	mustExec(t, pool, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,10,20,1)`)
	mustExec(t, pool, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, testRealm, testCmd, acct, c1, fct1, sha)
	mustExec(t, pool, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,$3::uuid)`, testRealm, acct, testCmd)
}

func cmdState(t *testing.T, pool *pgxpool.Pool) int16 {
	var s int16
	if err := pool.QueryRow(context.Background(), `SELECT durable_state FROM world_first_city_command WHERE realm_id=$1::uuid AND command_id=$2::uuid`, testRealm, testCmd).Scan(&s); err != nil {
		t.Fatal(err)
	}
	return s
}

func mustExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}
func chk(t *testing.T, ok bool) {
	t.Helper()
	if !ok {
		t.Fatal("assertion failed")
	}
}

func readGate(t *testing.T, pool *pgxpool.Pool) (adm, drain string, cleanup int) {
	t.Helper()
	if err := pool.QueryRow(context.Background(), `SELECT admission,drain,cleanup_attempts FROM harness_source_gate WHERE realm_id=$1::uuid`, testRealm).
		Scan(&adm, &drain, &cleanup); err != nil {
		t.Fatal(err)
	}
	return
}

func readLease(t *testing.T, pool *pgxpool.Pool, id string) (status, phase string) {
	t.Helper()
	var ph *string
	if err := pool.QueryRow(context.Background(), `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid`, id).Scan(&status, &ph); err != nil {
		t.Fatal(err)
	}
	if ph != nil {
		phase = *ph
	}
	return
}

func leaseExists(t *testing.T, pool *pgxpool.Pool, id string) bool {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM harness_lease WHERE lease_id=$1::uuid`, id).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n > 0
}
