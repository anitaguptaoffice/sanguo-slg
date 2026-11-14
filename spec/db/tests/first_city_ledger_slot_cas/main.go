// SPEC-FIRST-CITY-LEDGER-SLOT-CAS-001: isolated PG17 intake slot/head CAS; intake only.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
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

func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_slot_cas_%x_%d", time.Now().UnixNano(), serial)
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
	baseDir, err = os.MkdirTemp("", "fc-slot-cas-specs-")
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

func seedActor(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('cas_u','cas_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42, $1, 'cas_p')`, acct)
	return acct
}

func c1Payload() (c1, fct1, sha string) {
	return `\x01`, `\x` + strings.Repeat("00", 52), `\x` + strings.Repeat("ab", 32)
}

func intakeInitial(tx pgx.Tx, acct int64, cmdID string, pred *string) (committed bool, err error) {
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`, realm, acct)
	if err != nil {
		return false, err
	}
	var head *string
	err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head)
	if err != nil {
		return false, err
	}
	if pred == nil {
		if head != nil {
			return false, tx.Rollback(ctx)
		}
	} else if head == nil || *head != *pred {
		return false, tx.Rollback(ctx)
	}
	c1, fct1, sha := c1Payload()
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`,
		realm, cmdID, acct, c1, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	var upd pgconn.CommandTag
	if pred == nil {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmdID)
	} else {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42
 AND (head_command_id IS NULL OR head_command_id = $3::uuid)`, realm, cmdID, *pred)
	}
	if err != nil || upd.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func conn(pool *pgxpool.Pool) *pgxpool.Conn {
	c, err := pool.Acquire(ctx)
	must(err)
	return c
}

func observerOK(p *pgxpool.Pool) {
	var orphan, dangling int
	must(p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_actor_slot s
 WHERE s.realm_id=$1::uuid AND s.server_id=1 AND s.player_id=42 AND s.head_command_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM world_first_city_command c
  WHERE c.realm_id=s.realm_id AND c.server_id=s.server_id AND c.player_id=s.player_id
  AND c.command_id=s.head_command_id)`, realm).Scan(&orphan))
	assert(orphan == 0, "head must reference command row")
	must(p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command c
 WHERE c.realm_id=$1::uuid AND c.server_id=1 AND c.player_id=42 AND c.durable_state=1
 AND NOT EXISTS (SELECT 1 FROM world_first_city_actor_slot s
  WHERE s.realm_id=c.realm_id AND s.server_id=c.server_id AND s.player_id=c.player_id
  AND s.head_command_id=c.command_id)`, realm).Scan(&dangling))
	assert(dangling == 0, "no isolated PENDING without head")
}

func dualIntakeRace(pool *pgxpool.Pool, acct int64, cmdA, cmdB string) (bool, bool) {
	begin := make(chan struct{})
	var done sync.WaitGroup
	done.Add(2)
	var okA, okB bool
	run := func(cmd string, dst *bool) {
		defer done.Done()
		<-begin
		c := conn(pool)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		*dst, err = intakeInitial(tx, acct, cmd, nil)
		must(err)
	}
	go run(cmdA, &okA)
	go run(cmdB, &okB)
	close(begin)
	done.Wait()
	return okA, okB
}

func scenarioCompetingInitial(pool *pgxpool.Pool, acct int64) {
	okA, okB := dualIntakeRace(pool, acct,
		"c1000000-0000-4000-8000-000000000001", "c2000000-0000-4000-8000-000000000002")
	wins := 0
	if okA {
		wins++
	}
	if okB {
		wins++
	}
	assert(wins == 1, "competing INITIAL: exactly one commit")
	observerOK(pool)
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND durable_state=1`, realm).Scan(&n))
	assert(n == 1, "single PENDING command remains")
	fmt.Println("PASS slot_cas: competing INITIAL on empty slot")
}

func scenarioSamePredecessor(pool *pgxpool.Pool, acct int64) {
	okA, okB := dualIntakeRace(pool, acct,
		"d1000000-0000-4000-8000-000000000001", "d2000000-0000-4000-8000-000000000002")
	assert((okA && !okB) || (!okA && okB), "two IDs same NULL predecessor: one HEAD_CONFLICT loser")
	observerOK(pool)
	fmt.Println("PASS slot_cas: two command_id same predecessor (EMPTY)")
}

func scenarioStalePredecessor(pool *pgxpool.Pool, acct int64) {
	cmdA := "e1000000-0000-4000-8000-000000000001"
	cmdB := "e2000000-0000-4000-8000-000000000002"
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	ok, err := intakeInitial(tx, acct, cmdA, nil)
	must(err)
	assert(ok, "seed head A")
	c2 := conn(pool)
	defer c2.Release()
	tx2, err := c2.Begin(ctx)
	must(err)
	ok2, err := intakeInitial(tx2, acct, cmdB, nil)
	must(err)
	assert(!ok2, "NULL predecessor must fail when head=A")
	var n int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&n))
	assert(n == 1, "command A unchanged")
	var head string
	must(pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head))
	assert(head == cmdA, "head still A")
	observerOK(pool)
	fmt.Println("PASS slot_cas: stale predecessor rejected")
}

func scenarioNoTransientEmpty(pool *pgxpool.Pool, acct int64) {
	cmdA := "f1000000-0000-4000-8000-000000000001"
	cmdB := "f2000000-0000-4000-8000-000000000002"
	hold := make(chan struct{})
	go func() {
		c := conn(pool)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
		must(err)
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`, realm, acct)
		must(err)
		var head *string
		must(tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head))
		assert(head == nil, "mid-intake NULL head under slot FOR UPDATE")
		c1, fct1, sha := c1Payload()
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdA, acct, c1, fct1, sha)
		must(err)
		close(hold)
		time.Sleep(120 * time.Millisecond)
		_, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmdA)
		must(err)
		must(tx.Commit(ctx))
	}()
	<-hold
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	ok, err := intakeInitial(tx, acct, cmdB, nil)
	must(err)
	assert(!ok, "must not commit second EMPTY while peer holds FOR UPDATE")
	observerOK(pool)
	var head string
	must(pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head))
	assert(head == cmdA, "winner remains cmdA")
	fmt.Println("PASS slot_cas: no transient EMPTY second INITIAL")
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
		fn(pool, seedActor(pool))
	}
	run(scenarioCompetingInitial)
	run(scenarioSamePredecessor)
	run(scenarioStalePredecessor)
	run(scenarioNoTransientEmpty)

	fmt.Println("MODE: isolated PG17 slot/head intake CAS (no wallet/CITY/MIL/DOM; player_city_id_seq not activated)")
}
