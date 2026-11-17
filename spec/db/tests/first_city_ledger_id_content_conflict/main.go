// SPEC-FIRST-CITY-LEDGER-ID-CONTENT-CONFLICT-001: ID_CONTENT_CONFLICT / same-C1 COMMAND on disposable PG17.
package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

var (
	ctx     = context.Background()
	baseDir string
	dsn     string
	admin   *pgxpool.Pool
	serial  int
)

type snap struct {
	c1, fct1, tpl, rcv, head string
	state                    int16
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
func assert(ok bool, msg string) {
	if !ok {
		panic(msg)
	}
}
func exec(p *pgxpool.Pool, sql string, args ...any) { _, err := p.Exec(ctx, sql, args...); must(err) }
func apply(p *pgxpool.Pool)                          { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_id_cc_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-id-cc-specs-")
	must(err)
	var paths []string
	for _, pat := range []string{"00*.sql", "m3_*.sql", "m4_*.sql"} {
		m, err := filepath.Glob("spec/db/" + pat)
		must(err)
		paths = append(paths, m...)
	}
	sort.Strings(paths)
	for _, path := range paths {
		data, err := os.ReadFile(path)
		must(err)
		must(os.WriteFile(filepath.Join(baseDir, filepath.Base(path)), data, 0o600))
	}
}

func payload(c1Byte byte) (c1, fct1, sha string) {
	return fmt.Sprintf(`\x%02x`, c1Byte), `\x` + strings.Repeat("00", 52), `\x` + strings.Repeat("ab", 32)
}

func seedAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('idcc_u','idcc_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'idcc_p')`, acct)
	return acct
}

func insertPending(p *pgxpool.Pool, acct int64, cmdID string, c1Byte byte) {
	c1, fct1, sha := payload(c1Byte)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`, realm, acct)
	exec(p, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'tpl-a','r','c',1,$5,$6,now())`,
		realm, cmdID, acct, c1, fct1, sha)
	exec(p, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm, cmdID)
}

func setTerminal(p *pgxpool.Pool, cmdID string, st int16) {
	if st == 2 {
		exec(p, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=88001,success_server_id=1,success_player_id=42,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`, realm, cmdID)
		return
	}
	exec(p, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid AND durable_state=1`, realm, cmdID)
}

func readSnap(p *pgxpool.Pool, cmdID string) snap {
	var s snap
	must(p.QueryRow(ctx, `SELECT encode(canonical_c1,'hex'),encode(template_fct1,'hex'),
 template_version,received_at::text,durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`,
		realm, cmdID).Scan(&s.c1, &s.fct1, &s.tpl, &s.rcv, &s.state))
	must(p.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&s.head))
	return s
}
func same(a, b snap) bool { return a == b }

func submit(tx pgx.Tx, acct int64, cmdID string, c1Byte byte, pred *string) (label string, committed bool, err error) {
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return "", false, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`, realm, acct)
	if err != nil {
		return "", false, err
	}
	c1, fct1, sha := payload(c1Byte)
	var existing []byte
	err = tx.QueryRow(ctx, `SELECT canonical_c1 FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid FOR SHARE`,
		realm, cmdID).Scan(&existing)
	if err == nil {
		want := []byte{c1Byte}
		if bytes.Equal(existing, want) {
			return "COMMAND", false, tx.Rollback(ctx)
		}
		return "ID_CONTENT_CONFLICT", false, tx.Rollback(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", false, err
	}
	var head *string
	err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head)
	if err != nil {
		return "", false, err
	}
	if pred == nil {
		if head != nil {
			return "HEAD_CONFLICT", false, tx.Rollback(ctx)
		}
	} else if head == nil || *head != *pred {
		return "HEAD_CONFLICT", false, tx.Rollback(ctx)
	}
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'tpl-b','r','c',1,$5,$6,now())`,
		realm, cmdID, acct, c1, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return "", false, tx.Rollback(ctx)
	}
	var upd pgconn.CommandTag
	if pred == nil {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmdID)
	} else {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42
 AND (head_command_id IS NULL OR head_command_id=$3::uuid)`, realm, cmdID, *pred)
	}
	if err != nil || upd.RowsAffected() != 1 {
		return "", false, tx.Rollback(ctx)
	}
	return "COMMITTED", true, tx.Commit(ctx)
}

func continueLedger(tx pgx.Tx, cmdID string, c1Byte byte) (string, error) {
	var existing []byte
	err := tx.QueryRow(ctx, `SELECT canonical_c1 FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid FOR SHARE`,
		realm, cmdID).Scan(&existing)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "NOT_OBSERVED", tx.Rollback(ctx)
		}
		return "", err
	}
	if bytes.Equal(existing, []byte{c1Byte}) {
		return "COMMAND", tx.Rollback(ctx)
	}
	return "ID_CONTENT_CONFLICT", tx.Rollback(ctx)
}

func conn(pool *pgxpool.Pool) *pgxpool.Conn {
	c, err := pool.Acquire(ctx)
	must(err)
	return c
}

func txSubmit(pool *pgxpool.Pool, acct int64, cmdID string, c1 byte, pred *string) string {
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	label, _, err := submit(tx, acct, cmdID, c1, pred)
	must(err)
	return label
}

func scenarioDiffC1States(pool *pgxpool.Pool, acct int64) {
	type caseT struct {
		name string
		cmd  string
		st   int16
	}
	for _, c := range []caseT{
		{"PENDING", "21000000-0000-4000-8000-000000000101", 1},
		{"SUCCEEDED", "21100000-0000-4000-8000-000000000102", 2},
		{"REJECTED_NO_EFFECT", "21200000-0000-4000-8000-000000000103", 3},
	} {
		insertPending(pool, acct, c.cmd, 0x01)
		if c.st > 1 {
			setTerminal(pool, c.cmd, c.st)
		}
		before := readSnap(pool, c.cmd)
		assert(txSubmit(pool, acct, c.cmd, 0x02, nil) == "ID_CONTENT_CONFLICT", c.name)
		assert(same(before, readSnap(pool, c.cmd)), c.name)
		fmt.Println("PASS id_content_conflict:", c.name, "different C1 no mutation")
	}
}

func scenarioSubmitEdges(pool *pgxpool.Pool, acct int64) {
	cmd := "22000000-0000-4000-8000-000000000201"
	insertPending(pool, acct, cmd, 0x0a)
	before := readSnap(pool, cmd)
	assert(txSubmit(pool, acct, cmd, 0x0a, nil) == "COMMAND", "same C1")
	assert(same(before, readSnap(pool, cmd)), "no template refresh")
	fmt.Println("PASS id_content_conflict: same PK same C1 read-only")

	cmd = "23000000-0000-4000-8000-000000000301"
	insertPending(pool, acct, cmd, 0x11)
	_, err := pool.Exec(ctx, `UPDATE world_first_city_command SET canonical_c1=$3
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`, realm, cmd, `\x22`)
	assert(err != nil && strings.Contains(err.Error(), "immutable intake"), "guard UPDATE")
	before = readSnap(pool, cmd)
	_, err = pool.Exec(ctx, `DELETE FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND command_id=$2::uuid`, realm, cmd)
	assert(err != nil && same(before, readSnap(pool, cmd)), "guard DELETE cmd")
	_, err = pool.Exec(ctx, `DELETE FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
	assert(err != nil, "guard DELETE slot")
	fmt.Println("PASS id_content_conflict: DDL guards intake immutability and no DELETE")

	cmdA, cmdB := "24000000-0000-4000-8000-000000000401", "24000000-0000-4000-8000-000000000402"
	insertPending(pool, acct, cmdA, 0x31)
	before = readSnap(pool, cmdA)
	assert(txSubmit(pool, acct, cmdB, 0x32, nil) == "HEAD_CONFLICT", "HEAD not ID_CONTENT")
	assert(same(before, readSnap(pool, cmdA)), "HEAD_CONFLICT no mutation")
	fmt.Println("PASS id_content_conflict: HEAD_CONFLICT distinct from ID_CONTENT_CONFLICT")
}

func scenarioContinuePaths(pool *pgxpool.Pool, acct int64) {
	unknown := "25000000-0000-4000-8000-000000000501"
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	lbl, err := continueLedger(tx, unknown, 0x41)
	must(err)
	assert(lbl == "NOT_OBSERVED", "unknown ID not created")
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&n))
	assert(n == 0, "no row after unknown continue")

	cmd := "25000000-0000-4000-8000-000000000502"
	insertPending(pool, acct, cmd, 0x42)
	setTerminal(pool, cmd, 2)
	before := readSnap(pool, cmd)
	c2 := conn(pool)
	defer c2.Release()
	tx2, err := c2.Begin(ctx)
	must(err)
	lbl2, err := continueLedger(tx2, cmd, 0x43)
	must(err)
	assert(lbl2 == "ID_CONTENT_CONFLICT", "terminal different C1 conflicts")
	assert(before.state == 2 && readSnap(pool, cmd).state == 2, "terminal state unchanged")
	fmt.Println("PASS id_content_conflict: Continue unknown no insert; terminal diff C1 conflict")
}

func scenarioPKScope(pool *pgxpool.Pool, acctA int64) {
	exec(pool, `INSERT INTO account (login_name,password_hash,status) VALUES ('idcc_u2','idcc_h2',1)`)
	var acctB int64
	must(pool.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name='idcc_u2'`).Scan(&acctB))
	exec(pool, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,43,$1,'idcc_p2')`, acctB)
	cmd := "26000000-0000-4000-8000-00000000beef"
	insertPending(pool, acctA, cmd, 0x51)
	c1, fct1, sha := payload(0x52)
	exec(pool, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,43,$2,NULL) ON CONFLICT DO NOTHING`, realm, acctB)
	exec(pool, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,43,$2::uuid,$3,$4,1,'tpl-x','r','c',1,$5,$6,now())`,
		realm, cmd, acctB, c1, fct1, sha)
	exec(pool, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=43`, realm, cmd)
	assert(readSnap(pool, cmd).c1 == "51", "actor 42 row")
	var c1b string
	must(pool.QueryRow(ctx, `SELECT encode(canonical_c1,'hex') FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=43 AND command_id=$2::uuid`, realm, cmd).Scan(&c1b))
	assert(c1b == "52", "actor 43 independent namespace")
	fmt.Println("PASS id_content_conflict: full PK scope; shared command_id string not content conflict")
}

func main() {
	assert(os.Getenv("ALLOW_OWNED_PG17_TEST") == "1", "ALLOW_OWNED_PG17_TEST=1 required")
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	assert(dsn != "", "FIRST_CITY_LEDGER_TEST_DSN must name a disposable database")
	stageSpecDir()
	defer func() { _ = os.RemoveAll(baseDir) }()
	var err error
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	ver := ""
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	major := ""
	must(admin.QueryRow(ctx, "SELECT (current_setting('server_version_num')::integer/10000)::text").Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)

	run := func(fn func(*pgxpool.Pool, int64)) {
		pool, done := fresh()
		defer done()
		apply(pool)
		fn(pool, seedAcct(pool))
	}
	run(scenarioDiffC1States)
	run(scenarioSubmitEdges)
	run(scenarioContinuePaths)
	run(scenarioPKScope)

	fmt.Println("MODE: isolated PG17 ID_CONTENT_CONFLICT; player_city_id_seq not activated")
}
