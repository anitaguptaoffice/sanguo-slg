// Package firstcityledgerpgacl reproves SPEC-FIRST-CITY-LEDGER-ACL-001 on disposable PG17 (not production).
package firstcityledgerpgacl

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const aclRealm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380dcc"

const (
	seedFCT1Min52      = `\x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`
	seedSHA32ACL       = `\xabababababababababababababababababababababababababababababababab`
	seedSHA32DenyDML   = `\xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd`
	seedSHA32Partial   = `\xefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef`
	seedSHA32WorldIns  = `\x1111111111111111111111111111111111111111111111111111111111111111`
	insLedger        = `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) VALUES ($1::uuid,1,$2,$3::uuid,$4,$5,1,'t','r','c',1,$7,$6,now())`
)

type roles struct {
	tag, prov, migr, rtApp, rtWorld, rtAcct, maint, disc string
	all                                                 []string
}

type Pass func(line string)

func ledgerIns(ctx context.Context, p *pgxpool.Pool, pid int, cmdID string, acct int64, c1, sha, fct1 string) error {
	_, err := p.Exec(ctx, insLedger, aclRealm, pid, cmdID, acct, c1, sha, fct1)
	return err
}

func is42501(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "42501"
}

// RunMatrix stages specs from specDir, runs all six frozen ACL scenarios, emits ROLE_EVIDENCE.
func RunMatrix(ctx context.Context, admin *pgxpool.Pool, dsn, specDir string, pass Pass) error {
	serial := time.Now().UnixNano()
	schema := fmt.Sprintf("fc_acl_%x", serial)
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		return err
	}
	defer func() { _, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") }()

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return err
	}
	cfg.MaxConns = 10
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := db.ApplySpecs(ctx, pool, specDir); err != nil {
		return err
	}

	tag := fmt.Sprintf("%x", serial)
	r := roles{
		tag: tag, prov: "harness_fc_prov_" + tag, migr: "harness_fc_migr_" + tag,
		rtApp: "harness_fc_rt_app_" + tag, rtWorld: "harness_fc_rt_world_" + tag,
		rtAcct: "harness_fc_rt_acct_" + tag, maint: "harness_fc_maint_" + tag, disc: "harness_fc_disc_" + tag,
	}
	r.all = []string{r.prov, r.migr, r.rtApp, r.rtWorld, r.rtAcct, r.maint, r.disc}
	defer func() {
		for _, name := range r.all {
			_, _ = admin.Exec(ctx, "DROP ROLE IF EXISTS "+name)
		}
	}()
	if err := createRoles(ctx, admin, schema, r); err != nil {
		return err
	}
	cmd, acct, err := seedRow(ctx, pool)
	if err != nil {
		return err
	}
	observer := pool

	if err := scenarioRoleCategories(ctx, admin, r, pass); err != nil {
		return err
	}
	if err := scenarioRuntimeNotMigration(ctx, admin, dsn, schema, r, pass); err != nil {
		return err
	}
	if err := scenarioNoWritePrivilege(ctx, dsn, schema, observer, cmd, acct, r, pass); err != nil {
		return err
	}
	if err := scenarioDiscoveryReadOnly(ctx, dsn, schema, observer, cmd, acct, r, pass); err != nil {
		return err
	}
	if err := scenarioPartialGrantNotEnablement(ctx, dsn, schema, observer, r, pass); err != nil {
		return err
	}
	if err := scenarioRuntimeWorldWriteAllowed(ctx, dsn, schema, observer, acct, r, pass); err != nil {
		return err
	}

	var provSU bool
	if err := admin.QueryRow(ctx, `SELECT rolsuper FROM pg_roles WHERE rolname='postgres'`).Scan(&provSU); err != nil {
		return err
	}
	pass(fmt.Sprintf("ROLE_EVIDENCE provisioning_admin_superuser=%v migration_owner=%s runtime_world=%s discovery=%s",
		provSU, r.migr, r.rtWorld, r.disc))
	return nil
}

func createRoles(ctx context.Context, admin *pgxpool.Pool, schema string, r roles) error {
	for _, name := range r.all {
		if _, err := admin.Exec(ctx, "CREATE ROLE "+name+" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT"); err != nil {
			return err
		}
		if _, err := admin.Exec(ctx, "GRANT "+name+" TO CURRENT_USER"); err != nil {
			return err
		}
	}
	stmts := []string{
		"GRANT USAGE ON SCHEMA " + schema + " TO " + r.migr + ", " + r.rtWorld + ", " + r.rtApp + ", " + r.rtAcct + ", " + r.maint + ", " + r.disc,
		"GRANT CREATE ON SCHEMA " + schema + " TO " + r.migr,
		`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ` + schema + `.world_first_city_command, ` + schema + `.world_first_city_actor_slot TO ` + r.rtWorld,
		`GRANT SELECT ON TABLE ` + schema + `.world_first_city_command, ` + schema + `.world_first_city_actor_slot TO ` + r.disc,
	}
	for _, sql := range stmts {
		if _, err := admin.Exec(ctx, sql); err != nil {
			return err
		}
	}
	return nil
}

func rolePool(ctx context.Context, dsn, schema, role string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 2
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.AfterConnect = func(c context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(c, "SET ROLE "+role)
		return err
	}
	return pgxpool.NewWithConfig(ctx, cfg)
}

func seedRow(ctx context.Context, p *pgxpool.Pool) (cmd string, acct int64, err error) {
	cmd = "41000000-0000-4000-8000-000000000001"
	if _, err = p.Exec(ctx, `INSERT INTO account (login_name,password_hash,status) VALUES ('acl_u','acl_h',1)`); err != nil {
		return "", 0, err
	}
	if err = p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct); err != nil {
		return "", 0, err
	}
	if _, err = p.Exec(ctx, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'acl_p')`, acct); err != nil {
		return "", 0, err
	}
	err = ledgerIns(ctx, p, 42, cmd, acct, `\x01`, seedSHA32ACL, seedFCT1Min52)
	if err != nil {
		return "", 0, err
	}
	_, err = p.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,1,42,$2,$3::uuid)`, aclRealm, acct, cmd)
	return cmd, acct, err
}

func cmdCount(ctx context.Context, observer *pgxpool.Pool) (int, error) {
	var n int
	err := observer.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE realm_id=$1::uuid`, aclRealm).Scan(&n)
	return n, err
}

func slotFingerprint(ctx context.Context, observer *pgxpool.Pool) (string, error) {
	var h string
	err := observer.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42`, aclRealm).Scan(&h)
	return h, err
}

func scenarioRoleCategories(ctx context.Context, admin *pgxpool.Pool, r roles, pass Pass) error {
	seen := map[string]struct{}{}
	for _, name := range r.all {
		var exists bool
		if err := admin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$1)`, name).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("missing role %s", name)
		}
		if _, dup := seen[name]; dup {
			return fmt.Errorf("duplicate role name %s", name)
		}
		seen[name] = struct{}{}
	}
	if len(seen) != 7 {
		return fmt.Errorf("expected seven harness role categories, got %d", len(seen))
	}
	pass("PASS acl: role_categories_distinct (provisioning/migration/runtime×3/maintenance/discovery)")
	return nil
}

func scenarioRuntimeNotMigration(ctx context.Context, admin *pgxpool.Pool, dsn, schema string, r roles, pass Pass) error {
	for _, rt := range []string{r.rtApp, r.rtWorld, r.rtAcct} {
		var su bool
		if err := admin.QueryRow(ctx, `SELECT rolsuper FROM pg_roles WHERE rolname=$1`, rt).Scan(&su); err != nil {
			return err
		}
		if su {
			return fmt.Errorf("%s must not be superuser", rt)
		}
		if rt == r.migr {
			return fmt.Errorf("runtime role must differ from migration owner")
		}
		var member bool
		if err := admin.QueryRow(ctx, `SELECT EXISTS (
 SELECT 1 FROM pg_auth_members m JOIN pg_roles rm ON m.roleid=rm.oid JOIN pg_roles mr ON m.member=mr.oid
 WHERE rm.rolname=$1 AND mr.rolname=$2)`, r.migr, rt).Scan(&member); err != nil {
			return err
		}
		if member {
			return fmt.Errorf("%s must not be migration-owner member with inherited admin", rt)
		}
	}
	pool, err := rolePool(ctx, dsn, schema, r.rtWorld)
	if err != nil {
		return err
	}
	defer pool.Close()
	if _, err := pool.Exec(ctx, `CREATE TABLE world_first_city_harness_probe (id int)`); err == nil || !is42501(err) {
		return fmt.Errorf("runtime must not CREATE world_first_city_* (42501): %v", err)
	}
	if _, err := pool.Exec(ctx, `DROP TABLE world_first_city_command`); err == nil || !is42501(err) {
		return fmt.Errorf("runtime must not DROP ledger command table (42501): %v", err)
	}
	pass("PASS acl: runtime_not_superuser_not_migration_owner_no_ddl")
	return nil
}

func denyDML(ctx context.Context, pool *pgxpool.Pool, cmd string, acct int64) error {
	err := ledgerIns(ctx, pool, 42, "41000000-0000-4000-8000-000000000099", acct, `\x02`, seedSHA32DenyDML, seedFCT1Min52)
	if err == nil || !is42501(err) {
		return fmt.Errorf("INSERT denied: %v", err)
	}
	_, err = pool.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2 WHERE command_id=$1::uuid`, cmd)
	if err == nil || !is42501(err) {
		return fmt.Errorf("UPDATE denied: %v", err)
	}
	_, err = pool.Exec(ctx, `DELETE FROM world_first_city_command WHERE command_id=$1::uuid`, cmd)
	if err == nil || !is42501(err) {
		return fmt.Errorf("DELETE denied: %v", err)
	}
	return nil
}

func observerSnap(ctx context.Context, o *pgxpool.Pool) (int, string, error) {
	n, err := cmdCount(ctx, o)
	if err != nil {
		return 0, "", err
	}
	h, err := slotFingerprint(ctx, o)
	return n, h, err
}

func observerStable(ctx context.Context, o *pgxpool.Pool, wantN int, wantH string) error {
	n, err := cmdCount(ctx, o)
	if err != nil {
		return err
	}
	h, err := slotFingerprint(ctx, o)
	if err != nil {
		return err
	}
	if n != wantN {
		return fmt.Errorf("observer: command rows stable (want=%d got=%d)", wantN, n)
	}
	if h != wantH {
		return fmt.Errorf("observer: slot head unchanged")
	}
	return nil
}

func scenarioNoWritePrivilege(ctx context.Context, dsn, schema string, observer *pgxpool.Pool, cmd string, acct int64, r roles, pass Pass) error {
	beforeN, beforeH, err := observerSnap(ctx, observer)
	if err != nil {
		return err
	}
	pool, err := rolePool(ctx, dsn, schema, r.maint)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := denyDML(ctx, pool, cmd, acct); err != nil {
		return err
	}
	if err := observerStable(ctx, observer, beforeN, beforeH); err != nil {
		return err
	}
	pass("PASS acl: maintenance_no_ledger_write_42501_observer_unchanged")
	return nil
}

func scenarioDiscoveryReadOnly(ctx context.Context, dsn, schema string, observer *pgxpool.Pool, cmd string, acct int64, r roles, pass Pass) error {
	beforeN, beforeH, err := observerSnap(ctx, observer)
	if err != nil {
		return err
	}
	pool, err := rolePool(ctx, dsn, schema, r.disc)
	if err != nil {
		return err
	}
	defer pool.Close()
	var got string
	if err := pool.QueryRow(ctx, `SELECT command_id::text FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&got); err != nil {
		return err
	}
	if got != cmd {
		return fmt.Errorf("discovery SELECT allowed")
	}
	if err := denyDML(ctx, pool, cmd, acct); err != nil {
		return err
	}
	if err := observerStable(ctx, observer, beforeN, beforeH); err != nil {
		return fmt.Errorf("discovery write denied; rows stable: %w", err)
	}
	pass("PASS acl: discovery_select_only_write_denied_42501")
	return nil
}

func scenarioPartialGrantNotEnablement(ctx context.Context, dsn, schema string, observer *pgxpool.Pool, r roles, pass Pass) error {
	pool, err := rolePool(ctx, dsn, schema, r.rtApp)
	if err != nil {
		return err
	}
	defer pool.Close()
	var n int
	err = pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command`).Scan(&n)
	if err == nil || !is42501(err) {
		return fmt.Errorf("runtime APP without SELECT still closed (42501): %v", err)
	}
	before, err := cmdCount(ctx, observer)
	if err != nil {
		return err
	}
	err = ledgerIns(ctx, pool, 42, "41000000-0000-4000-8000-0000000000aa", 1, `\x03`, seedSHA32Partial, seedFCT1Min52)
	if err == nil || !is42501(err) {
		return fmt.Errorf("partial grant does not enable write: %v", err)
	}
	after, err := cmdCount(ctx, observer)
	if err != nil {
		return err
	}
	if after != before {
		return fmt.Errorf("partial grant is not partial enablement")
	}
	pass("PASS acl: partial_grants_fail_closed_not_partial_enablement")
	return nil
}

func scenarioRuntimeWorldWriteAllowed(ctx context.Context, dsn, schema string, observer *pgxpool.Pool, acct int64, r roles, pass Pass) error {
	before, err := cmdCount(ctx, observer)
	if err != nil {
		return err
	}
	pool, err := rolePool(ctx, dsn, schema, r.rtWorld)
	if err != nil {
		return err
	}
	defer pool.Close()
	newCmd := "41000000-0000-4000-8000-000000000002"
	err = ledgerIns(ctx, pool, 43, newCmd, acct, `\x04`, seedSHA32WorldIns, seedFCT1Min52)
	if err == nil {
		after, err := cmdCount(ctx, observer)
		if err != nil {
			return err
		}
		if after != before+1 {
			return fmt.Errorf("narrow WORLD grant allows INSERT in harness only: before=%d after=%d", before, after)
		}
		pass("PASS acl: runtime_world_narrow_grant_insert_in_disposable_harness_only")
		return nil
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		pass("PASS acl: runtime_world_had_dml_privilege_unique_not_acl")
		return nil
	}
	return fmt.Errorf("unexpected runtime world insert: %w", err)
}
