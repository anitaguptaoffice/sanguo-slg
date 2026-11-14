// SPEC-FIRST-CITY-LEDGER-FINALIZER-EFFECT-UNCERTAIN-NO-PROOF-001: §7.1 effect uncertain cannot prove rollback; disposable PG17.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	realm      = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	cmdHead    = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"
	mapX, mapY = 10, 20
)

var ctx = context.Background()
var baseDir, dsn string
var admin *pgxpool.Pool
var serial int

type snap struct {
	state    int16
	terminal bool
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
func apply(p *pgxpool.Pool)                         { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_feunp_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 6
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-feunp-specs-")
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

func installFixture(p *pgxpool.Pool) {
	exec(p, `CREATE TABLE harness_source_gate (realm_id uuid PRIMARY KEY, generation bigint NOT NULL DEFAULT 1,
 admission text NOT NULL DEFAULT 'open' CHECK (admission IN ('open','closed','poisoned')),
 drain text NOT NULL DEFAULT 'unresolved' CHECK (drain IN ('pending','unresolved','drained')))`)
	exec(p, `CREATE TABLE harness_effect_ending (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL,
 effect_ending text NOT NULL DEFAULT 'pending' CHECK (effect_ending IN ('pending','unknown','known_rollback')),
 intake_ending text NOT NULL DEFAULT 'known_committed' CHECK (intake_ending IN ('known_committed','unknown')))`)
	exec(p, `CREATE TABLE harness_rollback_evidence (command_id uuid PRIMARY KEY, realm_id uuid NOT NULL,
 bound_generation bigint NOT NULL, whitelist_reason int NOT NULL DEFAULT 1)`)
	exec(p, `INSERT INTO harness_source_gate (realm_id,admission) VALUES ($1::uuid,'open')`, realm)
}

func readSnap(p *pgxpool.Pool) snap {
	var s snap
	var term *time.Time
	must(p.QueryRow(ctx, `SELECT durable_state,terminal_at FROM world_first_city_command WHERE command_id=$1::uuid`, cmdHead).
		Scan(&s.state, &term))
	s.terminal = term != nil
	return s
}

func bizRows(p *pgxpool.Pool) int {
	var n int
	must(p.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+
 (SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42)`).Scan(&n))
	return n
}

func withTx(p *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) bool {
	c, err := p.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	ok, err := fn(tx)
	must(err)
	return ok
}

func seedAcct(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('feu_u','feu_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'feu_p')`, acct)
	return acct
}

func seedPending(p *pgxpool.Pool, acct int64) {
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,1)`, mapX, mapY)
	c1, fct1, sha := "\\x01", "\\x"+strings.Repeat("00", 52), "\\x"+strings.Repeat("ab", 32)
	exec(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdHead, acct, c1, fct1, sha)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmdHead)
	exec(p, `INSERT INTO harness_effect_ending (command_id,realm_id) VALUES ($1::uuid,$2::uuid)`, cmdHead, realm)
}

func insertEvidence(p *pgxpool.Pool, gen int64) {
	exec(p, `INSERT INTO harness_rollback_evidence (command_id,realm_id,bound_generation,whitelist_reason)
 VALUES ($1::uuid,$2::uuid,$3,1) ON CONFLICT (command_id) DO UPDATE SET bound_generation=EXCLUDED.bound_generation`, cmdHead, realm, gen)
}

func markKnownRollback(p *pgxpool.Pool) {
	exec(p, `UPDATE harness_effect_ending SET effect_ending='known_rollback' WHERE command_id=$1::uuid`, cmdHead)
}

func markIntakeUncertain(p *pgxpool.Pool) {
	ok := withTx(p, func(tx pgx.Tx) (bool, error) {
		_, err := tx.Exec(ctx, `UPDATE harness_effect_ending SET intake_ending='unknown' WHERE command_id=$1::uuid`, cmdHead)
		if err != nil {
			return false, err
		}
		_, err = tx.Exec(ctx, `UPDATE harness_source_gate SET admission='poisoned',drain='unresolved' WHERE realm_id=$1::uuid`, realm)
		if err != nil {
			return false, err
		}
		return true, tx.Commit(ctx)
	})
	assert(ok, "intake uncertain poisons gate")
}

func simulateEffectUncertainAttempt(p *pgxpool.Pool) {
	ok := withTx(p, func(tx pgx.Tx) (bool, error) {
		var st int16
		if err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`, cmdHead).
			Scan(&st); err != nil || st != 1 {
			return false, tx.Rollback(ctx)
		}
		_, err := tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id) VALUES (1,42) ON CONFLICT DO NOTHING`)
		if err != nil {
			return false, err
		}
		_, err = tx.Exec(ctx, `UPDATE harness_effect_ending SET effect_ending='unknown' WHERE command_id=$1::uuid`, cmdHead)
		if err != nil {
			return false, err
		}
		_, err = tx.Exec(ctx, `UPDATE harness_source_gate SET admission='poisoned',drain='unresolved' WHERE realm_id=$1::uuid`, realm)
		if err != nil {
			return false, err
		}
		return false, tx.Rollback(ctx)
	})
	assert(!ok, "effect txn ends rollback after uncertain")
}

func finalizerWithEvidence(p *pgxpool.Pool) (committed bool) {
	c, err := p.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()
	var adm string
	var gen int64
	if err = tx.QueryRow(ctx, `SELECT admission,generation FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, realm).
		Scan(&adm, &gen); err != nil || adm == "poisoned" {
		return false
	}
	var effEnd, intakeEnd string
	if err = tx.QueryRow(ctx, `SELECT effect_ending,intake_ending FROM harness_effect_ending WHERE command_id=$1::uuid FOR UPDATE`, cmdHead).
		Scan(&effEnd, &intakeEnd); err != nil || effEnd != "known_rollback" || intakeEnd != "known_committed" {
		return false
	}
	var boundGen int64
	var reason int
	if err = tx.QueryRow(ctx, `SELECT bound_generation,whitelist_reason FROM harness_rollback_evidence WHERE command_id=$1::uuid FOR UPDATE`, cmdHead).
		Scan(&boundGen, &reason); err != nil || boundGen != gen {
		return false
	}
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm)
	if err != nil {
		return false
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil || head == nil || *head != cmdHead {
		return false
	}
	var st int16
	if err = tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`, cmdHead).
		Scan(&st); err != nil || st != 1 {
		return false
	}
	var terrain int16
	if err = tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2 FOR SHARE`, mapX, mapY).Scan(&terrain); err != nil {
		return false
	}
	if terrain == 4 || reason != 1 {
		return false
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE command_id=$1::uuid AND durable_state=1`, cmdHead)
	if err != nil || tag.RowsAffected() != 1 {
		return false
	}
	if err = tx.Commit(ctx); err != nil {
		return false
	}
	return true
}

func assertPending(p *pgxpool.Pool) {
	s := readSnap(p)
	assert(s.state == 1 && !s.terminal, "still PENDING")
}

func scenarioEffectUncertainBlocks(p *pgxpool.Pool) {
	seedPending(p, seedAcct(p))
	simulateEffectUncertainAttempt(p)
	insertEvidence(p, 1)
	assert(!finalizerWithEvidence(p), "blocked")
	assertPending(p)
	assert(bizRows(p) == 0, "no committed business")
	fmt.Println("PASS finalizer_effect_uncertain: effect_commit_uncertain_blocks_proof")
}

func scenarioIntakeUncertainBypass(p *pgxpool.Pool) {
	seedPending(p, seedAcct(p))
	markIntakeUncertain(p)
	s := readSnap(p)
	assert(s.state == 1, "PENDING visible")
	insertEvidence(p, 1)
	assert(!finalizerWithEvidence(p), "blocked")
	assertPending(p)
	fmt.Println("PASS finalizer_effect_uncertain: intake_uncertain_pending_read_no_bypass")
}

func scenarioControlKnownRollback(p *pgxpool.Pool) {
	seedPending(p, seedAcct(p))
	markKnownRollback(p)
	insertEvidence(p, 1)
	assert(finalizerWithEvidence(p), "commit reject")
	s := readSnap(p)
	assert(s.state == 3 && s.terminal, "terminal reject")
	assert(bizRows(p) == 0, "no business rows")
	fmt.Println("PASS finalizer_effect_uncertain: known_rollback_control_commits")
}

func main() {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" {
		fmt.Println("SKIP: ALLOW_OWNED_PG17_TEST!=1")
		return
	}
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	if dsn == "" {
		fmt.Println("SKIP: FIRST_CITY_LEDGER_TEST_DSN unset")
		return
	}
	stageSpecDir()
	defer func() { _ = os.RemoveAll(baseDir) }()
	var err error
	admin, err = pgxpool.New(ctx, dsn)
	if err != nil {
		panic(err)
	}
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
		installFixture(pool)
		fn(pool)
	}
	run(scenarioEffectUncertainBlocks)
	run(scenarioIntakeUncertainBypass)
	run(scenarioControlKnownRollback)

	fmt.Println("MODE: isolated PG17 finalizer effect-uncertain no-proof (player_city_id_seq not activated)")
}
