package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	osexec "os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	realm     = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e66"
	workerPkg = "./spec/db/tests/first_city_ledger_new_intake_authorization/new_ledger_route_worker"
)

var ctx = context.Background()
var baseDir, dsn, harnessSchema, repoRoot, workerBin string
var admin *pgxpool.Pool

func must(err error)           { if err != nil { panic(err) } }
func assert(ok bool, m string) { if !ok { panic(m) } }
func sql(p *pgxpool.Pool, q string, a ...any) { _, e := p.Exec(ctx, q, a...); must(e) }

func c1(name string, x, y int) (string, string, string) {
	b := append([]byte{0x01}, []byte(name)...)
	b = append(b, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(b)
	return `\x` + hex.EncodeToString(b), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

func logProductionInventory() {
	fmt.Println("new_ledger_route_entry:", filepath.Join(repoRoot, "spec/db/tests/first_city_ledger_new_intake_authorization/new_ledger_route_worker"))
	fmt.Println("PRODUCTION_NEW_LEDGER_NEGATIVE: cmd/ internal/ tools/ lack OID §6.12 production intake/effect/finalizer writer or enable switch")
	fmt.Println("HARNESS_ONLY_WRITERS: spec/db/tests/first_city_ledger_{race,effect_path,slot_cas,...} are disposable contract proofs only")
}

func stageSpecs() {
	baseDir, _ = os.MkdirTemp("", "fc-nia-specs-")
	var paths []string
	for _, pat := range []string{"00*.sql", "m3_*.sql", "m4_*.sql"} {
		m, _ := filepath.Glob(filepath.Join(repoRoot, "spec/db", pat))
		paths = append(paths, m...)
	}
	sort.Strings(paths)
	for _, path := range paths {
		data, _ := os.ReadFile(path)
		must(os.WriteFile(filepath.Join(baseDir, filepath.Base(path)), data, 0o600))
	}
}

func fresh() (*pgxpool.Pool, func()) {
	schema := fmt.Sprintf("fc_nia_%d", time.Now().UnixNano())
	sql(admin, "CREATE SCHEMA "+schema)
	harnessSchema = schema
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "90s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); sql(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func installFixture(p *pgxpool.Pool) {
	sql(p, `CREATE TABLE harness_nia_profile (realm_id uuid PRIMARY KEY,cluster_id text,database_name text,schema_name text,shard_actor_domain text,city_queue_allocator text,account_binding_authority text,writer_authority text,profile_complete bool NOT NULL DEFAULT false)`)
	sql(p, `CREATE TABLE harness_nia_inventory (path_row int PRIMARY KEY CHECK (path_row BETWEEN 1 AND 11),drain_evidence_ok bool NOT NULL DEFAULT false)`)
	for i := 1; i <= 11; i++ {
		sql(p, `INSERT INTO harness_nia_inventory VALUES ($1,false)`, i)
	}
	sql(p, `CREATE TABLE harness_nia_obligations (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),through_commit_drain_ok bool NOT NULL DEFAULT false,local_drain_counter int NOT NULL DEFAULT 0); INSERT INTO harness_nia_obligations DEFAULT VALUES`)
	sql(p, `CREATE TABLE harness_nia_allocator_highwater (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),highwater bigint NOT NULL DEFAULT 88150); INSERT INTO harness_nia_allocator_highwater DEFAULT VALUES`)
	sql(p, `CREATE TABLE harness_nia_hold (slot int PRIMARY KEY CHECK (slot=1)); INSERT INTO harness_nia_hold VALUES (1)`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_nia_route_authorized() RETURNS bool LANGUAGE plpgsql AS $$
DECLARE rid uuid := '`+realm+`'::uuid;
BEGIN
 IF NOT coalesce((SELECT profile_complete FROM harness_nia_profile WHERE realm_id=rid), false) THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM harness_nia_inventory WHERE NOT drain_evidence_ok) THEN RETURN false; END IF;
 IF NOT (SELECT through_commit_drain_ok FROM harness_nia_obligations) THEN RETURN false; END IF;
 RETURN true;
END$$`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_nia_apply_live() RETURNS bool LANGUAGE plpgsql AS $$ BEGIN RETURN coalesce(current_setting('harness.new_ledger_route', true), '') = '1'; END$$`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_block_nia_capital() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF harness_nia_apply_live() AND NEW.is_capital THEN
  IF NOT harness_nia_route_authorized() THEN RAISE EXCEPTION 'new ledger route unauthorized for capital'; END IF;
 END IF; RETURN NEW; END$$`)
	sql(p, `CREATE TRIGGER trg_nia_cap BEFORE INSERT ON player_city FOR EACH ROW EXECUTE FUNCTION harness_block_nia_capital()`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_prevent_empty_reopen() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.head_command_id IS NOT NULL AND NEW.head_command_id IS NULL AND EXISTS (SELECT 1 FROM world_first_city_command WHERE command_id=OLD.head_command_id AND durable_state IN (2,3)) THEN
  RAISE EXCEPTION 'cannot reopen EMPTY with retained lineage'; END IF; RETURN NEW; END$$`)
	sql(p, `CREATE TRIGGER trg_nia_no_empty BEFORE UPDATE ON world_first_city_actor_slot FOR EACH ROW EXECUTE FUNCTION harness_prevent_empty_reopen()`)
	for _, xy := range [][2]int{{5, 6}, {11, 12}, {30, 31}} {
		sql(p, `INSERT INTO map_cell (server_id,x,y,terrain,resource_type) VALUES (1,$1,$2,0,0)`, xy[0], xy[1])
	}
}

func seed(p *pgxpool.Pool) int64 {
	sql(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('nia_u','nia_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	sql(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'nia_p')`, acct)
	return acct
}

func bindAuthority(acct int64) string { return fmt.Sprintf("server:1:player:42:account:%d", acct) }

func writeProfile(p *pgxpool.Pool, acct int64, complete bool) {
	var dbName string
	must(p.QueryRow(ctx, `SELECT current_database()`).Scan(&dbName))
	sql(p, `INSERT INTO harness_nia_profile VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (realm_id) DO UPDATE SET profile_complete=EXCLUDED.profile_complete`,
		realm, "h-cluster", dbName, harnessSchema, "shard:1:42", "harness-alloc", bindAuthority(acct), "harness-writer-v1", complete)
}

func drainAll(p *pgxpool.Pool) {
	sql(p, `UPDATE harness_nia_inventory SET drain_evidence_ok=true`)
	sql(p, `UPDATE harness_nia_obligations SET through_commit_drain_ok=true`)
}

func seedRetention(p *pgxpool.Pool, acct int64) string {
	cmd := "d2222222-2222-4222-8222-222222222222"
	c1b, fct1, sha := c1("保留城", 5, 6)
	sql(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,2,'t','r','c',1,$5,$6,now(),now(),88101,1,42,true,1,100)`, realm, cmd, acct, c1b, fct1, sha)
	sql(p, `INSERT INTO world_first_city_actor_slot VALUES ($1::uuid,1,42,$3,$2::uuid)`, realm, cmd, acct)
	sql(p, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88101,42,'保留城',5,6,true)`)
	sql(p, `UPDATE harness_nia_allocator_highwater SET highwater=88101`)
	return cmd
}

func workerEnv(mode, name, cmdID string, x, y int, capital bool, cityID int64, hold string) []string {
	cap := "0"
	if capital { cap = "1" }
	e := append(os.Environ(), "GOTOOLCHAIN=local", "HARNESS_DSN="+dsn, "HARNESS_SCHEMA="+harnessSchema,
		"HARNESS_MODE="+mode, "HARNESS_NAME="+name, "HARNESS_IS_CAPITAL="+cap, "HARNESS_CMD_ID="+cmdID,
		fmt.Sprintf("HARNESS_X=%d", x), fmt.Sprintf("HARNESS_Y=%d", y), fmt.Sprintf("HARNESS_CITY_ID=%d", cityID))
	if hold != "" { e = append(e, "HARNESS_HOLD_SEC="+hold) }
	return e
}

func runWorker(mode, name, cmdID string, x, y int, capital bool, cityID int64) string {
	cmd := osexec.Command(workerBin)
	cmd.Dir, cmd.Env = repoRoot, workerEnv(mode, name, cmdID, x, y, capital, cityID, "")
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	_ = cmd.Run()
	return out.String()
}

func sIncomplete(p *pgxpool.Pool, acct int64) {
	writeProfile(p, acct, false)
	out := runWorker("commit", "未授权首城", "a1111111-1111-4111-8111-111111111111", 11, 12, true, 88211)
	var pcN int
	must(p.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&pcN))
	assert(pcN == 0 && strings.Contains(out, "NIA_ERR"), "incomplete profile closed: "+out)
	fmt.Println("PASS new_intake_authorization: incomplete_profile_or_inventory_keeps_closed")
}

func sSubstitute(p *pgxpool.Pool, acct int64) {
	writeProfile(p, acct, true)
	sql(p, `UPDATE harness_nia_obligations SET local_drain_counter=99`)
	obs, err := pgx.Connect(ctx, dsn); must(err)
	defer func() { must(obs.Close(ctx)) }()
	_, _ = obs.Exec(ctx, "SET search_path TO "+harnessSchema)
	var slot int
	must(obs.QueryRow(ctx, `SELECT slot FROM harness_nia_hold WHERE slot=1 FOR UPDATE`).Scan(&slot))
	out := runWorker("commit", "替代围栏", "a2222222-2222-4222-8222-222222222222", 11, 12, true, 88212)
	_, _ = obs.Exec(ctx, `ROLLBACK`)
	assert(strings.Contains(out, "NIA_ERR"), "substitute fence not authorization: "+out)
	fmt.Println("PASS new_intake_authorization: substitute_fence_not_authorization")
}

func sPartialDrain(p *pgxpool.Pool, acct int64) {
	writeProfile(p, acct, true)
	sql(p, `UPDATE harness_nia_inventory SET drain_evidence_ok=true WHERE path_row<=10`)
	out := runWorker("commit", "部分排空", "a3333333-3333-4333-8333-333333333333", 11, 12, true, 88213)
	assert(strings.Contains(out, "NIA_ERR"), "partial drain: "+out)
	fmt.Println("PASS new_intake_authorization: partial_drain_not_partial_enablement")
}

func sNoReuse(p *pgxpool.Pool, acct int64) {
	writeProfile(p, acct, true)
	retained := seedRetention(p, acct)
	_, err := p.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=NULL WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
	assert(err != nil, "cannot reopen EMPTY")
	var head string
	must(p.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head))
	assert(head == retained, "head retained")
	var hw int64
	must(p.QueryRow(ctx, `SELECT highwater FROM harness_nia_allocator_highwater`).Scan(&hw))
	out := runWorker("commit", "未授权", "a4444444-4444-4444-8444-444444444444", 11, 12, true, 88214)
	assert(strings.Contains(out, "NIA_ERR") && hw == 88101, "unauthorized blocked")
	fmt.Println("PASS new_intake_authorization: unauthorized_intake_no_empty_reopen_or_id_reuse")
}

func sLawfulMulti(p *pgxpool.Pool, acct int64) {
	writeProfile(p, acct, true)
	drainAll(p)
	seedRetention(p, acct)
	out := runWorker("commit", "分城", "a5555555-5555-4555-8555-555555555555", 30, 31, false, 88301)
	var n int
	must(p.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&n))
	assert(strings.Contains(out, "NIA_COMMITTED") && n == 2, "lawful multi-city: "+out)
	fmt.Println("PASS new_intake_authorization: lawful_multi_city_not_blocked")
}

func main() {
	assert(os.Getenv("ALLOW_OWNED_PG17_TEST") == "1", "ALLOW_OWNED_PG17_TEST=1 required")
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	assert(dsn != "", "FIRST_CITY_LEDGER_TEST_DSN required")
	repoRoot, _ = os.Getwd()
	for repoRoot != "/" {
		if _, err := os.Stat(filepath.Join(repoRoot, "go.mod")); err == nil { break }
		repoRoot = filepath.Dir(repoRoot)
	}
	stageSpecs()
	defer func() { _ = os.RemoveAll(baseDir) }()
	var err error
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	var ver, major string
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	must(admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	logProductionInventory()
	fmt.Println("PostgreSQL", ver)
	workerBin = filepath.Join(os.TempDir(), "fc_new_ledger_route_worker_bin")
	bld := osexec.Command("go", "build", "-o", workerBin, workerPkg)
	bld.Dir, bld.Env = repoRoot, append(os.Environ(), "GOTOOLCHAIN=local")
	must(bld.Run())
	for _, fn := range []func(*pgxpool.Pool, int64){sIncomplete, sSubstitute, sPartialDrain, sNoReuse, sLawfulMulti} {
		pool, done := fresh()
		must(db.ApplySpecs(ctx, pool, baseDir))
		installFixture(pool)
		fn(pool, seed(pool))
		done()
	}
}
