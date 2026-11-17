// SPEC-FIRST-CITY-LEDGER-LOADER-001: disposable PG17 ApplySpecs replay; no production DSN.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	migrationDDL        = "m4_010_first_city_ledger.sql"
	migrationCompanion  = "m4_011_first_city_ledger_companion.sql"
)

var (
	ctx      = context.Background()
	baseDir  string
	dsn      string
	admin    *pgxpool.Pool
	serial   int
	ledgerRels = []string{
		"world_first_city_command",
		"world_first_city_actor_slot",
	}
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
func exec(p *pgxpool.Pool, sql string) { _, err := p.Exec(ctx, sql); must(err) }
func value(p *pgxpool.Pool, sql string) string {
	var s string
	must(p.QueryRow(ctx, sql).Scan(&s))
	return s
}
func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }

func fresh() (*pgxpool.Pool, string, func()) {
	serial++
	schema := fmt.Sprintf("fc_ledger_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 4
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "2s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "30s"
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return p, schema, func() { p.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func relFingerprint(p *pgxpool.Pool) string {
	var b strings.Builder
	for _, name := range ledgerRels {
		b.WriteString(value(p, fmt.Sprintf(`SELECT jsonb_build_object(
  'cols',(SELECT count(*) FROM pg_attribute WHERE attrelid='%s'::regclass AND attnum>0 AND NOT attisdropped),
  'triggers',(SELECT count(*) FROM pg_trigger WHERE tgrelid='%s'::regclass AND NOT tgisinternal)
)::text`, name, name)))
	}
	b.WriteString(value(p, "SELECT count(*)::text FROM schema_migrations WHERE name IN ('"+
		migrationDDL+"','"+migrationCompanion+"')"))
	b.WriteString(value(p, `SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname=current_schema() AND p.proname IN ('world_first_city_slot_key_text','world_first_city_slot_advisory_lock')`))
	return b.String()
}

func seedTerminal(p *pgxpool.Pool) {
	realm := "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	cmd := "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
	c1 := "\\x01"
	fct1 := "\\x" + strings.Repeat("00", 52)
	sha := "\\x" + strings.Repeat("ab", 32)
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at,
 terminal_at,success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale)
 VALUES ('%s'::uuid,1,42,'%s'::uuid,7,'%s',2,'t','r','c',1,'%s','%s',now(),
 now(),9001,1,42,true,1,100)`, realm, cmd, c1, fct1, sha))
	exec(p, fmt.Sprintf(`INSERT INTO world_first_city_actor_slot
 (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ('%s'::uuid,1,42,7,'%s'::uuid)`, realm, cmd))
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "first-city-ledger-specs-")
	must(err)
	var patterns = []string{"00*.sql", "m3_*.sql", "m4_*.sql"}
	var paths []string
	for _, pat := range patterns {
		matches, err := filepath.Glob("spec/db/" + pat)
		must(err)
		paths = append(paths, matches...)
	}
	sort.Strings(paths)
	all, err := filepath.Glob("spec/db/*.sql")
	must(err)
	sort.Strings(all)
	assert(reflect.DeepEqual(all, paths), "validate.sh glob order differs from loader staging")
	for _, path := range paths {
		data, err := os.ReadFile(path)
		must(err)
		must(os.WriteFile(filepath.Join(baseDir, filepath.Base(path)), data, 0o600))
	}
	fmt.Printf("PASS staged %d SQL files for ApplySpecs\n", len(paths))
}

func missingLedgerReplay(p *pgxpool.Pool, name string) {
	before := relFingerprint(p)
	exec(p, "DELETE FROM schema_migrations WHERE name='"+name+"'")
	apply(p)
	assert(before == relFingerprint(p), "missing-ledger replay of "+name+" changed catalog fingerprint")
	assert(value(p, "SELECT count(*)::text FROM schema_migrations WHERE name='"+name+"'") == "1",
		"ledger row not restored for "+name)
}

func terminalGuards(p *pgxpool.Pool) {
	_, err := p.Exec(ctx, `UPDATE world_first_city_command SET durable_state=1
 WHERE durable_state=2 AND server_id=1 AND player_id=42`)
	assert(err != nil && strings.Contains(err.Error(), "terminal durable_state is immutable"),
		"terminal receipt was reversible")
	_, err = p.Exec(ctx, `UPDATE world_first_city_command SET canonical_c1='\x02'
 WHERE server_id=1 AND player_id=42`)
	assert(err != nil && strings.Contains(err.Error(), "immutable intake"),
		"canonical_c1 was mutable on terminal row")
}

func main() {
	assert(os.Getenv("ALLOW_OWNED_PG17_TEST") == "1", "ALLOW_OWNED_PG17_TEST=1 required for disposable PG17 acceptance")
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	assert(dsn != "", "FIRST_CITY_LEDGER_TEST_DSN must name a disposable database")
	stageSpecDir()
	defer func() { _ = os.RemoveAll(baseDir) }()

	var err error
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()

	ver := value(admin, "SHOW server_version")
	major := value(admin, "SELECT (current_setting('server_version_num')::integer / 10000)::text")
	assert(major == "17", "PG17 required for this acceptance; got "+ver)
	fmt.Println("PostgreSQL " + ver)

	p, _, done := fresh()
	defer done()

	apply(p)
	fp1 := relFingerprint(p)
	assert(value(p, "SELECT count(*)::text FROM schema_migrations WHERE name='"+migrationDDL+"'") == "1", "m4_010 ledger missing")
	assert(value(p, "SELECT count(*)::text FROM schema_migrations WHERE name='"+migrationCompanion+"'") == "1", "m4_011 ledger missing")

	apply(p)
	assert(fp1 == relFingerprint(p), "second ApplySpecs changed catalog")

	missingLedgerReplay(p, migrationDDL)
	missingLedgerReplay(p, migrationCompanion)

	seedTerminal(p)
	terminalGuards(p)

	apply(p)
	assert(fp1 == relFingerprint(p), "ApplySpecs after terminal rows changed catalog")

	fmt.Println("PASS first-city ledger ApplySpecs replay, missing-ledger idempotency, terminal receipt guards")
	fmt.Println("MODE: ordinary disposable schema (concurrent effect/finalizer race matrix not exercised here)")
}
