// SPEC-FIRST-CITY-LEDGER-PENDING-UNIQUE-INDEX-001: partial unique index on disposable PG17.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

const indexName = "idx_world_first_city_command_one_pending_per_slot"

var (
	ctx     = context.Background()
	baseDir string
	dsn     string
	admin   *pgxpool.Pool
	serial  int
)

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
	schema := fmt.Sprintf("fc_pend_uniq_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-pend-uniq-specs-")
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

func seedAcct(p *pgxpool.Pool, playerID int64, login string) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ($1,$2,1)`, login, login+"_h")
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name=$1`, login).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,$1,$2,$3)`, playerID, acct, login+"_p")
	return acct
}

func insertCommand(p *pgxpool.Pool, playerID, acct int64, cmdID string, state int16, c1Byte byte) error {
	c1, fct1, sha := payload(c1Byte)
	_, err := p.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,$2,$3::uuid,$4,$5,$6,'t','r','c',1,$7,$8,now())`,
		realm, playerID, cmdID, acct, c1, state, fct1, sha)
	return err
}

func isUniqueViolation(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}

func assertIndexPresent(p *pgxpool.Pool) {
	var def string
	must(p.QueryRow(ctx, `SELECT indexdef FROM pg_indexes
 WHERE schemaname = current_schema() AND indexname = $1`, indexName).Scan(&def))
	assert(strings.Contains(def, "WHERE (durable_state = 1)"), "partial predicate durable_state=1")
	assert(strings.Contains(def, "UNIQUE"), "must be unique index")
}

func scenarioSecondPendingRejected(pool *pgxpool.Pool, acct int64) {
	cmdA := "31000000-0000-4000-8000-000000000001"
	cmdB := "31000000-0000-4000-8000-000000000002"
	must(insertCommand(pool, 42, acct, cmdA, 1, 0x01))
	err := insertCommand(pool, 42, acct, cmdB, 1, 0x02)
	assert(err != nil && isUniqueViolation(err), "second PENDING same slot must unique-violate")
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND durable_state=1`, realm).Scan(&n))
	assert(n == 1, "exactly one PENDING row remains")
	fmt.Println("PASS pending_unique: sequential second PENDING rejected (23505)")
}

func scenarioConcurrentPending(pool *pgxpool.Pool, acct int64) {
	begin := make(chan struct{})
	var wg sync.WaitGroup
	cmdA := "32000000-0000-4000-8000-000000000001"
	cmdB := "32000000-0000-4000-8000-000000000002"
	var errA, errB error
	wg.Add(2)
	run := func(cmd string, dst *error) {
		defer wg.Done()
		<-begin
		*dst = insertCommand(pool, 42, acct, cmd, 1, 0x11)
	}
	go run(cmdA, &errA)
	go run(cmdB, &errB)
	close(begin)
	wg.Wait()
	ok := 0
	if errA == nil {
		ok++
	}
	if errB == nil {
		ok++
	}
	assert(ok == 1, "concurrent INSERT: exactly one PENDING commit")
	assert((errA != nil && isUniqueViolation(errA)) || (errB != nil && isUniqueViolation(errB)), "loser is 23505")
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND durable_state=1`, realm).Scan(&n))
	assert(n == 1, "one PENDING after race")
	fmt.Println("PASS pending_unique: concurrent duplicate PENDING race")
}

func scenarioDistinctSlots(pool *pgxpool.Pool, acct42 int64) {
	acct43 := seedAcct(pool, 43, "puniq_u43")
	must(insertCommand(pool, 42, acct42, "33000000-0000-4000-8000-000000000001", 1, 0x21))
	must(insertCommand(pool, 43, acct43, "33000000-0000-4000-8000-000000000002", 1, 0x22))
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE durable_state=1`).Scan(&n))
	assert(n == 2, "two slots may each hold PENDING")
	fmt.Println("PASS pending_unique: distinct actor slots independent")
}

func scenarioTerminalDoesNotOccupy(pool *pgxpool.Pool, acct int64) {
	old := "34000000-0000-4000-8000-000000000001"
	newP := "34000000-0000-4000-8000-000000000002"
	must(insertCommand(pool, 42, acct, old, 1, 0x31))
	exec(pool, `UPDATE world_first_city_command SET durable_state=2, terminal_at=now(),
 success_city_id=88001,success_server_id=1,success_player_id=42,success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE command_id=$1::uuid AND durable_state=1`, old)
	must(insertCommand(pool, 42, acct, newP, 1, 0x32))
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND durable_state=1`, realm).Scan(&n))
	assert(n == 1, "new PENDING allowed after SUCCEEDED")

	exec(pool, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE command_id=$1::uuid AND durable_state=1`, newP)
	next := "34000000-0000-4000-8000-000000000004"
	must(insertCommand(pool, 42, acct, next, 1, 0x34))
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND durable_state=1`, realm).Scan(&n))
	assert(n == 1, "single open PENDING after terminal transitions")
	fmt.Println("PASS pending_unique: SUCCEEDED/REJECTED rows outside partial key")
}

func scenarioCrossActorSameCommandID(pool *pgxpool.Pool, acct42 int64) {
	acct43 := seedAcct(pool, 43, "puniq_xact")
	cmd := "35000000-0000-4000-8000-00000000beef"
	must(insertCommand(pool, 42, acct42, cmd, 1, 0x41))
	must(insertCommand(pool, 43, acct43, cmd, 1, 0x42))
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE command_id=$1::uuid AND durable_state=1`, cmd).Scan(&n))
	assert(n == 2, "shared command_id string across actors")
	fmt.Println("PASS pending_unique: cross-actor same command_id unaffected")
}

func main() {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" {
		fmt.Println("SKIP: ALLOW_OWNED_PG17_TEST=1 not set")
		return
	}
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	if dsn == "" {
		fmt.Println("SKIP: FIRST_CITY_LEDGER_TEST_DSN not set")
		return
	}
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
		assertIndexPresent(pool)
		fn(pool, seedAcct(pool, 42, "puniq_u42"))
	}
	run(scenarioSecondPendingRejected)
	run(scenarioConcurrentPending)
	run(scenarioDistinctSlots)
	run(scenarioTerminalDoesNotOccupy)
	run(scenarioCrossActorSameCommandID)

	fmt.Println("MODE: isolated PG17 pending partial unique index; player_city_id_seq not activated")
}
