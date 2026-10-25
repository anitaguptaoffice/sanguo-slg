#!/usr/bin/env bash
# Contract SQL acceptance only; does not establish a deployment write gate.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to a disposable PostgreSQL database}"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SCHEMA="production_backfill_test_$$_${RANDOM}"
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1)
"${PSQL[@]}" -q -c "CREATE SCHEMA $SCHEMA"
trap '"${PSQL[@]}" -q -c "DROP SCHEMA $SCHEMA CASCADE"' EXIT
sql() { "${PSQL[@]}" -qAt -c "SET search_path TO $SCHEMA; $1"; }
file() { { echo "SET search_path TO $SCHEMA;"; cat "$1"; } | "${PSQL[@]}" -q; }
assert() { [[ $(sql "$1") == "$2" ]] || { echo "FAIL: $3" >&2; exit 1; }; echo "PASS: $3"; }
for f in 001_account.sql 002_world.sql 003_domestic.sql 007_domestic_production_checkpoint.sql; do file "$ROOT/$f"; done
sql "INSERT INTO account(login_name,password_hash) VALUES ('fixture','unused');
INSERT INTO player(server_id,player_id,account_id,display_name) SELECT 1,42,account_id,'fixture' FROM account;
INSERT INTO player_wallet(server_id,player_id,food,updated_at) VALUES (1,42,1000,'2026-01-01 00:00:00+00');
INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES (1,1,42,'A',1,1),(1,2,42,'B',2,2);"
backfill() { file "$ROOT/migrations/007_backfill_city_production_checkpoint.sql"; }
reset() { sql "TRUNCATE city_production_checkpoint,city_building,work_queue;
UPDATE player_wallet SET updated_at='2026-01-01 00:00:00+00';"; }
reject() {
 local log
 log=$(mktemp)
 if backfill >"$log" 2>&1; then cat "$log"; rm "$log"; echo "FAIL: expected $1"; exit 1; fi
 grep -F "$2" "$log" || { cat "$log"; rm "$log"; exit 1; }
 rm "$log"
 echo "PASS: $1 rejected"
}
backfill
assert "SELECT count(*) FROM city_production_checkpoint WHERE settled_at='2026-01-01 00:00:00+00'" 2 'both cities seeded before either settlement'
sql "UPDATE player_wallet SET updated_at='2026-01-01 01:00:00+00';
UPDATE city_production_checkpoint SET settled_at='2026-01-01 01:00:00+00',food_remainder=123,settled_submicro_ns=456 WHERE city_id=1;"
assert "SELECT extract(epoch FROM ('2026-01-01 01:00:00+00'::timestamptz-settled_at))::int FROM city_production_checkpoint WHERE city_id=2" 3600 'city A settlement does not erase city B hour'
backfill
assert "SELECT count(*) FROM city_production_checkpoint WHERE (city_id=1 AND food_remainder=123 AND settled_submicro_ns=456 AND settled_at='2026-01-01 01:00:00+00') OR (city_id=2 AND settled_at='2026-01-01 00:00:00+00')" 2 'replay never resets existing clock or carry'
reset
sql "INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at,food_remainder) VALUES (1,1,42,'2025-12-31 23:59:00+00',789);"
backfill
assert "SELECT count(*) FROM city_production_checkpoint WHERE (city_id=1 AND food_remainder=789 AND settled_at='2025-12-31 23:59:00+00') OR (city_id=2 AND settled_at='2026-01-01 00:00:00+00')" 2 'partial gated resume preserves old row and seeds missing city'
reset
sql 'DELETE FROM player_wallet'
reject 'missing wallet' 'missing player or wallet'
assert 'SELECT count(*) FROM city_production_checkpoint' 0 'missing wallet leaves no partial inserts'
sql "INSERT INTO player_wallet(server_id,player_id,food,updated_at) VALUES (1,42,1000,'2026-01-01 00:00:00+00'); UPDATE player_city SET player_id=99 WHERE city_id=2;"
reject 'orphan owner' 'missing player or wallet'
sql 'UPDATE player_city SET player_id=42'
reset
sql "INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id) VALUES (1,999,'farm',2);"
reject 'orphan domestic city' 'orphan domestic city or queue owner mismatch'
assert 'SELECT count(*) FROM city_production_checkpoint' 0 'orphan fails before inserts'
reset
sql "INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at) VALUES (1,999,42,'2026-01-01 00:00:00+00');"
reject 'orphan checkpoint' 'checkpoint orphan or owner mismatch'
reset
sql "INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at,wood_remainder) VALUES (1,1,99,'2026-01-01 00:00:00+00',123);"
reject 'checkpoint owner mismatch' 'checkpoint orphan or owner mismatch'
assert 'SELECT player_id FROM city_production_checkpoint WHERE city_id=1' 99 'mismatch never silently reassigns ownership'
assert 'SELECT count(*) FROM city_production_checkpoint' 1 'mismatch leaves no additional inserts'
reset
sql "INSERT INTO work_queue(server_id,queue_id,player_id,city_id,queue_type,start_at,finish_at) VALUES (1,1,99,1,1,now(),now());"
reject 'build queue owner mismatch' 'orphan domestic city or queue owner mismatch'
assert 'SELECT count(*) FROM city_production_checkpoint' 0 'queue mismatch leaves no partial inserts'
echo 'All production checkpoint backfill contract checks passed.'
