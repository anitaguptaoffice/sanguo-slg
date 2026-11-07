package api

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

// Independently frozen at f390bcc, never learned from observed SQL. Only the
// captured quoted schema varies. Digests cover these unqualified exact bytes.
var recruitReturnSQL = []struct{ stage, digest, sql string }{
	{"return-city", "838c2d15228c6cc089f6564c633df7895db83eeedb0834d25a6673db5e39d41c", `SELECT player_id,x,y FROM "player_city" WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`},
	{"march-lock", "cbd560e4d04029aa8912a60b9bb82c14d597e86751752dbf083c18a11cda3af5", `SELECT army_id,origin_city_id,status,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,return_finish_at FROM "march_order" WHERE server_id OPERATOR(pg_catalog.=) $1 AND march_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`},
	{"army-lock", "0b2892ef362ac54efa8d5118e6b387239f1c5712b6dde97ec7ec6ec0cd6f0e70", `SELECT owner_player_id,status,x,y,hero_ids FROM "field_army" WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`},
	{"troops-lock", "477ac58ec9ddc73a41356a9680a5455dc79cc409da3a57c9e56e16146ab7cb1b", `SELECT COALESCE(pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(count ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]) FROM (SELECT unit_cfg_id,count FROM "army_troop" WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2 ORDER BY unit_cfg_id FOR UPDATE) q`},
	{"return-credit", "2710d87cf664fa45806c90ec7dc02450d5b59572e9549c296f8364bc7ed7fbf5", `UPDATE "city_troop" SET count = $4 WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 AND unit_cfg_id OPERATOR(pg_catalog.=) $3 AND count OPERATOR(pg_catalog.=) $5 AND wounded OPERATOR(pg_catalog.=) $6`},
	{"march-done", "57c8da11b20b3a9a18780dbf92641b60efd1c96d74dc92f863e3084e6a118f45", `UPDATE "march_order" SET status = 4 WHERE server_id OPERATOR(pg_catalog.=) $1 AND march_id OPERATOR(pg_catalog.=) $2 AND army_id OPERATOR(pg_catalog.=) $3 AND origin_city_id OPERATOR(pg_catalog.=) $4 AND status OPERATOR(pg_catalog.=) 3 AND return_finish_at OPERATOR(pg_catalog.=) $5`},
	{"army-done", "32c099b458f281a256676a21e5a9d2b15e06d2dce0bccb70813002a17ad9f924", `UPDATE "field_army" SET status = 1,x = $4,y = $5 WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2 AND owner_player_id OPERATOR(pg_catalog.=) $3 AND status OPERATOR(pg_catalog.=) 2 AND x OPERATOR(pg_catalog.=) $6 AND y OPERATOR(pg_catalog.=) $7 AND hero_ids OPERATOR(pg_catalog.=) $8::pg_catalog.int8[]`},
	{"verify-stock", "19fcfaed754e041ee3dbd7e3519275f171946c5d47de72ed8e8fe40b4e0c4a2f", `SELECT pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),pg_catalog.array_agg(count ORDER BY unit_cfg_id),pg_catalog.array_agg(wounded ORDER BY unit_cfg_id) FROM "city_troop" WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2`},
	{"verify-march", "5ae3b6f5cbd390581ea32c82fb113c29bdeacda88d41877564f5dc668b395f36", `SELECT army_id,origin_city_id,status,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,return_finish_at FROM "march_order" WHERE server_id OPERATOR(pg_catalog.=) $1 AND march_id OPERATOR(pg_catalog.=) $2`},
	{"verify-army", "96dd228f20bb5d748c9bd1c768d3fef10fb5d646dd55bdb917b50f91bcd635c3", `SELECT owner_player_id,status,x,y,hero_ids FROM "field_army" WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2`},
	{"verify-troops", "dacbc4fdd7ccead7ea111904c4be414b30003be04b9d7d55bdeead22dc616c3d", `SELECT pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),pg_catalog.array_agg(count ORDER BY unit_cfg_id) FROM "army_troop" WHERE server_id OPERATOR(pg_catalog.=) $1 AND army_id OPERATOR(pg_catalog.=) $2`},
	{"account-hint-proof", "2889a3e527cd491fe8fd2f3ec2c60afef166755da69d6c2c4de987f5fe218453", `SELECT pg_catalog.count(DISTINCT relation) OPERATOR(pg_catalog.=) 2 FROM pg_catalog.pg_locks
 WHERE pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
 AND database OPERATOR(pg_catalog.=) (SELECT oid FROM pg_catalog.pg_database WHERE datname OPERATOR(pg_catalog.=) pg_catalog.current_database())
 AND locktype OPERATOR(pg_catalog.=) 'relation' AND mode OPERATOR(pg_catalog.=) 'RowShareLock' AND granted
 AND relation IN ($1,$2)`},
	{"account-hint", "4235480dc2dbad1b5b4b81f36e525bd8ed97ee54a5715fd31193136786a5b370", `SELECT account_id FROM "player" WHERE server_id OPERATOR(pg_catalog.=) $1 AND player_id OPERATOR(pg_catalog.=) $2`},
	{"account-proof", "8b30058a758b4597a146c8e7d5038c274bebe6e238bdf9372ab4f3808c682fa6", `SELECT count(DISTINCT relation)=2 FROM pg_catalog.pg_locks
 WHERE pid=pg_catalog.pg_backend_pid() AND database=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())
 AND locktype='relation' AND mode='RowShareLock' AND granted AND relation IN ($1,$2)`},
	{"actor", "0d5c09bc5f273ab0c45853d3d8bd606b296d2f99449e24928fa36df3c81f47f4", `SELECT status FROM "account" WHERE account_id OPERATOR(pg_catalog.=) $1 FOR SHARE`},
	{"player", "e565ccbd97ce436e8b9d6912e2e265720b0075b1edd324a3a9016769d8f4d8b2", `SELECT account_id FROM "player" WHERE server_id OPERATOR(pg_catalog.=) $1 AND player_id OPERATOR(pg_catalog.=) $2 FOR SHARE`},
	{"wallet-proof", "c35f4e235365475d3a5b87ff1a5b71db91a19b90750bc06031c73a8b5de45bb7", `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_locks WHERE pid=pg_catalog.pg_backend_pid() AND granted AND relation=$1::pg_catalog.oid AND mode='RowExclusiveLock')`},
	{"wallet", "a925c8bd2130bd0fc622766478876ec89da931fa4fb945eb05b67e77132b7905", `SELECT food,wood,iron,stone,gold FROM "player_wallet" WHERE server_id=$1 AND player_id=$2 FOR UPDATE`},
	{"city-proof", "b8fd4d293b748d37d5725a9dc85219215099559efeaa3dd75b6d3a2425a86ac6", `SELECT EXISTS(SELECT FROM pg_catalog.pg_locks
 WHERE pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid() AND granted AND
 relation OPERATOR(pg_catalog.=) $1::pg_catalog.oid AND mode OPERATOR(pg_catalog.=) 'RowShareLock')`},
	{"marker", "ea1e866b6c7b60dd0ac2ecfb725207f5adb82431352bfa53c4f039c92d851172", `SELECT owner_player_id,cohort_id,format_version FROM "mil_city_origin" WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE`},
	{"stock", "6353b2b524d2ab866c460890f75688638121284ac3644616964378508255f2ec", `SELECT COALESCE(pg_catalog.array_agg(unit_cfg_id ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(count ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]),COALESCE(pg_catalog.array_agg(wounded ORDER BY unit_cfg_id),'{}'::pg_catalog.int4[]) FROM (SELECT unit_cfg_id,count,wounded FROM "city_troop" WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 ORDER BY unit_cfg_id FOR UPDATE) q`},
	{"pending", "b0dfceca135b14c9687e89aebd4df1249846e4855c9e513b24c7cd7f02464840", `SELECT COALESCE(pg_catalog.array_agg(queue_id ORDER BY queue_id),'{}'::pg_catalog.int8[]),COALESCE(pg_catalog.array_agg(player_id ORDER BY queue_id),'{}'::pg_catalog.int8[]),COALESCE(pg_catalog.array_agg(status ORDER BY queue_id),'{}'::pg_catalog.int2[]),COALESCE(pg_catalog.array_agg(start_at ORDER BY queue_id),'{}'::pg_catalog.timestamptz[]),COALESCE(pg_catalog.array_agg(finish_at ORDER BY queue_id),'{}'::pg_catalog.timestamptz[]),COALESCE(pg_catalog.array_agg(payload::pg_catalog.text ORDER BY queue_id),'{}'::pg_catalog.text[]) FROM (SELECT queue_id,player_id,status,start_at,finish_at,payload FROM "work_queue" WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 AND queue_type OPERATOR(pg_catalog.=) 3 AND status IN (0,1) ORDER BY queue_id FOR UPDATE) q`},
	{"clock", "92da62dc3b3f7b341c4a327909755f3e26e99a747f830cef79e3a582a80b7556", `SELECT pg_catalog.clock_timestamp()`},
	{"evidence", "b307846c8b00294b5c501e89ab737a8e8f5247cfcfe803597064506fecdbd2ff", `SELECT pg_catalog.count(*),pg_catalog.count(*) FILTER (WHERE (
 o.player_id OPERATOR(pg_catalog.=) $3 AND o.operation OPERATOR(pg_catalog.=) 1 AND pg_catalog.octet_length(o.command_id) OPERATOR(pg_catalog.=) 16 AND o.command_id OPERATOR(pg_catalog.<>) pg_catalog.decode(pg_catalog.repeat('00',16),'hex')
 AND r.city_id OPERATOR(pg_catalog.=) $4 AND r.intent_version OPERATOR(pg_catalog.=) 1
 AND q.payload OPERATOR(pg_catalog.=) pg_catalog.jsonb_build_object('v',1,'unit_cfg_id',r.unit_cfg_id,'count',r.count,'cost_paid',pg_catalog.jsonb_build_object('food',r.food_paid,'wood',r.wood_paid,'iron',r.iron_paid,'stone',r.stone_paid),'duration_sec',r.duration_sec,'catalog_version',pg_catalog.convert_from(r.catalog_version,'UTF8'),'rule_digest',pg_catalog.encode(r.rule_digest,'hex'))
 AND r.initial_finish_at OPERATOR(pg_catalog.=) (r.initial_start_at OPERATOR(pg_catalog.+) pg_catalog.make_interval(secs => r.duration_sec))
 AND CASE WHEN r.initial_status OPERATOR(pg_catalog.=) 1 THEN r.initial_start_at OPERATOR(pg_catalog.=) r.accepted_at AND q.status OPERATOR(pg_catalog.=) 1 AND q.start_at OPERATOR(pg_catalog.=) r.initial_start_at AND q.finish_at OPERATOR(pg_catalog.=) r.initial_finish_at
  WHEN r.initial_status OPERATOR(pg_catalog.=) 0 THEN r.initial_start_at OPERATOR(pg_catalog.>=) r.accepted_at AND q.start_at OPERATOR(pg_catalog.>=) r.accepted_at AND q.finish_at OPERATOR(pg_catalog.=) (q.start_at OPERATOR(pg_catalog.+) pg_catalog.make_interval(secs => r.duration_sec)) AND ((q.status OPERATOR(pg_catalog.=) 0 AND q.start_at OPERATOR(pg_catalog.=) r.initial_start_at AND q.finish_at OPERATOR(pg_catalog.=) r.initial_finish_at) OR q.status OPERATOR(pg_catalog.=) 1)
  ELSE false END) IS NOT TRUE)
 FROM pg_catalog.unnest($2::pg_catalog.int8[]) x(queue_id)
 JOIN "work_queue" q ON q.server_id OPERATOR(pg_catalog.=) $1 AND q.queue_id OPERATOR(pg_catalog.=) x.queue_id
 LEFT JOIN "mil_recruit_origin" o ON o.server_id OPERATOR(pg_catalog.=) $1 AND o.queue_id OPERATOR(pg_catalog.=) x.queue_id
 LEFT JOIN "mil_recruit_receipt" r ON r.server_id OPERATOR(pg_catalog.=) $1 AND r.queue_id OPERATOR(pg_catalog.=) x.queue_id`},
}

func recruitReturnSQLSet(t *testing.T, p freshsource.Profile) map[string]string {
	t.Helper()
	set := map[string]string{"begin": "begin isolation level read committed", "commit": "commit",
		"recruit-sequence-read": "SELECT last_value,is_called FROM " + pgx.Identifier{p.SchemaName, "work_queue_id_seq"}.Sanitize()}
	for _, v := range recruitReturnSQL {
		if fmt.Sprintf("%x", sha256.Sum256([]byte(v.sql))) != v.digest {
			t.Fatal("frozen Return SQL bytes changed", v.stage)
		}
		sql := v.sql
		for _, name := range returnPGPins {
			sql = strings.ReplaceAll(sql, pgx.Identifier{name}.Sanitize(), pgx.Identifier{p.SchemaName, name}.Sanitize())
		}
		set[v.stage] = sql
	}
	labels := map[string]string{
		"freshActorHeader": "header", "freshBaseHeader": "header",
		"freshActorTableCatalog": "actor-tables", "freshActorFKCatalog": "actor-FK",
		"freshActorIndexCatalog": "actor-indexes", "freshActorIdentityCatalog": "actor-identity",
		"recruitWalletCatalog": "wallet-catalog", "citySequenceMetadata": "city-sequence",
		"freshSourceCatalog": "world-catalog", "validateFreshSource": "current-schema",
		"freshBaseCatalog": "mil-base", "freshQueueCatalog": "mil-queue",
		"freshRetainedCatalog": "mil-retained", "freshRetainedFK": "mil-retained-FK",
		"freshMilitarySequence": "recruit-sequence-catalog", "validateRecruitSource": "recruit-retained-write-privilege",
		"returnCatalogSQL": "return-catalog",
	}
	for _, v := range returnSQLReviewed {
		label := labels[v.symbol]
		if label == "" {
			t.Fatal("unreviewed Return metadata symbol", v.symbol)
		}
		set[label] = returnSQLSource(t, v.file, v.symbol, v.digest)
	}
	for i, name := range returnPGPins {
		prefix, mode := "LOCK TABLE ", "ROW EXCLUSIVE"
		if i >= 4 {
			prefix = "LOCK TABLE ONLY "
		}
		if i < 2 || i == 3 {
			mode = "ROW SHARE"
		}
		set["pin:"+name] = prefix + pgx.Identifier{p.SchemaName, name}.Sanitize() + " IN " + mode + " MODE"
	}
	return set
}

func recruitReturnSQLOrder(applied bool) []string {
	a := "header actor-tables actor-FK actor-indexes actor-identity"
	w := "city-sequence current-schema world-catalog"
	r := "header mil-base header mil-queue header mil-retained mil-retained-FK recruit-sequence-catalog recruit-sequence-read recruit-retained-write-privilege header return-catalog"
	order := "begin pin:account pin:player " + a + " pin:player_wallet wallet-catalog pin:player_city " + w +
		" pin:mil_city_origin pin:city_troop pin:work_queue pin:mil_recruit_origin pin:mil_recruit_receipt pin:march_order pin:field_army pin:army_troop " + r +
		" account-hint-proof " + a + " account-hint account-proof " + a + " actor player wallet-proof wallet-catalog wallet city-proof " + w +
		" return-city " + r + " marker stock pending march-lock army-lock troops-lock"
	if applied {
		order += " clock evidence return-credit return-credit return-credit return-credit march-done army-done verify-stock verify-march verify-army verify-troops"
	}
	return strings.Fields(order + " commit")
}

func recruitReturnSQLRecorded(events []returnPGQuery, observer uint32, set map[string]string, applied bool) error {
	want := recruitReturnSQLOrder(applied)
	if len(events) != len(want) {
		return fmt.Errorf("Return SQL count: got=%d want=%d", len(events), len(want))
	}
	pid := events[0].pid
	for i, q := range events {
		sql := set[want[i]]
		if q.pid == 0 || q.pid == observer || q.pid != pid || q.err != nil {
			return fmt.Errorf("Return backend/error at %d: pid=%d err=%v", i, q.pid, q.err)
		}
		if sql == "" || q.sql != sql {
			return fmt.Errorf("Return SQL at %d (%s): %q", i, want[i], q.sql)
		}
	}
	return nil
}

func TestRecruitCompletionReturnSQLWitness(t *testing.T) {
	p := freshsource.Profile{SchemaName: `return_complete_"Q`}
	set := recruitReturnSQLSet(t, p)
	for _, applied := range []bool{false, true} {
		order := recruitReturnSQLOrder(applied)
		want := 76
		if applied {
			want = 88
		}
		if len(order) != want {
			t.Fatal("frozen Return stage count changed", applied, len(order))
		}
		var valid []returnPGQuery
		for _, stage := range order {
			valid = append(valid, returnPGQuery{sql: set[stage], pid: 17})
		}
		returnPGOK(t, recruitReturnSQLRecorded(valid, 7, set, applied))
		reject := func(invalid []returnPGQuery) {
			t.Helper()
			if recruitReturnSQLRecorded(invalid, 7, set, applied) == nil {
				t.Fatal("altered Return trace accepted", applied, invalid)
			}
		}
		for i := range valid {
			reject(append(append([]returnPGQuery(nil), valid[:i]...), valid[i+1:]...))
			reject(append(append([]returnPGQuery(nil), valid[:i+1]...), valid[i:]...))
			for _, suffix := range []string{"; SELECT 1", "\n", " -- changed"} {
				bad := append([]returnPGQuery(nil), valid...)
				bad[i].sql += suffix
				reject(bad)
			}
			// Move each individual query across every distinct stage, including
			// both complete metadata blocks, proof sites and transaction ends.
			for j := range valid {
				if valid[i].sql != valid[j].sql {
					bad := append([]returnPGQuery(nil), valid...)
					bad[i], bad[j] = bad[j], bad[i]
					reject(bad)
				}
			}
			for _, pid := range []uint32{0, 7, 18} {
				bad := append([]returnPGQuery(nil), valid...)
				bad[i].pid = pid
				reject(bad)
			}
			bad := append([]returnPGQuery(nil), valid...)
			bad[i].err = fmt.Errorf("injected SQL error")
			reject(bad)
			qualifier := pgx.Identifier{p.SchemaName}.Sanitize() + "."
			if strings.Contains(valid[i].sql, qualifier) {
				for _, replacement := range []string{"", `"other".`} {
					bad = append([]returnPGQuery(nil), valid...)
					bad[i].sql = strings.Replace(valid[i].sql, qualifier, replacement, 1)
					reject(bad)
				}
			}
		}
		if recruitReturnSQLRecorded(valid, 7, set, !applied) == nil {
			t.Fatal("applied/terminal path confusion accepted")
		}
		for _, sql := range []string{"SELECT 1", "rollback", "commit", "SELECT pg_catalog.nextval($1::pg_catalog.regclass)",
			`SELECT pg_catalog.count(*) FROM pg_catalog.unnest($1::pg_catalog.oid[]) e(oid) WHERE EXISTS(SELECT FROM pg_catalog.pg_locks l WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid() AND l.granted AND l.locktype OPERATOR(pg_catalog.=) 'relation' AND l.relation OPERATOR(pg_catalog.=) e.oid AND l.mode OPERATOR(pg_catalog.=) 'RowExclusiveLock')`,
			`SELECT pg_catalog.count(*) FROM pg_catalog.unnest($1::pg_catalog.oid[]) e(oid)
 WHERE EXISTS(SELECT FROM pg_catalog.pg_locks l WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
 AND l.granted AND l.locktype OPERATOR(pg_catalog.=) 'relation' AND l.relation OPERATOR(pg_catalog.=) e.oid
 AND l.mode OPERATOR(pg_catalog.=) 'RowExclusiveLock')`,
			"SELECT pg_catalog.setval('work_queue_id_seq',1)", "WITH x AS (DELETE FROM player_wallet RETURNING *) SELECT * FROM x",
			"UPDATE player_wallet SET food=0", `LOCK TABLE "other"."account" IN ROW SHARE MODE`,
			strings.Replace(set["pin:account"], "ROW SHARE", "ACCESS EXCLUSIVE", 1)} {
			for i := range valid {
				if valid[i].sql != sql {
					bad := append([]returnPGQuery(nil), valid...)
					bad[i].sql = sql
					reject(bad)
				}
			}
		}
	}
}
