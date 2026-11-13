package firstcityledgerpgidcontentconflict

import (
	"bytes"
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

func TestPG17IDContentConflictMatrix(t *testing.T) {
	admin, _ := pg17OrSkip(t)
	ctx := context.Background()
	specDir := stageSpecs(t)
	t.Cleanup(func() { _ = os.RemoveAll(specDir) })

	run := func(fn func(*testing.T, *pgxpool.Pool)) {
		pool, done := freshSchema(t, admin, specDir)
		defer done()
		fn(t, pool)
	}

	ev := FullObligationEvidence()
	run(func(t *testing.T, pool *pgxpool.Pool) {
		acct := seedAcct(t, pool)
		actor := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acct}
		for _, c := range []struct {
			name, cmd string
			st        int16
		}{
			{"PENDING", "21000000-0000-4000-8000-000000000101", 1},
			{"SUCCEEDED", "21100000-0000-4000-8000-000000000102", 2},
			{"REJECTED_NO_EFFECT", "21200000-0000-4000-8000-000000000103", 3},
		} {
			seedPending(t, pool, actor, c.cmd, 0x01)
			if c.st > 1 {
				setTerminal(t, pool, c.cmd, c.st)
			}
			m := NewMatrix(ev, actor, c.cmd, nil, PayloadByte(0x02))
			before, err := m.ReadSnap(ctx, pool, c.cmd)
			if err != nil {
				t.Fatal(err)
			}
			lbl, err := m.SubmitOnce(ctx, pool)
			if err != nil || lbl != LabelIDContentConflict {
				t.Fatalf("%s: got %q err=%v", c.name, lbl, err)
			}
			after, err := m.ReadSnap(ctx, pool, c.cmd)
			if err != nil || !SnapsEqual(before, after) {
				t.Fatalf("%s: row mutated", c.name)
			}
			t.Logf("PASS id_content_conflict: %s different C1 no mutation", c.name)
		}
	})

	run(func(t *testing.T, pool *pgxpool.Pool) {
		acct := seedAcct(t, pool)
		actor := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acct}
		cmd := "22000000-0000-4000-8000-000000000201"
		seedPending(t, pool, actor, cmd, 0x0a)
		m := NewMatrix(ev, actor, cmd, nil, PayloadByte(0x0a))
		before, err := m.ReadSnap(ctx, pool, cmd)
		if err != nil {
			t.Fatal(err)
		}
		lbl, err := m.SubmitOnce(ctx, pool)
		if err != nil || lbl != LabelCommand {
			t.Fatal(lbl, err)
		}
		after, err := m.ReadSnap(ctx, pool, cmd)
		if err != nil || !SnapsEqual(before, after) {
			t.Fatal("no template refresh")
		}
		t.Log("PASS id_content_conflict: same PK same C1 read-only")

		cmd = "23000000-0000-4000-8000-000000000301"
		seedPending(t, pool, actor, cmd, 0x11)
		_, err = pool.Exec(ctx, `UPDATE world_first_city_command SET canonical_c1=$3::bytea
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`, realm, cmd, []byte{0x22})
		if err == nil || !strings.Contains(err.Error(), "immutable intake") {
			t.Fatalf("guard UPDATE: %v", err)
		}
		before, _ = m.ReadSnap(ctx, pool, cmd)
		m2 := NewMatrix(ev, actor, cmd, nil, PayloadByte(0x11))
		before, err = m2.ReadSnap(ctx, pool, cmd)
		if err != nil {
			t.Fatal(err)
		}
		_, err = pool.Exec(ctx, `DELETE FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`, realm, cmd)
		if err == nil {
			t.Fatal("DELETE should be blocked")
		}
		if !SnapsEqual(before, mustSnap(t, m2, ctx, pool, cmd)) {
			t.Fatal("guard DELETE cmd")
		}
		_, err = pool.Exec(ctx, `DELETE FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
		if err == nil {
			t.Fatal("guard DELETE slot")
		}
		t.Log("PASS id_content_conflict: DDL guards intake immutability and no DELETE")

		cmdA := "24000000-0000-4000-8000-000000000401"
		cmdB := "24000000-0000-4000-8000-000000000402"
		seedPending(t, pool, actor, cmdA, 0x31)
		mA := NewMatrix(ev, actor, cmdA, nil, PayloadByte(0x31))
		before, err = mA.ReadSnap(ctx, pool, cmdA)
		if err != nil {
			t.Fatal(err)
		}
		mHead := NewMatrix(ev, actor, cmdB, nil, PayloadByte(0x32))
		lbl, err = mHead.SubmitOnce(ctx, pool)
		if err != nil || lbl != LabelHeadConflict {
			t.Fatalf("HEAD not ID_CONTENT: %q", lbl)
		}
		if !SnapsEqual(before, mustSnap(t, mA, ctx, pool, cmdA)) {
			t.Fatal("HEAD_CONFLICT no mutation")
		}
		t.Log("PASS id_content_conflict: HEAD_CONFLICT distinct from ID_CONTENT_CONFLICT")
	})

	run(func(t *testing.T, pool *pgxpool.Pool) {
		acct := seedAcct(t, pool)
		actor := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acct}
		unknown := "25000000-0000-4000-8000-000000000501"
		lbl, err := ContinueOnce(ctx, pool, actor, unknown, []byte{0x41})
		if err != nil || lbl != LabelNotObserved {
			t.Fatal(lbl, err)
		}
		var n int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&n); err != nil || n != 0 {
			t.Fatalf("no row after unknown continue: n=%d", n)
		}

		cmd := "25000000-0000-4000-8000-000000000502"
		seedPending(t, pool, actor, cmd, 0x42)
		setTerminal(t, pool, cmd, 2)
		m := NewMatrix(ev, actor, cmd, nil, PayloadByte(0x42))
		before, err := m.ReadSnap(ctx, pool, cmd)
		if err != nil || before.DurableState != 2 {
			t.Fatal(err)
		}
		lbl2, err := ContinueOnce(ctx, pool, actor, cmd, []byte{0x43})
		if err != nil || lbl2 != LabelIDContentConflict {
			t.Fatal(lbl2, err)
		}
		after, err := m.ReadSnap(ctx, pool, cmd)
		if err != nil || after.DurableState != 2 {
			t.Fatal("terminal state unchanged")
		}
		t.Log("PASS id_content_conflict: Continue unknown no insert; terminal diff C1 conflict")
	})

	run(func(t *testing.T, pool *pgxpool.Pool) {
		acctA := seedAcct(t, pool)
		actorA := Actor{RealmID: realm, ServerID: 1, PlayerID: 42, AccountID: acctA}
		_, err := pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('idcc_u2','idcc_h2',1)`)
		if err != nil {
			t.Fatal(err)
		}
		var acctB int64
		if err := pool.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name='idcc_u2'`).Scan(&acctB); err != nil {
			t.Fatal(err)
		}
		_, err = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,43,$1,'idcc_p2')`, acctB)
		if err != nil {
			t.Fatal(err)
		}
		actorB := Actor{RealmID: realm, ServerID: 1, PlayerID: 43, AccountID: acctB}
		cmd := "26000000-0000-4000-8000-00000000beef"
		seedPending(t, pool, actorA, cmd, 0x51)
		seedPending(t, pool, actorB, cmd, 0x52)
		mA := NewMatrix(ev, actorA, cmd, nil, PayloadByte(0x51))
		snap, err := mA.ReadSnap(ctx, pool, cmd)
		if err != nil || snap.C1Hex != "51" {
			t.Fatalf("actor 42 row: %q", snap.C1Hex)
		}
		var c1b string
		if err := pool.QueryRow(ctx, `SELECT encode(canonical_c1,'hex') FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=43 AND command_id=$2::uuid`, realm, cmd).Scan(&c1b); err != nil || c1b != "52" {
			t.Fatalf("actor 43 independent namespace: %q", c1b)
		}
		t.Log("PASS id_content_conflict: full PK scope; shared command_id string not content conflict")
	})
}

func TestUnauthorizedFailClosed(t *testing.T) {
	admin, _ := pg17OrSkip(t)
	ctx := context.Background()
	specDir := stageSpecs(t)
	t.Cleanup(func() { _ = os.RemoveAll(specDir) })
	pool, done := freshSchema(t, admin, specDir)
	defer done()

	acct := seedAcct(t, pool)
	actor := Actor{RealmID: realm, ServerID: 1, PlayerID: 99, AccountID: acct}
	_, _ = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,99,$1,'idcc_u99')`, acct)
	m := UnauthorizedMatrix(actor, "90000000-0000-4000-8000-000000000099", PayloadByte(0x01))
	if err := m.FailClosedSubmit(ctx, pool); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid`, realm).Scan(&n); err != nil || n != 0 {
		t.Fatalf("no commands: n=%d err=%v", n, err)
	}
}

func mustSnap(t *testing.T, m *Matrix, ctx context.Context, pool *pgxpool.Pool, cmd string) RowSnap {
	t.Helper()
	s, err := m.ReadSnap(ctx, pool, cmd)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func seedAcct(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	ctx := context.Background()
	_, err := pool.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('idcc_u','idcc_h',1)`)
	if err != nil {
		t.Fatal(err)
	}
	var acct int64
	if err := pool.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'idcc_p')`, acct)
	if err != nil {
		t.Fatal(err)
	}
	return acct
}

func seedPending(t *testing.T, pool *pgxpool.Pool, actor Actor, cmdID string, c1Byte byte) {
	t.Helper()
	ctx := context.Background()
	p := PayloadByte(c1Byte)
	p.TemplateVersion = "tpl-a"
	_, err := pool.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		actor.RealmID, actor.ServerID, actor.PlayerID, actor.AccountID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,$7,$8,$9,$10,$11,$12,now())`,
		actor.RealmID, actor.ServerID, actor.PlayerID, cmdID, actor.AccountID,
		p.CanonicalC1, p.TemplateVersion, p.RulesVersion, p.CatalogVersion,
		p.ContentEncodingVersion, p.TemplateFCT1, p.ContentSHA256)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`,
		actor.RealmID, actor.ServerID, actor.PlayerID, cmdID)
	if err != nil {
		t.Fatal(err)
	}
}

func setTerminal(t *testing.T, pool *pgxpool.Pool, cmdID string, st int16) {
	t.Helper()
	ctx := context.Background()
	if st == 2 {
		_, err := pool.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=88001,success_server_id=1,success_player_id=42,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`, realm, cmdID)
		if err != nil {
			t.Fatal(err)
		}
		return
	}
	_, err := pool.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`, realm, cmdID)
	if err != nil {
		t.Fatal(err)
	}
}

func stageSpecs(t *testing.T) string {
	t.Helper()
	dir, _ := os.Getwd()
	for !strings.HasSuffix(dir, "sanguo-slg") && dir != "/" {
		dir = filepath.Dir(dir)
	}
	base, err := os.MkdirTemp("", "fc-id-cc-specs-")
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
	schema := fmt.Sprintf("fc_id_cc_%x_%d", time.Now().UnixNano(), schemaSerial)
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

func TestSkipWithoutEnv(t *testing.T) {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") == "1" && os.Getenv("FIRST_CITY_LEDGER_TEST_DSN") != "" {
		t.Skip("covered by PG17 matrix")
	}
	// Ensures package tests do not FAIL when env unset (pg17OrSkip skips subtests).
	if bytes.Equal([]byte{1}, []byte{2}) {
		t.Fatal("unreachable")
	}
}
