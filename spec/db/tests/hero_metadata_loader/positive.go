package main

import (
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func shape(p *pgxpool.Pool, name string) string {
	return value(p, `SELECT jsonb_build_object('kind',c.relkind,'persistence',c.relpersistence,
  'comment',obj_description(c.oid),'columns',(SELECT jsonb_agg(jsonb_build_array(
  a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,
  a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid=c.oid AND a.attnum>0), 'pk',(SELECT jsonb_agg(jsonb_build_array(
  k.contype,k.conkey,k.condeferrable,k.condeferred,k.convalidated)) FROM pg_constraint k
  WHERE k.conrelid=c.oid))::text FROM pg_class c WHERE c.oid='`+name+`'::regclass`)
}
func ledger(p *pgxpool.Pool) string {
	return value(p, "SELECT jsonb_agg(to_jsonb(t) ORDER BY name)::text FROM schema_migrations t WHERE name<>'"+migration+"'")
}
func positive() {
	for mask := 0; mask < 8; mask++ {
		func() {
			p, _, cleanup := fresh()
			defer cleanup()
			var present []string
			for i, name := range tables {
				if mask&(1<<i) != 0 {
					seed(p, i)
					present = append(present, name)
				}
			}
			baseline(p) // Actual ordered old files see legacy optional coming/captive references.
			before, sequences, history := snapshot(p, present), seq(p), ledger(p)
			apply(p)
			assert(before == snapshot(p, present), "legacy rows/OIDs/ACLs/defaults/comments changed")
			assert(sequences == seq(p), "m4_007 changed a sequence")
			assert(history == ledger(p), "previous ledger history changed")
			after := snapshot(p, tables)
			ready(p, "")
			apply(p) // Normal second boot skips already-recorded files.
			assert(after == snapshot(p, tables) && sequences == seq(p), "second boot changed state")
			exec(p, "DELETE FROM schema_migrations WHERE name='"+migration+"'")
			apply(p) // Completed body/missing ledger replay.
			assert(after == snapshot(p, tables) && sequences == seq(p), "ledger replay changed state")
			assert(history == ledger(p), "ledger replay changed historical entries")
			exec(p, body)
			ready(p, "")
			assert(after == snapshot(p, tables), "direct replay/read-only readiness changed state")
			if mask == 0 {
				expected, _, done := fresh()
				defer done()
				for i, name := range tables {
					exec(expected, legacy[i])
					assert(shape(p, name) == shape(expected, name), "fresh shape/comment differs from audited runtime DDL")
				}
				exec(p, `INSERT INTO player_hero_captive(server_id,hero_id,city_id) VALUES(1,1,1);
     INSERT INTO player_hero_lionize(server_id,player_id,npc_cfg_id) VALUES(1,1,1)`)
				assert(value(p, "SELECT summon_item_cfg_id::text||':'||summon_item_qty FROM player_hero_captive") == "0:0", "captive defaults changed")
				assert(value(p, "SELECT friend::text||':'||state||':'||(last_persuade_at IS NULL) FROM player_hero_lionize") == "0:0:true", "lionize zero/NULL defaults changed")
			}
			fmt.Printf("PASS ApplySpecs legacy subset %03b: population/OIDs/keys/defaults/NULL/requirements, sequence, boot/replay\n", mask)
		}()
	}
	func() {
		p, schema, done := fresh()
		defer done()
		baseline(p)
		decoy, decoySchema, cleanup := fresh()
		defer cleanup()
		for i := range tables {
			seed(decoy, i)
		}
		before := snapshot(decoy, tables)
		exec(p, "SET search_path="+schema+","+decoySchema)
		apply(p)
		ready(p, "")
		for _, name := range tables {
			assert(value(p, "SELECT count(*)::text FROM "+schema+"."+name) == "0", "adopted decoy table")
		}
		assert(before == snapshot(decoy, tables), "modified decoy")
		fmt.Println("PASS absent target with populated later-schema decoys: create target only")
	}()
	func() {
		p, _, done := fresh()
		defer done()
		baseline(p)
		for i := range tables {
			seed(p, i)
		}
		exec(p, "ALTER TABLE player_hero_coming RENAME CONSTRAINT player_hero_coming_pkey TO renamed_key; COMMENT ON TABLE player_hero_coming IS 'existing comment preserved'")
		before := snapshot(p, tables)
		apply(p)
		ready(p, "")
		assert(before == snapshot(p, tables), "renamed key/comment normalized")
		fmt.Println("PASS structural renamed PK and existing comment preservation")
	}()
	func() {
		p, _, done := fresh()
		defer done()
		baseline(p)
		exec(p, "CREATE TYPE player_hero_captive AS ENUM ('collision')")
		sequences, history := seq(p), ledger(p)
		failApply(p, "already exists") // Coming was created first; captive CREATE fails.
		for _, name := range tables {
			assert(value(p, "SELECT (to_regclass('"+name+"') IS NULL)::text") == "true", "partial create survived")
		}
		assert(sequences == seq(p) && history == ledger(p), "atomic failure changed sequence/history")
		exec(p, "DROP TYPE player_hero_captive")
		apply(p)
		ready(p, "")
		fmt.Println("PASS actual loader failure after first CREATE rolls back all metadata; safe retry")
	}()
	func() {
		p, _, done := fresh()
		defer done()
		baseline(p)
		exec(p, "ALTER TABLE schema_migrations ADD CONSTRAINT deny_metadata_ledger CHECK(name<>'"+migration+"')")
		sequences, history := seq(p), ledger(p)
		failApply(p, "deny_metadata_ledger") // Body committed, separate ledger INSERT fails.
		ready(p, "")
		before := snapshot(p, tables)
		exec(p, "ALTER TABLE schema_migrations DROP CONSTRAINT deny_metadata_ledger")
		apply(p)
		assert(before == snapshot(p, tables) && sequences == seq(p) && history == ledger(p), "ledger failure retry rewrote state")
		fmt.Println("PASS actual loader ledger INSERT failure leaves complete body; safe no-rewrite retry")
	}()
	func() {
		p, _, done := fresh()
		defer done()
		baseline(p)
		ready(p, "missing")
		apply(p)
		exec(p, "ALTER TABLE player_hero_captive ALTER summon_item_qty SET DEFAULT 7")
		apply(p) // Existing ledger intentionally skips drift; independent readiness must reject.
		ready(p, "columns/defaults")
		assert(strings.Contains(shape(p, "player_hero_captive"), "7"), "readiness repaired drift")
		fmt.Println("PASS read-only missing/drift rejection despite a recorded loader ledger")
	}()
}
