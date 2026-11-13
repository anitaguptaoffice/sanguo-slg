// SPEC-FIRST-CITY-LEDGER-ACL-001: disposable PG17 restricted-role ACL matrix.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const realm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380dcc"

// content_sha256 must be exactly 32 bytes (m4_010 world_first_city_command_sha256_check).
const (
	seedSHA32ACL       = `\xabababababababababababababababababababababababababababababababab`
	seedSHA32DenyDML   = `\xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd`
	seedSHA32Partial   = `\xefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef`
	seedSHA32WorldIns  = `\x1111111111111111111111111111111111111111111111111111111111111111`
)

var (
	ctx     = context.Background()
	baseDir string
	dsn     string
	admin   *pgxpool.Pool
	serial  int
)

type roles struct {
	tag               string
	prov, migr        string
	rtApp, rtWorld    string
	rtAcct, maint     string
	disc              string
	all               []string
}

func must(err error)                           { if err != nil { panic(err) } }
func assert(ok bool, msg string)               { if !ok { panic(msg) } }
func exec(p *pgxpool.Pool, sql string, a ...any) { _, e := p.Exec(ctx, sql, a...); must(e) }
func apply(p *pgxpool.Pool)                    { must(db.ApplySpecs(ctx, p, baseDir)) }

func is42501(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "42501"
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-acl-specs-")
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

func fresh() (string, *pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_acl_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 10
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	done := func() {
		pool.Close()
		exec(admin, "DROP SCHEMA "+schema+" CASCADE")
	}
	return schema, pool, done
}

func freshRoles(n int) roles {
	tag := fmt.Sprintf("%x", time.Now().UnixNano()+int64(n))
	r := roles{
		tag:     tag,
		prov:    "harness_fc_prov_" + tag,
		migr:    "harness_fc_migr_" + tag,
		rtApp:   "harness_fc_rt_app_" + tag,
		rtWorld: "harness_fc_rt_world_" + tag,
		rtAcct:  "harness_fc_rt_acct_" + tag,
		maint:   "harness_fc_maint_" + tag,
		disc:    "harness_fc_disc_" + tag,
	}
	r.all = []string{r.prov, r.migr, r.rtApp, r.rtWorld, r.rtAcct, r.maint, r.disc}
	return r
}

func createRoles(admin *pgxpool.Pool, schema string, r roles) {
	for _, name := range r.all {
		_, err := admin.Exec(ctx, "CREATE ROLE "+name+" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT")
		must(err)
		_, err = admin.Exec(ctx, "GRANT "+name+" TO CURRENT_USER")
		must(err)
	}
	exec(admin, "GRANT USAGE ON SCHEMA "+schema+" TO "+r.migr+", "+r.rtWorld+", "+r.rtApp+", "+r.rtAcct+", "+r.maint+", "+r.disc)
	exec(admin, "GRANT CREATE ON SCHEMA "+schema+" TO "+r.migr)
	exec(admin, `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE `+schema+`.world_first_city_command, `+schema+`.world_first_city_actor_slot TO `+r.rtWorld)
	exec(admin, `GRANT SELECT ON TABLE `+schema+`.world_first_city_command, `+schema+`.world_first_city_actor_slot TO `+r.disc)
}

func rolePool(schema, role string) *pgxpool.Pool {
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 2
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET ROLE "+role)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool
}

func seedRow(p *pgxpool.Pool) (cmd string, acct int64) {
	cmd = "41000000-0000-4000-8000-000000000001"
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('acl_u','acl_h',1)`)
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'acl_p')`, acct)
	exec(p, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,'\x01',1,'t','r','c',1,'\x00',$4,now())`,
		realm, cmd, acct, seedSHA32ACL)
	exec(p, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, realm, acct, cmd)
	return cmd, acct
}

func cmdCount(observer *pgxpool.Pool) int {
	var n int
	must(observer.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid`, realm).Scan(&n))
	return n
}

func slotFingerprint(observer *pgxpool.Pool) string {
	var h string
	must(observer.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, realm).Scan(&h))
	return h
}

func scenarioRoleCategories(r roles) {
	seen := map[string]struct{}{}
	for _, name := range r.all {
		var exists bool
		must(admin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$1)`, name).Scan(&exists))
		assert(exists, "missing role "+name)
		_, dup := seen[name]
		assert(!dup, "duplicate role name")
		seen[name] = struct{}{}
	}
	assert(len(seen) == 7, "expected seven harness role categories")
	fmt.Println("PASS acl: role_categories_distinct (provisioning/migration/runtime×3/maintenance/discovery)")
}

func scenarioRuntimeNotMigration(schema string, r roles) {
	for _, rt := range []string{r.rtApp, r.rtWorld, r.rtAcct} {
		var su bool
		must(admin.QueryRow(ctx, `SELECT rolsuper FROM pg_roles WHERE rolname=$1`, rt).Scan(&su))
		assert(!su, rt+" must not be superuser")
		assert(rt != r.migr, "runtime role must differ from migration owner")
		var member bool
		must(admin.QueryRow(ctx, `SELECT EXISTS (
 SELECT 1 FROM pg_auth_members m JOIN pg_roles rm ON m.roleid=rm.oid JOIN pg_roles mr ON m.member=mr.oid
 WHERE rm.rolname=$1 AND mr.rolname=$2)`, r.migr, rt).Scan(&member))
		assert(!member, rt+" must not be migration-owner member with inherited admin")
	}
	pool := rolePool(schema, r.rtWorld)
	defer pool.Close()
	_, err := pool.Exec(ctx, `CREATE TABLE world_first_city_harness_probe (id int)`)
	assert(err != nil && is42501(err), "runtime must not CREATE world_first_city_* (42501)")
	_, err = pool.Exec(ctx, `DROP TABLE world_first_city_command`)
	assert(err != nil && is42501(err), "runtime must not DROP ledger command table (42501)")
	fmt.Println("PASS acl: runtime_not_superuser_not_migration_owner_no_ddl")
}

func denyDML(pool *pgxpool.Pool, cmd string, acct int64) {
	_, err := pool.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,$2::uuid,$3,'\x02',1,'t','r','c',1,'\x00',$4,now())`,
		realm, "41000000-0000-4000-8000-000000000099", acct, seedSHA32DenyDML)
	assert(err != nil && is42501(err), "INSERT denied: "+err.Error())
	_, err = pool.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2 WHERE command_id=$1::uuid`, cmd)
	assert(err != nil && is42501(err), "UPDATE denied")
	_, err = pool.Exec(ctx, `DELETE FROM world_first_city_command WHERE command_id=$1::uuid`, cmd)
	assert(err != nil && is42501(err), "DELETE denied")
}

func scenarioNoWritePrivilege(schema string, observer *pgxpool.Pool, cmd string, acct int64, r roles) {
	beforeN, beforeH := cmdCount(observer), slotFingerprint(observer)
	pool := rolePool(schema, r.maint)
	defer pool.Close()
	denyDML(pool, cmd, acct)
	assert(cmdCount(observer) == beforeN, "observer: no new command rows after denied DML")
	assert(slotFingerprint(observer) == beforeH, "observer: slot head unchanged")
	fmt.Println("PASS acl: maintenance_no_ledger_write_42501_observer_unchanged")
}

func scenarioDiscoveryReadOnly(schema string, observer *pgxpool.Pool, cmd string, acct int64, r roles) {
	beforeN, beforeH := cmdCount(observer), slotFingerprint(observer)
	pool := rolePool(schema, r.disc)
	defer pool.Close()
	var got string
	must(pool.QueryRow(ctx, `SELECT command_id::text FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&got))
	assert(got == cmd, "discovery SELECT allowed")
	denyDML(pool, cmd, acct)
	assert(cmdCount(observer) == beforeN && slotFingerprint(observer) == beforeH, "discovery write denied; rows stable")
	fmt.Println("PASS acl: discovery_select_only_write_denied_42501")
}

func scenarioPartialGrantNotEnablement(schema string, observer *pgxpool.Pool, r roles) {
	pool := rolePool(schema, r.rtApp)
	defer pool.Close()
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command`).Scan(&n)
	assert(err != nil && is42501(err), "runtime APP without SELECT still closed (42501)")
	before := cmdCount(observer)
	_, err = pool.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,42,'41000000-0000-4000-8000-0000000000aa',1,'\x03',1,'t','r','c',1,'\x00',$2,now())`, realm, seedSHA32Partial)
	assert(err != nil && is42501(err), "partial grant does not enable write")
	assert(cmdCount(observer) == before, "partial grant is not partial enablement")
	fmt.Println("PASS acl: partial_grants_fail_closed_not_partial_enablement")
}

func scenarioRuntimeWorldWriteAllowed(schema string, observer *pgxpool.Pool, acct int64, r roles) {
	before := cmdCount(observer)
	pool := rolePool(schema, r.rtWorld)
	defer pool.Close()
	newCmd := "41000000-0000-4000-8000-000000000002"
	_, err := pool.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,1,43,$2::uuid,$3,'\x04',1,'t','r','c',1,'\x00',$4,now())`,
		realm, newCmd, acct, seedSHA32WorldIns)
	if err == nil {
		assert(cmdCount(observer) == before+1, "narrow WORLD grant allows INSERT in harness only")
		fmt.Println("PASS acl: runtime_world_narrow_grant_insert_in_disposable_harness_only")
		return
	}
	// Second pending may hit partial unique index — still proves role had DML privilege (not 42501).
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		fmt.Println("PASS acl: runtime_world_had_dml_privilege_unique_not_acl")
		return
	}
	panic("unexpected runtime world insert: " + err.Error())
}

func runMatrix() {
	schema, pool, done := fresh()
	defer done()
	apply(pool)
	r := freshRoles(serial)
	defer func() {
		for _, name := range r.all {
			_, _ = admin.Exec(ctx, "DROP ROLE IF EXISTS "+name)
		}
	}()
	createRoles(admin, schema, r)
	cmd, acct := seedRow(pool)
	observer := pool

	scenarioRoleCategories(r)
	scenarioRuntimeNotMigration(schema, r)
	scenarioNoWritePrivilege(schema, observer, cmd, acct, r)
	scenarioDiscoveryReadOnly(schema, observer, cmd, acct, r)
	scenarioPartialGrantNotEnablement(schema, observer, r)
	scenarioRuntimeWorldWriteAllowed(schema, observer, acct, r)

	var provSU bool
	must(admin.QueryRow(ctx, `SELECT rolsuper FROM pg_roles WHERE rolname='postgres'`).Scan(&provSU))
	fmt.Printf("ROLE_EVIDENCE provisioning_admin_superuser=%v migration_owner=%s runtime_world=%s discovery=%s\n",
		provSU, r.migr, r.rtWorld, r.disc)
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

	runMatrix()
	fmt.Println("MODE: isolated PG17 restricted-role ACL; not realm-enrolled; player_city_id_seq not activated")
}
