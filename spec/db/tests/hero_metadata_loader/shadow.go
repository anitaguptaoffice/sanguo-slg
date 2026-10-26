package main

import (
	"fmt"
)

// Readiness must check the relation seen by unqualified runtime consumers,
// including PostgreSQL's implicit temporary schema precedence.
func shadow() {
	for _, name := range tables {
		func() {
			p, schema, done := fresh()
			defer done()
			apply(p)
			before := snapshot(p, tables)
			exec(p, "CREATE TEMP TABLE "+name+" (marker text)")
			ready(p, "shadowed runtime relation")
			exec(p, "SET search_path="+schema+",pg_temp")
			ready(p, "") // Explicit app-first ordering resolves the correct target.
			exec(p, "DROP TABLE pg_temp."+name)
			assert(before == snapshot(p, tables), "readiness shadow rejection changed target")
			ready(p, "")
		}()
		func() {
			p, schema, done := fresh()
			defer done()
			baseline(p)
			exec(p, "CREATE TEMP TABLE "+name+" (marker text)")
			failApply(p, "shadowed runtime relation")
			for _, target := range tables {
				assert(value(p, "SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='"+schema+"' AND c.relname='"+target+"'") == "0", "shadow failure left partial provisioning")
			}
			exec(p, "DROP TABLE pg_temp."+name)
			apply(p)
		}()
	}
	func() {
		p, schema, done := fresh()
		defer done()
		apply(p)
		exec(p, "CREATE FUNCTION "+schema+".eq_oid(oid,oid) RETURNS boolean LANGUAGE sql IMMUTABLE AS 'SELECT true'; CREATE OPERATOR "+schema+".= (LEFTARG=oid, RIGHTARG=oid, FUNCTION="+schema+".eq_oid)")
		exec(p, "SET search_path="+schema+",pg_catalog; CREATE TEMP TABLE player_hero_captive(marker text)")
		ready(p, "shadowed runtime relation")
		exec(p, "DROP TABLE pg_temp.player_hero_captive")
		ready(p, "")
	}()
	p, _, done := fresh()
	defer done()
	apply(p)
	tx, err := p.Begin(ctx)
	must(err)
	defer tx.Rollback(ctx)
	var before, after string
	must(tx.QueryRow(ctx, "SHOW search_path").Scan(&before))
	_, err = tx.Exec(ctx, body)
	must(err)
	must(tx.QueryRow(ctx, "SHOW search_path").Scan(&after))
	assert(before == after, "validator leaked its catalog-only search_path")
	must(tx.Rollback(ctx))
	fmt.Println("PASS implicit temporary shadows rejected atomically; caller search_path preserved")
}
