package main

import (
	"fmt"
	"strings"
)

func extra() {
	func() {
		p, _, done := fresh()
		defer done()
		baseline(p)
		exec(p, `CREATE TYPE metadata_type AS (server_id int,hero_id bigint,city_id bigint,summon_item_cfg_id int,summon_item_qty int);
   CREATE TABLE player_hero_captive OF metadata_type (server_id WITH OPTIONS NOT NULL,
   hero_id WITH OPTIONS NOT NULL,city_id WITH OPTIONS NOT NULL,
   summon_item_cfg_id WITH OPTIONS NOT NULL DEFAULT 0,summon_item_qty WITH OPTIONS NOT NULL DEFAULT 0,
   PRIMARY KEY(server_id,hero_id))`)
		before := snapshot(p, []string{tables[1]})
		failApply(p, "hero metadata: incompatible relation")
		assert(before == snapshot(p, []string{tables[1]}), "typed table changed")
		assert(value(p, "SELECT (to_regclass('player_hero_coming') IS NULL)::text") == "true", "typed rejection left partial create")
		fmt.Println("PASS actual loader rejects typed-table dependency without mutation")
	}()

	func() {
		p, schema, done := fresh()
		defer done()
		baseline(p)
		// Metadata-only foreign objects: no handler, connection, server credentials or network access.
		exec(admin, "CREATE FOREIGN DATA WRAPPER "+schema+"; CREATE SERVER "+schema+" FOREIGN DATA WRAPPER "+schema)
		defer exec(admin, "DROP SERVER "+schema+" CASCADE; DROP FOREIGN DATA WRAPPER "+schema)
		exec(p, "CREATE FOREIGN TABLE player_hero_captive(hero_id bigint) SERVER "+schema)
		sequences, history := seq(p), ledger(p)
		failApply(p, "hero metadata: incompatible relation")
		assert(value(p, "SELECT (to_regclass('player_hero_coming') IS NULL)::text") == "true", "foreign rejection left partial create")
		assert(sequences == seq(p) && history == ledger(p), "foreign rejection changed sequence/history")
		fmt.Println("PASS actual loader rejects foreign object without connecting or changing it")
	}()
	for _, schema := range []string{"pg_catalog", "information_schema"} {
		func() {
			p, _, done := fresh()
			defer done()
			exec(p, "SET search_path="+schema)
			_, err := p.Exec(ctx, body)
			assert(err != nil && strings.Contains(err.Error(), "invalid target schema"), "system target accepted")
			fmt.Println("PASS direct body rejects system namespace " + schema)
		}()
	}
}
