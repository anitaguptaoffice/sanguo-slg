// SPEC-HERO-METADATA: explicit disposable PostgreSQL only; no role/ACL changes.
package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

const migration = "m4_007_hero_metadata.sql"

var ctx = context.Background()
var body, baseDir, dsn string
var tables = []string{"player_hero_coming", "player_hero_captive", "player_hero_lionize"}
var legacy []string
var admin *pgxpool.Pool
var serial int

func must(err error) {
	if err != nil {
		panic(err)
	}
}
func assert(ok bool, message string) {
	if !ok {
		panic(message)
	}
}
func exec(p *pgxpool.Pool, sql string) { _, err := p.Exec(ctx, sql); must(err) }
func value(p *pgxpool.Pool, sql string) string {
	var result string
	must(p.QueryRow(ctx, sql).Scan(&result))
	return result
}
func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, "spec/db")) }
func failApply(p *pgxpool.Pool, fragment string) {
	err := db.ApplySpecs(ctx, p, "spec/db")
	assert(err != nil && strings.Contains(err.Error(), fragment), fmt.Sprintf("wanted %q; got %v", fragment, err))
	assert(value(p, "SELECT count(*)::text FROM schema_migrations WHERE name='"+migration+"'") == "0", "failure recorded success")
}
func fresh() (*pgxpool.Pool, string, func()) {
	serial++
	schema := fmt.Sprintf("hero_meta_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 1
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "2s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "20s"
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return p, schema, func() { p.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}
func baseline(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }
func seq(p *pgxpool.Pool) string {
	return value(p, "SELECT last_value::text||':'||is_called FROM player_hero_id_seq") + "/" +
		value(p, "SELECT last_value::text||':'||is_called FROM city_hotel_candidate_id_seq")
}
func snapshot(p *pgxpool.Pool, names []string) string {
	result := ""
	for _, name := range names {
		result += value(p, "SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]') FROM "+name+" t")
		result += value(p, `SELECT jsonb_build_object('oid', c.oid, 'owner', c.relowner,
   'acl', c.relacl, 'comment', obj_description(c.oid), 'columns',
   (SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.attnotnull,
    pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d
    ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
   'keys', (SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE k.conrelid=c.oid),
   'indexes', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.indexrelid) FROM pg_index x WHERE x.indrelid=c.oid))::text
   FROM pg_class c WHERE c.oid='`+name+`'::regclass`)
	}
	return result
}
func ignoreRollbackError(rollback func(context.Context) error, rollbackCtx context.Context) {
	_ = rollback(rollbackCtx)
}

func ready(p *pgxpool.Pool, wantError string) {
	tx, err := p.Begin(ctx)
	must(err)
	defer ignoreRollbackError(tx.Rollback, ctx)
	_, err = tx.Exec(ctx, "SET TRANSACTION READ ONLY; SET LOCAL sanguo.hero_metadata_validate_only='true'")
	must(err)
	_, err = tx.Exec(ctx, body)
	if wantError == "" {
		must(err)
	} else {
		assert(err != nil && strings.Contains(err.Error(), wantError), fmt.Sprint(err))
	}
	must(tx.Rollback(ctx))
}
func seed(p *pgxpool.Pool, i int) {
	exec(p, legacy[i])
	rows := []string{
		"(1,9000001,0),(2,9000001,-10)",
		"(1,9000002,0,2050,3),(2,9000002,-10,0,5),(1,9000003,5,2050,0),(1,9000004,1,0,0)",
		"(1,9,1001,30,2,NULL),(2,9,1001,-7,99,'2020-01-01 01:02:03.123456+08'),(1,9,9999,999,-3,NULL)",
	}
	exec(p, "INSERT INTO "+tables[i]+" VALUES "+rows[i])
}
func inputs() {
	data, err := os.ReadFile("spec/db/" + migration)
	must(err)
	body = string(data)
	paths := []string{"coming_store.go", "captive_store.go", "persuade_store.go"}
	hashes := []string{"72926ae9f8263097f0e7355d327edb26daa49c52745d9a88bee78dfbd1b56c54", "76f5afc98acd008f4f4dff39a0357cb4a99020adc9e0fa25bdfd3d634c867a0d", "a522350154450f0a54c3bc3ee45dc945ca4ce631ee51c9e746e919bfa8df2742"}
	re := regexp.MustCompile("(?s)const playerHero(?:Coming|Captive|Lionize)DDL = `([^`]+)`")
	for i, path := range paths {
		source, err := os.ReadFile("internal/hero/" + path)
		must(err)
		match := re.FindSubmatch(source)
		assert(len(match) == 2, "missing legacy DDL")
		assert(fmt.Sprintf("%x", sha256.Sum256(match[1])) == hashes[i], "audited DDL changed")
		legacy = append(legacy, string(match[1]))
	}
	baseDir, err = os.MkdirTemp("", "hero-metadata-specs-")
	must(err)
	entries, err := filepath.Glob("spec/db/*.sql")
	must(err)
	var globs []string
	for _, pattern := range []string{"00*.sql", "m3_*.sql", "m4_*.sql"} {
		matches, err := filepath.Glob("spec/db/" + pattern)
		must(err)
		globs = append(globs, matches...)
	}
	sort.Strings(entries)
	assert(reflect.DeepEqual(entries, globs), "validate.sh discovery/order differs from actual loader")
	for _, path := range entries {
		if filepath.Base(path) == migration {
			continue
		}
		data, err := os.ReadFile(path)
		must(err)
		must(os.WriteFile(filepath.Join(baseDir, filepath.Base(path)), data, 0600))
	}
	fmt.Printf("PASS pinned legacy DDL; %d top-level SQL files match validator order\n", len(entries))
}
func main() {
	dsn = os.Getenv("HERO_METADATA_TEST_DSN")
	assert(dsn != "", "HERO_METADATA_TEST_DSN must name an explicitly disposable DB")
	inputs()
	defer func(path string) { _ = os.RemoveAll(path) }(baseDir)
	var err error
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	fmt.Println("PostgreSQL " + value(admin, "SHOW server_version"))
	positive()
	negative()
	extra()
	shadow()
	fmt.Println("PASS actual ApplySpecs metadata contract; restricted/mixed-owner roles not exercised")
}
