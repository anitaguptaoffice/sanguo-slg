// SPEC-FIRST-CITY-LEDGER-SLOT-ISOLATION-001: cross-actor slot isolation on disposable PG17; intake only.
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

const realmA = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

var (
	ctx     = context.Background()
	baseDir string
	dsn     string
	admin   *pgxpool.Pool
	serial  int
)

type actor struct {
	realm      string
	server     int32
	player     int64
	acct       int64
	cmdInitial string
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

func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_slot_iso_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 12
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-slot-iso-specs-")
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

func c1Payload() (c1, fct1, sha string) {
	return `\x01`, `\x` + strings.Repeat("00", 52), `\x` + strings.Repeat("ab", 32)
}

func seedAcct(pool *pgxpool.Pool, login string) int64 {
	exec(pool, `INSERT INTO account (login_name,password_hash,status) VALUES ($1,'iso_h',1)`, login)
	var acct int64
	must(pool.QueryRow(ctx, `SELECT account_id FROM account WHERE login_name=$1`, login).Scan(&acct))
	return acct
}

func ensurePlayer(pool *pgxpool.Pool, a *actor, login string) {
	if a.acct == 0 {
		a.acct = seedAcct(pool, login)
	}
	exec(pool, `INSERT INTO player (server_id,player_id,account_id,display_name)
 VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, a.server, a.player, a.acct, login)
}

func intakeInitial(tx pgx.Tx, a actor, cmdID string, pred *string) (bool, error) {
	_, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, a.realm, a.server, a.player)
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		a.realm, a.server, a.player, a.acct)
	if err != nil {
		return false, err
	}
	var head *string
	err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		a.realm, a.server, a.player).Scan(&head)
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
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		a.realm, a.server, a.player, cmdID, a.acct, c1, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	var upd pgconn.CommandTag
	if pred == nil {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
			a.realm, a.server, a.player, cmdID)
	} else {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3
 AND (head_command_id IS NULL OR head_command_id = $5::uuid)`,
			a.realm, a.server, a.player, cmdID, *pred)
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

func observerOK(p *pgxpool.Pool, a actor) {
	var orphan, dangling int
	must(p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_actor_slot s
 WHERE s.realm_id=$1::uuid AND s.server_id=$2 AND s.player_id=$3 AND s.head_command_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM world_first_city_command c
  WHERE c.realm_id=s.realm_id AND c.server_id=s.server_id AND c.player_id=s.player_id
  AND c.command_id=s.head_command_id)`, a.realm, a.server, a.player).Scan(&orphan))
	assert(orphan == 0, "head must reference command row")
	must(p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command c
 WHERE c.realm_id=$1::uuid AND c.server_id=$2 AND c.player_id=$3 AND c.durable_state=1
 AND NOT EXISTS (SELECT 1 FROM world_first_city_actor_slot s
  WHERE s.realm_id=c.realm_id AND s.server_id=c.server_id AND s.player_id=c.player_id
  AND s.head_command_id=c.command_id)`, a.realm, a.server, a.player).Scan(&dangling))
	assert(dangling == 0, "no isolated PENDING without head")
}

func headIs(p *pgxpool.Pool, a actor, want string) {
	var head string
	must(p.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, a.realm, a.server, a.player).Scan(&head))
	assert(head == want, "unexpected head")
}

func cmdCount(p *pgxpool.Pool, a actor) int {
	var n int
	must(p.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, a.realm, a.server, a.player).Scan(&n))
	return n
}

func dualInitial(pool *pgxpool.Pool, a, b actor) (bool, bool) {
	begin := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	var okA, okB bool
	run := func(act actor, dst *bool) {
		defer wg.Done()
		<-begin
		c := conn(pool)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		*dst, err = intakeInitial(tx, act, act.cmdInitial, nil)
		must(err)
	}
	go run(a, &okA)
	go run(b, &okB)
	close(begin)
	wg.Wait()
	return okA, okB
}

func scenarioDistinctPlayers(pool *pgxpool.Pool) {
	a := actor{realm: realmA, server: 1, player: 42, cmdInitial: "11000000-0000-4000-8000-000000000001"}
	b := actor{realm: realmA, server: 1, player: 43, cmdInitial: "11000000-0000-4000-8000-000000000002"}
	ensurePlayer(pool, &a, "iso_p42")
	ensurePlayer(pool, &b, "iso_p43")
	okA, okB := dualInitial(pool, a, b)
	assert(okA && okB, "both actors commit INITIAL on same realm+server")
	headIs(pool, a, a.cmdInitial)
	headIs(pool, b, b.cmdInitial)
	assert(cmdCount(pool, a) == 1 && cmdCount(pool, b) == 1, "one command row per actor")
	observerOK(pool, a)
	observerOK(pool, b)
	fmt.Println("PASS slot_isolation: distinct player_id concurrent INITIAL")
}

func scenarioDistinctKeys(pool *pgxpool.Pool) {
	realmB := "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22"
	a := actor{realm: realmA, server: 1, player: 42, cmdInitial: "12000000-0000-4000-8000-000000000001"}
	b := actor{realm: realmB, server: 2, player: 42, cmdInitial: "12000000-0000-4000-8000-000000000002"}
	ensurePlayer(pool, &a, "iso_k42s1")
	ensurePlayer(pool, &b, "iso_k42s2")
	okA, okB := dualInitial(pool, a, b)
	assert(okA && okB, "same player_id different realm+server both commit")
	observerOK(pool, a)
	observerOK(pool, b)
	fmt.Println("PASS slot_isolation: isolation key is full (realm_id, server_id, player_id)")
}

func scenarioMidIntakePeer(pool *pgxpool.Pool) {
	a := actor{realm: realmA, server: 1, player: 44, cmdInitial: "13000000-0000-4000-8000-000000000001"}
	b := actor{realm: realmA, server: 1, player: 45, cmdInitial: "13000000-0000-4000-8000-000000000002"}
	ensurePlayer(pool, &a, "iso_m44")
	ensurePlayer(pool, &b, "iso_m45")
	hold := make(chan struct{})
	doneA := make(chan struct{})
	go func() {
		defer close(doneA)
		c := conn(pool)
		defer c.Release()
		tx, err := c.Begin(ctx)
		must(err)
		_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, a.realm, a.server, a.player)
		must(err)
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,$2,$3,$4,NULL)
 ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`, a.realm, a.server, a.player, a.acct)
		must(err)
		var head *string
		must(tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
			a.realm, a.server, a.player).Scan(&head))
		assert(head == nil, "A mid-intake NULL head")
		c1, fct1, sha := c1Payload()
		_, err = tx.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
			a.realm, a.server, a.player, a.cmdInitial, a.acct, c1, fct1, sha)
		must(err)
		close(hold)
		time.Sleep(150 * time.Millisecond)
		_, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
			a.realm, a.server, a.player, a.cmdInitial)
		must(err)
		must(tx.Commit(ctx))
	}()
	<-hold
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	okB, err := intakeInitial(tx, b, b.cmdInitial, nil)
	must(err)
	assert(okB, "peer B must commit while A mid-intake")
	<-doneA
	headIs(pool, b, b.cmdInitial)
	observerOK(pool, b)
	headIs(pool, a, a.cmdInitial)
	observerOK(pool, a)
	fmt.Println("PASS slot_isolation: mid-intake holder does not block peer INITIAL")
}

func scenarioSharedCmdIDHeadConflict(pool *pgxpool.Pool) {
	shared := "14000000-0000-4000-8000-00000000beef"
	failCmd := "14000000-0000-4000-8000-00000000c0de"
	a := actor{realm: realmA, server: 1, player: 46, cmdInitial: shared}
	b := actor{realm: realmA, server: 1, player: 47, cmdInitial: shared}
	ensurePlayer(pool, &a, "iso_s46")
	ensurePlayer(pool, &b, "iso_s47")
	okA, okB := dualInitial(pool, a, b)
	assert(okA && okB, "same command_id string in two namespaces both commit")
	snap := func(act actor) (head string, n int) {
		must(pool.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, act.realm, act.server, act.player).Scan(&head))
		n = cmdCount(pool, act)
		return head, n
	}
	hA, nA := snap(a)
	hB, nB := snap(b)
	c := conn(pool)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	ok, err := intakeInitial(tx, b, failCmd, nil)
	must(err)
	assert(!ok, "B stale EMPTY predecessor must HEAD_CONFLICT roll back")
	hA2, nA2 := snap(a)
	hB2, nB2 := snap(b)
	assert(hA == hA2 && nA == nA2, "A rows unchanged after B failure")
	assert(hB == hB2 && nB == nB2, "B committed rows unchanged after failed intake")
	observerOK(pool, a)
	observerOK(pool, b)
	fmt.Println("PASS slot_isolation: HEAD_CONFLICT on one actor does not touch peer rows")
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

	run := func(fn func(*pgxpool.Pool)) {
		pool, done := fresh()
		defer done()
		apply(pool)
		fn(pool)
	}
	run(scenarioDistinctPlayers)
	run(scenarioDistinctKeys)
	run(scenarioMidIntakePeer)
	run(scenarioSharedCmdIDHeadConflict)

	fmt.Println("MODE: isolated PG17 cross-actor slot isolation; player_city_id_seq not activated")
}
