package firstcityledgerpgunknowndrain

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
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const testRealm = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

func drainAll() firstcityledgerpgintake.ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return firstcityledgerpgintake.ObligationEvidence{ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true}
}

func ctl() *Controller { return &Controller{Evidence: drainAll(), RealmID: testRealm} }

func TestPG17FirstCityLedgerUnknownDrain(t *testing.T) {
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
	for _, tc := range []struct {
		name string
		fn   func(*testing.T, *pgxpool.Pool)
	}{
		{"poison_receipt_drain_unresolved_no_admit", scPoisonReceipt},
		{"sibling_unknown_receipt_no_drain", scSiblingUnknown},
		{"local_release_cancel_no_false_drained", scLocalRelease},
		{"normal_close_drain_new_generation_continue", scNormalCloseDrain},
		{"new_generation_after_drain_poison_blocked", scPoisonBlocksNewGen},
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

func scPoisonReceipt(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	cmd := "c1111111-1111-4111-8111-111111111111"
	acct := seedAcct(t, pool)
	seedCmd(t, pool, cmd, acct, 11)
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.ApplyPoison(context.Background(), tx) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.WriteReceipt(context.Background(), tx, cmd, 3, "known_reject") }))
	g, _ := readGate(t, pool)
	chk(t, g.Admission == "poisoned" && g.Drain == "unresolved")
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryAcquireAdmission(context.Background(), tx, "f1111111-1111-4111-8111-111111111111", 1)
	}))
}

func scSiblingUnknown(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	cmdA, cmdB := "c2222222-2222-4222-8222-222222222222", "c3333333-3333-4333-8333-333333333333"
	acct := seedAcct(t, pool)
	seedCmd(t, pool, cmdA, acct, 12)
	seedCmd(t, pool, cmdB, acct, 13)
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.ApplyPoison(context.Background(), tx) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.MarkCommandUnknown(context.Background(), tx, cmdA) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.WriteReceipt(context.Background(), tx, cmdB, 2, "known_success") }))
	g, _ := readGate(t, pool)
	chk(t, g.Admission == "poisoned" && g.Drain == "unresolved")
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryAcquireAdmission(context.Background(), tx, "f2222222-2222-4222-8222-222222222222", 1)
	}))
}

func scLocalRelease(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	cmd := "c4444444-4444-4444-8444-444444444444"
	lease := "f4444444-4444-4444-8444-444444444444"
	acct := seedAcct(t, pool)
	seedCmd(t, pool, cmd, acct, 14)
	mustExec(t, pool, `INSERT INTO harness_lease (lease_id,realm_id,generation) VALUES ($1::uuid,$2::uuid,1)`, lease, testRealm)
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.ApplyPoison(context.Background(), tx) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.MarkCommandUnknown(context.Background(), tx, cmd) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.LocalReleaseLease(context.Background(), tx, lease) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.BumpLocalCleanup(context.Background(), tx) }))
	g, _ := readGate(t, pool)
	chk(t, g.Drain == "unresolved")
}

func scNormalCloseDrain(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	cmd := "c5555555-5555-4555-8555-555555555555"
	lease := "f5555555-5555-4555-8555-555555555555"
	acct := seedAcct(t, pool)
	seedCmd(t, pool, cmd, acct, 15)
	mustExec(t, pool, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1::uuid,$2::uuid,1,'held')`, lease, testRealm)
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.RequestClose(context.Background(), tx) }))
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryDeclareDrained(context.Background(), tx) }))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) {
		tag, err := tx.Exec(context.Background(), `UPDATE harness_lease SET status='ended',ended_at=now() WHERE lease_id=$1::uuid AND status='held'`, lease)
		if err != nil || tag.RowsAffected() != 1 {
			return false, err
		}
		tag, err = tx.Exec(context.Background(), `UPDATE harness_command SET ending='known_success' WHERE command_id=$1::uuid`, cmd)
		return err == nil && tag.RowsAffected() == 1, err
	}))
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryDeclareDrained(context.Background(), tx) }))
	g, _ := readGate(t, pool)
	chk(t, g.Admission == "open" && g.Drain == "pending" && g.Generation == 2)
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryAcquireAdmission(context.Background(), tx, "f6666666-6666-4666-8666-666666666666", 2)
	}))
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryAcquireAdmission(context.Background(), tx, "f7777777-7777-4777-8777-777777777777", 1)
	}))
}

func scPoisonBlocksNewGen(t *testing.T, pool *pgxpool.Pool) {
	c := ctl()
	chk(t, doTx(pool, func(tx pgx.Tx) (bool, error) { return c.ApplyPoison(context.Background(), tx) }))
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) { return c.TryDeclareDrained(context.Background(), tx) }))
	g, _ := readGate(t, pool)
	chk(t, g.Drain == "unresolved")
	chk(t, !doTx(pool, func(tx pgx.Tx) (bool, error) {
		return c.TryAcquireAdmission(context.Background(), tx, "f8888888-8888-4888-8888-888888888888", 2)
	}))
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
	if err := InstallDisposableFixture(ctx, pool, testRealm); err != nil {
		t.Fatal(err)
	}
	c := &Controller{RealmID: testRealm}
	ok, err := doTxErr(pool, func(tx pgx.Tx) (bool, error) { return c.TryDeclareDrained(context.Background(), tx) })
	if ok || err != ErrUnauthorized {
		t.Fatalf("fail-closed: ok=%v err=%v", ok, err)
	}
}

func doTx(pool *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) bool {
	ok, err := doTxErr(pool, fn)
	if err != nil {
		panic(err)
	}
	return ok
}

func doTxErr(pool *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) (bool, error) {
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

var mapY = 20

func seedCmd(t *testing.T, pool *pgxpool.Pool, cmdID string, acct int64, mapX int) {
	t.Helper()
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	mapY++
	mustExec(t, pool, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,1)`, mapX, mapY)
	mustExec(t, pool, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,43,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, testRealm, cmdID, acct, c1, fct1, sha)
	mustExec(t, pool, `INSERT INTO harness_command (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmdID, testRealm)
}

func stageSpecs(t *testing.T) string {
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-unk-drain-specs-")
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
	schema := fmt.Sprintf("fc_unk_drain_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, _ := pgxpool.ParseConfig(os.Getenv("FIRST_CITY_LEDGER_TEST_DSN"))
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
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
	mustExec(t, pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('ud_u','ud_h',1)`)
	var acct int64
	if err := pool.QueryRow(context.Background(), `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	mustExec(t, pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,43,$1,'ud_p')`, acct)
	return acct
}

func mustExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
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

func readGate(t *testing.T, pool *pgxpool.Pool) (GateSnapshot, error) {
	t.Helper()
	return ctl().ReadGate(context.Background(), pool)
}
