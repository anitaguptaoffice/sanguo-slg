package firstcityledgerpgpendinguniqueindex

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

const realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

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

func TestPG17PendingUniqueMatrix(t *testing.T) {
	admin, _ := pg17OrSkip(t)
	ctx := context.Background()
	specDir := stageSpecs(t)
	t.Cleanup(func() { _ = os.RemoveAll(specDir) })

	run := func(fn func(*testing.T, *pgxpool.Pool)) {
		pool, done := freshSchema(t, admin, specDir)
		defer done()
		if err := AssertPartialUniqueIndex(ctx, pool); err != nil {
			t.Fatal(err)
		}
		fn(t, pool)
	}

	ev := FullObligationEvidence()

	run(func(t *testing.T, pool *pgxpool.Pool) {
		acct := seedAcct(t, pool, 42, "puniq_u42")
		actor := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acct}
		cmdA := "31000000-0000-4000-8000-000000000001"
		cmdB := "31000000-0000-4000-8000-000000000002"
		mA := NewMatrix(ev, actor, cmdA, PayloadByte(0x01))
		if err := mA.InsertPendingOnce(ctx, pool); err != nil {
			t.Fatal(err)
		}
		mB := NewMatrix(ev, actor, cmdB, PayloadByte(0x02))
		err := mB.InsertPendingOnce(ctx, pool)
		if err == nil || !IsUniqueViolation(err) {
			t.Fatalf("second PENDING: %v", err)
		}
		n, err := mA.PendingCount(ctx, pool)
		if err != nil || n != 1 {
			t.Fatalf("pending count: n=%d err=%v", n, err)
		}
		t.Log("PASS pending_unique: sequential second PENDING rejected (23505)")
	})

	run(func(t *testing.T, pool *pgxpool.Pool) {
		acct := seedAcct(t, pool, 42, "puniq_r42")
		actor := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acct}
		cmdA := "32000000-0000-4000-8000-000000000001"
		cmdB := "32000000-0000-4000-8000-000000000002"
		mA := NewMatrix(ev, actor, cmdA, PayloadByte(0x11))
		mB := NewMatrix(ev, actor, cmdB, PayloadByte(0x11))
		okA, okB, errA, errB := DualConcurrentInsert(ctx, pool, mA, mB)
		wins := 0
		if okA {
			wins++
		}
		if okB {
			wins++
		}
		if wins != 1 {
			t.Fatalf("concurrent: wins=%d okA=%v okB=%v", wins, okA, okB)
		}
		if !((errA != nil && IsUniqueViolation(errA)) || (errB != nil && IsUniqueViolation(errB))) {
			t.Fatalf("loser 23505: errA=%v errB=%v", errA, errB)
		}
		n, err := mA.PendingCount(ctx, pool)
		if err != nil || n != 1 {
			t.Fatalf("one PENDING after race: n=%d", n)
		}
		t.Log("PASS pending_unique: concurrent duplicate PENDING race")
	})

	run(func(t *testing.T, pool *pgxpool.Pool) {
		acct42 := seedAcct(t, pool, 42, "puniq_d42")
		acct43 := seedAcct(t, pool, 43, "puniq_u43")
		a42 := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acct42}
		a43 := Actor{RealmID: realm, ServerID: 1, PlayerID: 43, AccountID: acct43}
		if err := NewMatrix(ev, a42, "33000000-0000-4000-8000-000000000001", PayloadByte(0x21)).InsertPendingOnce(ctx, pool); err != nil {
			t.Fatal(err)
		}
		if err := NewMatrix(ev, a43, "33000000-0000-4000-8000-000000000002", PayloadByte(0x22)).InsertPendingOnce(ctx, pool); err != nil {
			t.Fatal(err)
		}
		n, err := GlobalPendingCount(ctx, pool)
		if err != nil || n != 2 {
			t.Fatalf("two slots PENDING: n=%d", n)
		}
		t.Log("PASS pending_unique: distinct actor slots independent")
	})

	run(func(t *testing.T, pool *pgxpool.Pool) {
		acct := seedAcct(t, pool, 42, "puniq_t42")
		actor := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acct}
		old := "34000000-0000-4000-8000-000000000001"
		newP := "34000000-0000-4000-8000-000000000002"
		mOld := NewMatrix(ev, actor, old, PayloadByte(0x31))
		if err := mOld.InsertPendingOnce(ctx, pool); err != nil {
			t.Fatal(err)
		}
		if err := mOld.MarkSucceeded(ctx, pool); err != nil {
			t.Fatal(err)
		}
		mNew := NewMatrix(ev, actor, newP, PayloadByte(0x32))
		if err := mNew.InsertPendingOnce(ctx, pool); err != nil {
			t.Fatal(err)
		}
		n, err := mNew.PendingCount(ctx, pool)
		if err != nil || n != 1 {
			t.Fatalf("new PENDING after SUCCEEDED: n=%d", n)
		}
		if err := mNew.MarkRejected(ctx, pool); err != nil {
			t.Fatal(err)
		}
		next := "34000000-0000-4000-8000-000000000004"
		mNext := NewMatrix(ev, actor, next, PayloadByte(0x34))
		if err := mNext.InsertPendingOnce(ctx, pool); err != nil {
			t.Fatal(err)
		}
		n, err = mNext.PendingCount(ctx, pool)
		if err != nil || n != 1 {
			t.Fatalf("single open PENDING after terminals: n=%d", n)
		}
		t.Log("PASS pending_unique: SUCCEEDED/REJECTED rows outside partial key")
	})

	run(func(t *testing.T, pool *pgxpool.Pool) {
		acct42 := seedAcct(t, pool, 42, "puniq_x42")
		acct43 := seedAcct(t, pool, 43, "puniq_x43")
		a42 := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acct42}
		a43 := Actor{RealmID: realm, ServerID: 1, PlayerID: 43, AccountID: acct43}
		cmd := "35000000-0000-4000-8000-00000000beef"
		if err := NewMatrix(ev, a42, cmd, PayloadByte(0x41)).InsertPendingOnce(ctx, pool); err != nil {
			t.Fatal(err)
		}
		if err := NewMatrix(ev, a43, cmd, PayloadByte(0x42)).InsertPendingOnce(ctx, pool); err != nil {
			t.Fatal(err)
		}
		n, err := PendingCountByCommandID(ctx, pool, cmd)
		if err != nil || n != 2 {
			t.Fatalf("shared command_id across actors: n=%d", n)
		}
		t.Log("PASS pending_unique: cross-actor same command_id unaffected")
	})
}

func TestUnauthorizedFailClosed(t *testing.T) {
	admin, _ := pg17OrSkip(t)
	ctx := context.Background()
	specDir := stageSpecs(t)
	t.Cleanup(func() { _ = os.RemoveAll(specDir) })
	pool, done := freshSchema(t, admin, specDir)
	defer done()

	acct := seedAcct(t, pool, 99, "puniq_unauth")
	actor := Actor{RealmID: realm, ServerID: 1, PlayerID: 99, AccountID: acct}
	m := UnauthorizedMatrix(actor, "90000000-0000-4000-8000-000000000099", PayloadByte(0x01))
	if err := m.FailClosedInsert(ctx, pool); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid`, realm).Scan(&n); err != nil || n != 0 {
		t.Fatalf("no commands: n=%d err=%v", n, err)
	}
}

func TestSkipWithoutEnv(t *testing.T) {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") == "1" && os.Getenv("FIRST_CITY_LEDGER_TEST_DSN") != "" {
		t.Skip("covered by PG17 matrix")
	}
}

func seedAcct(t *testing.T, pool *pgxpool.Pool, playerID int64, login string) int64 {
	t.Helper()
	ctx := context.Background()
	_, err := pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ($1,$2,1)`, login, login+"_h")
	if err != nil {
		t.Fatal(err)
	}
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name=$1`, login).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,$1,$2,$3)`, playerID, acct, login+"_p")
	if err != nil {
		t.Fatal(err)
	}
	return acct
}

func stageSpecs(t *testing.T) string {
	t.Helper()
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-pend-uniq-specs-")
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
	schema := fmt.Sprintf("fc_pend_uniq_%x_%d", time.Now().UnixNano(), schemaSerial)
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
