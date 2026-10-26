package main

import (
	"fmt"
	"strings"
)

func negative() {
	cases := []struct{ name, ddl, error string }{
		{"wrong type", legacy[1] + "ALTER TABLE player_hero_captive ALTER city_id TYPE integer", "columns/defaults"},
		{"missing column", legacy[1] + "ALTER TABLE player_hero_captive DROP city_id", "columns/defaults"},
		{"extra column", legacy[1] + "ALTER TABLE player_hero_captive ADD extra integer", "columns/defaults"},
		{"dropped-column residue", legacy[1] + "ALTER TABLE player_hero_captive ADD extra integer; ALTER TABLE player_hero_captive DROP extra", "columns/defaults"},
		{"wrong order", "CREATE TABLE player_hero_captive(server_id int NOT NULL,city_id bigint NOT NULL,hero_id bigint NOT NULL,summon_item_cfg_id int NOT NULL DEFAULT 0,summon_item_qty int NOT NULL DEFAULT 0,PRIMARY KEY(server_id,hero_id))", "columns/defaults"},
		{"nullable city", legacy[1] + "ALTER TABLE player_hero_captive ALTER city_id DROP NOT NULL", "columns/defaults"},
		{"missing default", legacy[1] + "ALTER TABLE player_hero_captive ALTER summon_item_qty DROP DEFAULT", "columns/defaults"},
		{"wrong default", legacy[1] + "ALTER TABLE player_hero_captive ALTER summon_item_qty SET DEFAULT 4", "columns/defaults"},
		{"new default", legacy[1] + "ALTER TABLE player_hero_captive ALTER city_id SET DEFAULT 0", "columns/defaults"},
		{"expression default", legacy[1] + "ALTER TABLE player_hero_captive ALTER summon_item_qty SET DEFAULT (0+0)", "columns/defaults"},
		{"identity", legacy[1] + "ALTER TABLE player_hero_captive ALTER hero_id ADD GENERATED ALWAYS AS IDENTITY", "columns/defaults"},
		{"generated column", "CREATE TABLE player_hero_captive(server_id int NOT NULL,hero_id bigint NOT NULL,city_id bigint GENERATED ALWAYS AS(hero_id) STORED NOT NULL,summon_item_cfg_id int NOT NULL DEFAULT 0,summon_item_qty int NOT NULL DEFAULT 0,PRIMARY KEY(server_id,hero_id))", "columns/defaults"},
		{"NULL timestamp tightened", legacy[2] + "ALTER TABLE player_hero_lionize ALTER last_persuade_at SET NOT NULL", "columns/defaults"},
		{"timestamp default", legacy[2] + "ALTER TABLE player_hero_lionize ALTER last_persuade_at SET DEFAULT now()", "columns/defaults"},
		{"timestamp type", legacy[2] + "ALTER TABLE player_hero_lionize ALTER last_persuade_at TYPE timestamp", "columns/defaults"},
		{"missing PK", legacy[1] + "ALTER TABLE player_hero_captive DROP CONSTRAINT player_hero_captive_pkey", "unexpected constraints"},
		{"wrong PK order", legacy[1] + "ALTER TABLE player_hero_captive DROP CONSTRAINT player_hero_captive_pkey; ALTER TABLE player_hero_captive ADD PRIMARY KEY(hero_id,server_id)", "primary key"},
		{"deferrable PK", legacy[1] + "ALTER TABLE player_hero_captive DROP CONSTRAINT player_hero_captive_pkey; ALTER TABLE player_hero_captive ADD PRIMARY KEY(server_id,hero_id) DEFERRABLE", "primary key"},
		{"extra CHECK", legacy[1] + "ALTER TABLE player_hero_captive ADD CHECK(city_id>0)", "unexpected constraints"},
		{"extra UNIQUE", legacy[1] + "ALTER TABLE player_hero_captive ADD UNIQUE(city_id)", "unexpected constraints"},
		{"extra FK", legacy[1] + "ALTER TABLE player_hero_captive ADD FOREIGN KEY(server_id,hero_id) REFERENCES player_hero(server_id,hero_id)", "unexpected constraints"},
		{"extra index", legacy[1] + "CREATE INDEX extra ON player_hero_captive(city_id)", "primary index"},
		{"invalid PK index", legacy[1] + "UPDATE pg_index SET indisvalid=false WHERE indexrelid='player_hero_captive_pkey'::regclass", "primary index"},
		{"not-ready PK index", legacy[1] + "UPDATE pg_index SET indisready=false WHERE indexrelid='player_hero_captive_pkey'::regclass", "primary index"},
		{"covering PK index", legacy[1] + "ALTER TABLE player_hero_captive DROP CONSTRAINT player_hero_captive_pkey; CREATE UNIQUE INDEX covering ON player_hero_captive(server_id,hero_id) INCLUDE(city_id); ALTER TABLE player_hero_captive ADD PRIMARY KEY USING INDEX covering", "primary index"},
		{"unlogged", legacy[1] + "ALTER TABLE player_hero_captive SET UNLOGGED", "incompatible relation"},
		{"view", "CREATE VIEW player_hero_captive AS SELECT 1::bigint hero_id", "incompatible relation"},
		{"materialized view", "CREATE MATERIALIZED VIEW player_hero_captive AS SELECT 1::bigint hero_id", "incompatible relation"},
		{"sequence", "CREATE SEQUENCE player_hero_captive", "incompatible relation"},
		{"partitioned", "CREATE TABLE player_hero_captive(server_id int) PARTITION BY LIST(server_id)", "incompatible relation"},
		{"inheritance parent", legacy[1] + "CREATE TABLE child() INHERITS(player_hero_captive)", "incompatible relation"},
		{"inheritance child", "CREATE TABLE parent(id int); CREATE TABLE player_hero_captive() INHERITS(parent)", "incompatible relation"},
		{"RLS", legacy[1] + "ALTER TABLE player_hero_captive ENABLE ROW LEVEL SECURITY", "incompatible relation"},
		{"forced RLS", legacy[1] + "ALTER TABLE player_hero_captive FORCE ROW LEVEL SECURITY", "incompatible relation"},
		{"inactive policy", legacy[1] + "CREATE POLICY added ON player_hero_captive USING(true)", "trigger/policy/rule"},
		{"rewrite rule", legacy[1] + "CREATE RULE suppress AS ON INSERT TO player_hero_captive DO INSTEAD NOTHING", "trigger/policy/rule"},
		{"trigger", legacy[1] + "CREATE FUNCTION added() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$; CREATE TRIGGER added BEFORE INSERT ON player_hero_captive FOR EACH ROW EXECUTE FUNCTION added()", "trigger/policy/rule"},
		{"replica identity", legacy[1] + "ALTER TABLE player_hero_captive REPLICA IDENTITY FULL", "incompatible relation"},
		{"storage options", legacy[1] + "ALTER TABLE player_hero_captive SET(fillfactor=80)", "incompatible relation"},
	}
	for _, tc := range cases {
		func() {
			p, _, done := fresh()
			defer done()
			baseline(p)
			exec(p, tc.ddl)
			sequences, history := seq(p), ledger(p)
			failApply(p, tc.error)
			assert(value(p, "SELECT (to_regclass('player_hero_coming') IS NULL)::text") == "true", "validation created coming before rejecting existing object")
			assert(sequences == seq(p) && history == ledger(p), "negative changed sequence/history")
			fmt.Println("PASS fail closed: " + tc.name)
		}()
	}
	func() {
		p, _, done := fresh()
		defer done()
		baseline(p)
		seed(p, 2)
		exec(p, "ALTER TABLE player_hero_lionize ADD extra int")
		before := snapshot(p, []string{tables[2]})
		failApply(p, "hero metadata: incompatible columns/defaults")
		assert(before == snapshot(p, []string{tables[2]}), "incompatible populated target changed")
		fmt.Println("PASS incompatible populated row/OID/default/constraint preservation")
	}()
	func() {
		p, _, done := fresh()
		defer done()
		baseline(p)
		exec(p, "CREATE TEMP TABLE temporary_marker(id int); SET search_path=pg_temp")
		_, err := p.Exec(ctx, body)
		assert(err != nil && strings.Contains(err.Error(), "invalid target schema"), "temporary target accepted")
		fmt.Println("PASS direct body rejects temporary target namespace")
	}()
	func() {
		p, _, done := fresh()
		defer done()
		baseline(p)
		tx, err := p.Begin(ctx)
		must(err)
		defer tx.Rollback(ctx)
		_, err = tx.Exec(ctx, "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
		must(err)
		_, err = tx.Exec(ctx, body)
		assert(err != nil && strings.Contains(err.Error(), "requires READ COMMITTED"), "stale isolation accepted")
		must(tx.Rollback(ctx))
		fmt.Println("PASS direct body rejects non-READ-COMMITTED isolation")
	}()
}
