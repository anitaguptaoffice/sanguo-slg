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
	realm     = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380e44"
	workerPkg = "./spec/db/tests/first_city_ledger_background_writer_exclusion/bg_writer_worker"
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

func stageSpecs() {
	baseDir, _ = os.MkdirTemp("", "fc-bg-specs-")
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
	schema := fmt.Sprintf("fc_bg_%d", time.Now().UnixNano())
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
	sql(p, `CREATE TABLE harness_bg_allocator_highwater (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),highwater bigint NOT NULL DEFAULT 88050); INSERT INTO harness_bg_allocator_highwater DEFAULT VALUES`)
	sql(p, `CREATE TABLE harness_bg_hold (slot int PRIMARY KEY CHECK (slot=1)); INSERT INTO harness_bg_hold VALUES (1)`)
	sql(p, `CREATE TABLE harness_isolated_catalog (entry_id bigserial PRIMARY KEY, note text NOT NULL)`)
	sql(p, `CREATE TABLE harness_bg_state (single_row bool PRIMARY KEY DEFAULT true CHECK (single_row),exclusion_active bool NOT NULL DEFAULT false,profile_generation int NOT NULL DEFAULT 0,local_drain_counter int NOT NULL DEFAULT 0,legacy_writer_stopped bool NOT NULL DEFAULT false,dom_api_stopped bool NOT NULL DEFAULT false,gm_import_stopped bool NOT NULL DEFAULT false,snapshot_flush_stopped bool NOT NULL DEFAULT false,restore_job_stopped bool NOT NULL DEFAULT false,explicit_apply_specs_stopped bool NOT NULL DEFAULT false,manual_migration_stopped bool NOT NULL DEFAULT false,queue_bg_stopped bool NOT NULL DEFAULT false,mail_bg_stopped bool NOT NULL DEFAULT false,rank_bg_stopped bool NOT NULL DEFAULT false,chat_bg_stopped bool NOT NULL DEFAULT false,isolated_bg_stopped bool NOT NULL DEFAULT false); INSERT INTO harness_bg_state DEFAULT VALUES`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_bg_role_live() RETURNS bool LANGUAGE plpgsql AS $$ DECLARE r text := coalesce(current_setting('harness.bg_role', true), ''); s record; BEGIN SELECT * INTO s FROM harness_bg_state LIMIT 1; IF NOT s.exclusion_active OR r = '' THEN RETURN false; END IF; IF r = 'queue' AND s.queue_bg_stopped THEN RETURN false; END IF; IF r = 'mail' AND s.mail_bg_stopped THEN RETURN false; END IF; IF r = 'rank' AND s.rank_bg_stopped THEN RETURN false; END IF; IF r = 'chat' AND s.chat_bg_stopped THEN RETURN false; END IF; IF r = 'isolated' AND s.isolated_bg_stopped THEN RETURN false; END IF; RETURN true; END$$`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_block_bg_lower_allocator() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF harness_bg_role_live() AND NEW.highwater < OLD.highwater THEN RAISE EXCEPTION 'bg exclusion blocks allocator rollback'; END IF; RETURN NEW; END$$; CREATE TRIGGER trg_harness_bg_hw BEFORE UPDATE ON harness_bg_allocator_highwater FOR EACH ROW EXECUTE FUNCTION harness_block_bg_lower_allocator()`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_block_bg_ledger_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF harness_bg_role_live() THEN RAISE EXCEPTION 'bg exclusion blocks ledger delete'; END IF; RETURN OLD; END$$; CREATE TRIGGER trg_harness_bg_del BEFORE DELETE ON world_first_city_command FOR EACH ROW EXECUTE FUNCTION harness_block_bg_ledger_delete()`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_block_bg_pc() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF harness_bg_role_live() THEN IF NOT EXISTS (SELECT 1 FROM world_first_city_command WHERE realm_id='`+realm+`'::uuid AND server_id=1 AND player_id=42 AND durable_state=2) THEN RAISE EXCEPTION 'bg exclusion blocks first-city bundle insert'; END IF; IF NEW.is_capital THEN RAISE EXCEPTION 'bg exclusion blocks capital bundle insert'; END IF; END IF; RETURN NEW; END$$; CREATE TRIGGER trg_harness_bg_pc BEFORE INSERT ON player_city FOR EACH ROW EXECUTE FUNCTION harness_block_bg_pc()`)
	sql(p, `CREATE OR REPLACE FUNCTION harness_prevent_empty_reopen() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.head_command_id IS NOT NULL AND NEW.head_command_id IS NULL AND EXISTS (SELECT 1 FROM world_first_city_command WHERE command_id=OLD.head_command_id AND durable_state IN (2,3)) THEN RAISE EXCEPTION 'cannot reopen EMPTY with retained lineage'; END IF; RETURN NEW; END$$; CREATE TRIGGER trg_harness_no_empty BEFORE UPDATE ON world_first_city_actor_slot FOR EACH ROW EXECUTE FUNCTION harness_prevent_empty_reopen()`)
	sql(p, `INSERT INTO chat_channel (server_id,channel_id,channel_type,ref_id) VALUES (1,1,1,0)`)
	for _, xy := range [][2]int{{7, 8}, {9, 10}, {41, 42}, {60, 61}} {
		sql(p, `INSERT INTO map_cell (server_id,x,y,terrain,resource_type) VALUES (1,$1,$2,0,0)`, xy[0], xy[1])
	}
}

func seed(p *pgxpool.Pool) int64 {
	sql(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('bg_u','bg_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	sql(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'bg_p')`, acct)
	return acct
}

func seedRetention(p *pgxpool.Pool, acct int64) string {
	cmd := "c1111111-1111-4111-8111-111111111111"
	c1b, fct1, sha := c1("保留城", 5, 6)
	sql(p, `INSERT INTO map_cell (server_id,x,y,terrain,resource_type) VALUES (1,5,6,0,0) ON CONFLICT DO NOTHING`)
	sql(p, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,terminal_at,success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,2,'t','r','c',1,$5,$6,now(),now(),88001,1,42,true,1,100)`, realm, cmd, acct, c1b, fct1, sha)
	sql(p, `INSERT INTO world_first_city_actor_slot VALUES ($1::uuid,1,42,$3,$2::uuid)`, realm, cmd, acct)
	sql(p, `INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital) VALUES (1,88001,42,'保留城',5,6,true)`)
	sql(p, `UPDATE harness_bg_allocator_highwater SET highwater=88001`)
	return cmd
}

func workerEnv(entry, mode, name string, x, y int, capital bool, cityID int64, hold string) []string {
	cap := "0"
	if capital { cap = "1" }
	e := append(os.Environ(), "GOTOOLCHAIN=local", "HARNESS_DSN="+dsn, "HARNESS_SCHEMA="+harnessSchema,
		"HARNESS_ENTRY="+entry, "HARNESS_MODE="+mode, "HARNESS_NAME="+name, "HARNESS_IS_CAPITAL="+cap,
		fmt.Sprintf("HARNESS_X=%d", x), fmt.Sprintf("HARNESS_Y=%d", y), fmt.Sprintf("HARNESS_CITY_ID=%d", cityID))
	if hold != "" { e = append(e, "HARNESS_HOLD_SEC="+hold) }
	return e
}

func runWorker(entry, mode, name string, x, y int, capital bool, cityID int64) string {
	cmd := osexec.Command(workerBin)
	cmd.Dir, cmd.Env = repoRoot, workerEnv(entry, mode, name, x, y, capital, cityID, "")
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	_ = cmd.Run()
	return out.String()
}

func startWorkerHold(entry, name string, x, y int, cityID int64) (*osexec.Cmd, *bytes.Buffer) {
	cmd := osexec.Command(workerBin)
	cmd.Dir, cmd.Env = repoRoot, workerEnv(entry, "hold", name, x, y, true, cityID, "30")
	var buf bytes.Buffer
	cmd.Stdout, cmd.Stderr = &buf, &buf
	must(cmd.Start())
	for dl := time.Now().Add(60 * time.Second); time.Now().Before(dl); time.Sleep(200 * time.Millisecond) {
		if strings.Contains(buf.String(), "WORKER_HOLDING") { return cmd, &buf }
	}
	panic("bg worker hold did not start: " + buf.String())
}

func bgBusy() bool {
	c, err := pgx.Connect(ctx, dsn)
	if err != nil { return false }
	defer func() { must(c.Close(ctx)) }()
	_, _ = c.Exec(ctx, "SET search_path TO "+harnessSchema)
	var slot int
	return c.QueryRow(ctx, `SELECT slot FROM harness_bg_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&slot) != nil
}

func pollBgBusy() bool {
	for range 40 {
		if bgBusy() { return true }
		time.Sleep(50 * time.Millisecond)
	}
	return false
}

func intakeEmpty(tx pgx.Tx, acct int64, cmdID, name string, x, y int) (bool, error) {
	var active bool
	_ = tx.QueryRow(ctx, `SELECT exclusion_active FROM harness_bg_state`).Scan(&active)
	if active {
		var held int
		if err := tx.QueryRow(ctx, `SELECT slot FROM harness_bg_hold WHERE slot=1 FOR UPDATE NOWAIT`).Scan(&held); err != nil {
			return false, tx.Rollback(ctx)
		}
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('harness.ledger_intake','1',true)`); err != nil { return false, err }
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`, realm); err != nil { return false, err }
	if _, err := tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT DO NOTHING`, realm, acct); err != nil { return false, err }
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`, realm).Scan(&head); err != nil || head != nil {
		return false, tx.Rollback(ctx)
	}
	c1b, fct1, sha := c1(name, x, y)
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`, realm, cmdID, acct, c1b, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 { return false, tx.Rollback(ctx) }
	ut, err := tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`, realm, cmdID)
	if err != nil || ut.RowsAffected() != 1 { return false, tx.Rollback(ctx) }
	return true, tx.Commit(ctx)
}

func withTx(p *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) bool {
	c, err := p.Acquire(ctx); must(err)
	defer c.Release()
	tx, err := c.Begin(ctx); must(err)
	ok, err := fn(tx); must(err)
	return ok
}

func killWorker(cmd *osexec.Cmd) { _ = cmd.Process.Kill(); _, _ = cmd.Process.Wait(); time.Sleep(300 * time.Millisecond) }

func sNoVisibleFirstCity(pool *pgxpool.Pool, acct int64) {
	seedRetention(pool, acct); sql(pool, `UPDATE harness_bg_state SET exclusion_active=true`)
	out := runWorker("queue", "commit", "队列首城", 41, 42, true, 88002)
	var cmdN, pcN int
	var hw int64
	must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&cmdN))
	must(pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&pcN))
	must(pool.QueryRow(ctx, `SELECT highwater FROM harness_bg_allocator_highwater`).Scan(&hw))
	assert(cmdN == 1 && pcN == 1 && hw == 88001, "retention preserved")
	assert(strings.Contains(out, "BG_ERR"), "queue bundle blocked: "+out)
	fmt.Println("PASS bg_exclusion: bg_writer_no_visible_first_city")
}

func sNoEmptyReuse(pool *pgxpool.Pool, acct int64) {
	retained := seedRetention(pool, acct)
	_, err := pool.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=NULL WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm)
	assert(err != nil, "cannot reopen EMPTY")
	var head string
	must(pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&head))
	assert(head == retained, "head still bound")
	_, err = pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) SELECT realm_id,server_id,player_id,$2::uuid,account_id,canonical_c1,1,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,now() FROM world_first_city_command WHERE command_id=$1::uuid`, retained, retained)
	assert(err != nil, "cannot reuse command_id")
	fmt.Println("PASS bg_exclusion: no_empty_reopen_or_command_id_reuse")
}

func sLockAloneNotStopped(pool *pgxpool.Pool, acct int64) {
	seedRetention(pool, acct)
	sql(pool, `UPDATE harness_bg_state SET exclusion_active=true,legacy_writer_stopped=true,dom_api_stopped=true,gm_import_stopped=true,snapshot_flush_stopped=true,restore_job_stopped=true,explicit_apply_specs_stopped=true,manual_migration_stopped=true,mail_bg_stopped=true`)
	obs, err := pgx.Connect(ctx, dsn); must(err)
	defer func() { must(obs.Close(ctx)) }()
	_, _ = obs.Exec(ctx, "SET search_path TO "+harnessSchema)
	var rowLock string
	assert(obs.QueryRow(ctx, `SELECT command_id::text FROM world_first_city_command WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE NOWAIT`, realm).Scan(&rowLock) == nil, "ledger row lock ok")
	cmd, buf := startWorkerHold("queue", "queue活", 9, 10, 88009)
	defer killWorker(cmd)
	assert(pollBgBusy() && strings.Contains(buf.String(), "WORKER_HOLDING"), "queue bg live while mail stopped: "+buf.String())
	killWorker(cmd)
	sql(pool, `UPDATE harness_bg_state SET queue_bg_stopped=true`)
	cmd2, buf2 := startWorkerHold("rank", "rank活", 9, 10, 88019)
	defer killWorker(cmd2)
	assert(pollBgBusy() && strings.Contains(buf2.String(), "WORKER_HOLDING"), "rank live while queue+mail stopped: "+buf2.String())
	fmt.Println("PASS bg_exclusion: table_lock_alone_not_bg_writer_entry_stopped")
}

func sNoFalseDrain(pool *pgxpool.Pool, acct int64) {
	sql(pool, `UPDATE harness_bg_state SET exclusion_active=true`)
	cmd, buf := startWorkerHold("chat", "排空城", 7, 8, 88007)
	defer killWorker(cmd)
	sql(pool, `UPDATE harness_bg_state SET profile_generation=profile_generation+1,local_drain_counter=local_drain_counter+1`)
	assert(pollBgBusy() && strings.Contains(buf.String(), "WORKER_HOLDING"), "chat bg live: "+buf.String())
	assert(!withTx(pool, func(tx pgx.Tx) (bool, error) { return intakeEmpty(tx, acct, "f5555555-5555-4555-8555-555555555555", "假排空", 7, 8) }), "no false drain while bg live")
	killWorker(cmd)
	assert(withTx(pool, func(tx pgx.Tx) (bool, error) { return intakeEmpty(tx, acct, "f6666666-6666-4666-8666-666666666666", "排空后续", 7, 8) }), "lawful after bg worker end")
	fmt.Println("PASS bg_exclusion: bg_writer_no_false_drain")
}

func sLawfulMultiCity(pool *pgxpool.Pool, acct int64) {
	seedRetention(pool, acct); sql(pool, `UPDATE harness_bg_state SET exclusion_active=true`)
	iso := runWorker("isolated", "commit", "审计", 0, 0, false, 1)
	out := runWorker("queue", "commit", "分城", 60, 61, false, 88060)
	var n, isoN int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=42`).Scan(&n))
	must(pool.QueryRow(ctx, `SELECT count(*) FROM harness_isolated_catalog`).Scan(&isoN))
	assert(strings.Contains(iso, "BG_COMMITTED") && isoN == 1, "isolated not harmed")
	assert(strings.Contains(out, "BG_COMMITTED") && n == 2, "lawful multi-city")
	fmt.Println("PASS bg_exclusion: lawful_multi_city_not_blocked")
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
	admin, err = pgxpool.New(ctx, dsn); must(err)
	defer admin.Close()
	var ver, major string
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	must(admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver, "bg_writer_entry:", workerPkg)
	workerBin = filepath.Join(os.TempDir(), "fc_bg_writer_worker_bin")
	bld := osexec.Command("go", "build", "-o", workerBin, workerPkg)
	bld.Dir, bld.Env = repoRoot, append(os.Environ(), "GOTOOLCHAIN=local")
	must(bld.Run())
	for _, fn := range []func(*pgxpool.Pool, int64){sNoVisibleFirstCity, sNoEmptyReuse, sLockAloneNotStopped, sNoFalseDrain, sLawfulMultiCity} {
		pool, done := fresh()
		must(db.ApplySpecs(ctx, pool, baseDir))
		installFixture(pool)
		fn(pool, seed(pool))
		done()
	}
}
