package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Disposable admin DSN only: create/drop our own NOLOGIN role and database.
// SET ROLE exercises actual non-superuser privileges on every pooled connection;
// no GRANT, ALTER OWNER, credentials or existing public-schema writes are needed.
func defaultPublic(ctx context.Context, admin *pgxpool.Pool, dsn string) {
	name := fmt.Sprintf("queue_id_public_%x", time.Now().UnixNano())
	role := name + "_owner"
	_, err := admin.Exec(ctx, "CREATE ROLE "+role+" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE")
	must(err)
	defer func() { _, err := admin.Exec(ctx, "DROP ROLE "+role); must(err) }()
	_, err = admin.Exec(ctx, "CREATE DATABASE "+name+" OWNER "+role)
	must(err)
	defer func() { _, err := admin.Exec(ctx, "DROP DATABASE "+name); must(err) }()
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.ConnConfig.Database = name
	delete(cfg.ConnConfig.RuntimeParams, "search_path")
	cfg.ConnConfig.RuntimeParams["sanguo.queue_id_retained_highwater"] = "7000"
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET ROLE "+role)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	defer pool.Close()
	var schema string
	var superuser, owner bool
	must(pool.QueryRow(ctx, `SELECT current_schema(),
		(SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user),
		nspowner='pg_database_owner'::regrole AND
		(SELECT datdba FROM pg_catalog.pg_database WHERE datname=current_database())=current_user::regrole
		FROM pg_catalog.pg_namespace WHERE nspname='public'`).Scan(&schema, &superuser, &owner))
	if schema != "public" || superuser || !owner {
		panic("fixture must be actual non-superuser database owner on untouched default public")
	}
	must(db.ApplySpecs(ctx, pool, "spec/db"))
	var id int64
	for want := int64(7001); want <= 7002; want++ {
		must(pool.QueryRow(ctx, "SELECT nextval('work_queue_id_seq')").Scan(&id))
		if id != want {
			panic(fmt.Sprintf("public replay ID=%d want=%d", id, want))
		}
		_, err = pool.Exec(ctx, "DELETE FROM schema_migrations WHERE name='m4_008_work_queue_id_sequence.sql'")
		must(err)
		must(db.ApplySpecs(ctx, pool, "spec/db"))
	}
	// Superuser privileges do not make the admin the actual owner of this database.
	adminCfg := cfg.Copy()
	adminCfg.AfterConnect = nil
	nonowner, err := pgxpool.NewWithConfig(ctx, adminCfg)
	must(err)
	defer nonowner.Close()
	body, err := os.ReadFile("spec/db/m4_008_work_queue_id_sequence.sql")
	must(err)
	_, err = nonowner.Exec(ctx, string(body))
	if err == nil || !strings.Contains(err.Error(), "schema ownership/privileges mismatch") {
		panic(fmt.Sprintf("non-owner public migration was not rejected: %v", err))
	}
	fmt.Println("PASS actual non-superuser database-owner ApplySpecs on untouched public and replay; different admin/non-owner rejected")
}
