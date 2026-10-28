#!/usr/bin/env bash
# ONLY an explicitly owned disposable PG17 database; never shared/production.
set -euo pipefail
[[ ${ALLOW_OWNED_PG17_TEST:-} == 1 ]] || { echo 'owned PG17 test opt-in required'; exit 1; }
root=$(cd "$(dirname "$0")/../../.." && pwd)
create="$root/spec/db/migrations/010_create_mil_city_origin.psql"
audit="$root/spec/db/migrations/011_audit_mil_city_origin.psql"
schema=mil_origin_entry_test
quoted_created=0
long_created=0
long_schema=$(printf 'a%.0s' {1..63})
assertions=0
rejections=0
sql() { psql -X -v ON_ERROR_STOP=1 -Atq -c "$1"; }
assert() { [[ $(sql "$1") == t ]] || { echo "assertion failed: $1"; exit 1; }; assertions=$((assertions+1)); }
entry() { psql -X -q -v ON_ERROR_STOP=1 -v city_origin_schema="$schema" -f "$1"; }
reject() {
    local output
    if output=$(entry "$1" 2>&1); then echo "unexpected success: $1"; exit 1; fi
    grep -Fq "$2" <<<"$output" || { printf '%s\n' "$output"; exit 1; }
    rejections=$((rejections+1))
}
badrow() {
    local output
    if output=$(sql "INSERT INTO mil_origin_entry_test.mil_city_origin VALUES($1)" 2>&1); then
        echo 'unexpected invalid row acceptance'; exit 1
    fi
    grep -Fq "$2" <<<"$output" || { printf '%s\n' "$output"; exit 1; }
    rejections=$((rejections+1))
}
assert "SELECT current_setting('server_version_num')::integer / 10000 = 17"
# No IF NOT EXISTS: do not adopt or later delete somebody else's schema.
sql 'CREATE SCHEMA mil_origin_entry_test'
cleanup() {
    sql 'DROP SCHEMA mil_origin_entry_test CASCADE' >/dev/null
    if [[ $quoted_created == 1 ]]; then sql 'DROP SCHEMA "mil_origin_""quoted" CASCADE' >/dev/null; fi
    if [[ $long_created == 1 ]]; then sql "DROP SCHEMA \"$long_schema\" CASCADE" >/dev/null; fi
}
trap cleanup EXIT
reject "$audit" 'audit requires PG17 and existing marker'
assert "SELECT to_regclass('mil_origin_entry_test.mil_city_origin') IS NULL"
# Owned conflicting index relation proves failed CREATE leaves no partial table.
sql 'CREATE TABLE mil_origin_entry_test.mil_city_origin_pkey(dummy integer)'
reject "$create" 'already exists'
assert "SELECT to_regclass('mil_origin_entry_test.mil_city_origin') IS NULL"
sql 'DROP TABLE mil_origin_entry_test.mil_city_origin_pkey'
(cd /tmp && entry "$create")
entry "$audit"
assert "SELECT count(*)=6 FROM pg_attribute WHERE attrelid='mil_origin_entry_test.mil_city_origin'::regclass AND attnum>0"
reject "$create" 'create requires PG17'
# Literal whitespace is semantic SQL data, not cosmetic formatting. Empty fixture
# allows the invalid date_trunc unit to exist without evaluating it on rows.
assert 'SELECT count(*)=0 FROM mil_origin_entry_test.mil_city_origin'
sql "ALTER TABLE mil_origin_entry_test.mil_city_origin DROP CONSTRAINT mil_city_origin_created_at_check;
 ALTER TABLE mil_origin_entry_test.mil_city_origin ADD CONSTRAINT mil_city_origin_created_at_check CHECK
 (isfinite(created_at) AND created_at >= '0001-01-01T00:00:00Z' AND created_at < '10000-01-01T00:00:00Z'
 AND date_trunc('milli seconds',created_at)=created_at)"
reject "$audit" 'metadata mismatch'
assert "SELECT position('milli seconds' in pg_get_constraintdef(oid))>0
 AND (SELECT count(*) FROM mil_origin_entry_test.mil_city_origin)=0 FROM pg_constraint
 WHERE conrelid='mil_origin_entry_test.mil_city_origin'::regclass AND conname='mil_city_origin_created_at_check'"
# Restore only our test-owned fixture; the auditor must never do this repair.
sql "ALTER TABLE mil_origin_entry_test.mil_city_origin DROP CONSTRAINT mil_city_origin_created_at_check;
 ALTER TABLE mil_origin_entry_test.mil_city_origin ADD CONSTRAINT mil_city_origin_created_at_check CHECK
 (isfinite(created_at) AND created_at >= '0001-01-01T00:00:00Z' AND created_at < '10000-01-01T00:00:00Z'
 AND date_trunc('milliseconds',created_at)=created_at)"
entry "$audit"
cohort="decode(repeat('01',16),'hex')"
valid_time="'2026-10-27T00:00:00.123Z'"
badrow "0,10,42,$cohort,1,$valid_time" 'mil_city_origin_server_id_check'
badrow "1,0,42,$cohort,1,$valid_time" 'mil_city_origin_city_id_check'
badrow "1,10,0,$cohort,1,$valid_time" 'mil_city_origin_owner_player_id_check'
badrow "1,10,42,decode(repeat('00',16),'hex'),1,$valid_time" 'mil_city_origin_cohort_id_check'
badrow "1,10,42,decode(repeat('01',15),'hex'),1,$valid_time" 'mil_city_origin_cohort_id_check'
badrow "1,10,42,$cohort,0,$valid_time" 'mil_city_origin_format_version_check'
for stamp in "'infinity'" "'0001-01-01 BC'" "'10000-01-01T00:00:00Z'" "'2026-10-27T00:00:00.123456Z'"; do
    badrow "1,10,42,$cohort,1,$stamp" 'mil_city_origin_created_at_check'
done
badrow "NULL,10,42,$cohort,1,$valid_time" 'null value'
sql "INSERT INTO mil_origin_entry_test.mil_city_origin VALUES
 (1,1,42,$cohort,1,'0001-01-01T00:00:00Z'),
 (2147483647,9223372036854775807,9223372036854775807,$cohort,1,'9999-12-31T23:59:59.999Z')"
entry "$audit"
assert 'SELECT count(*)=2 FROM mil_origin_entry_test.mil_city_origin'
# These changes are confined to owned fixtures, not maintenance/repair recipes.
sql 'ALTER TABLE mil_origin_entry_test.mil_city_origin ALTER COLUMN created_at SET DEFAULT now()'
reject "$audit" 'metadata mismatch'
sql 'ALTER TABLE mil_origin_entry_test.mil_city_origin ALTER COLUMN created_at DROP DEFAULT'
entry "$audit"
sql 'CREATE INDEX unwanted ON mil_origin_entry_test.mil_city_origin(owner_player_id)'
reject "$audit" 'metadata mismatch'
sql 'DROP INDEX mil_origin_entry_test.unwanted'
entry "$audit"
sql 'ALTER TABLE mil_origin_entry_test.mil_city_origin DROP CONSTRAINT mil_city_origin_server_id_check;
 ALTER TABLE mil_origin_entry_test.mil_city_origin ADD CONSTRAINT mil_city_origin_server_id_check CHECK(server_id>=0)'
reject "$audit" 'metadata mismatch'
assert 'SELECT count(*)=2 FROM mil_origin_entry_test.mil_city_origin'
sql 'ALTER TABLE mil_origin_entry_test.mil_city_origin DROP CONSTRAINT mil_city_origin_server_id_check;
 ALTER TABLE mil_origin_entry_test.mil_city_origin ADD CONSTRAINT mil_city_origin_server_id_check CHECK(server_id>0)'
entry "$audit"
sql 'ALTER TABLE mil_origin_entry_test.mil_city_origin ADD COLUMN unexpected integer'
reject "$audit" 'metadata mismatch'
reject "$create" 'create requires PG17'
assert "SELECT count(*)=7 FROM pg_attribute WHERE attrelid='mil_origin_entry_test.mil_city_origin'::regclass AND attnum>0"
sql 'DROP TABLE mil_origin_entry_test.mil_city_origin; CREATE TABLE mil_origin_entry_test.mil_city_origin(unexpected integer)'
reject "$audit" 'metadata mismatch'
reject "$create" 'create requires PG17'
assert "SELECT count(*)=1 FROM pg_attribute WHERE attrelid='mil_origin_entry_test.mil_city_origin'::regclass AND attnum>0"
sql 'CREATE SCHEMA "mil_origin_""quoted"'
quoted_created=1
schema='mil_origin_"quoted'
entry "$create"
entry "$audit"
# Use a single client session to verify LOCAL settings restore on successful audit.
restored=$(psql -X -Atq -v ON_ERROR_STOP=1 -v city_origin_schema="$schema" <<SQL
SET search_path = public;
SET TIME ZONE 'Asia/Shanghai';
SET datestyle = 'SQL, DMY';
\ir $audit
SELECT current_setting('search_path')='public' AND current_setting('TimeZone')='Asia/Shanghai'
 AND current_setting('DateStyle')='SQL, DMY';
SQL
)
[[ $(tail -n1 <<<"$restored") == t ]] || { echo 'caller settings not restored'; exit 1; }
assertions=$((assertions+1))
# A nonexistent overlong argument must never target its existing 63-byte prefix.
sql "CREATE SCHEMA \"$long_schema\""
long_created=1
schema="${long_schema}_extra"
reject "$create" 'create requires PG17'
assert "SELECT NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname::text COLLATE pg_catalog.\"C\"='$long_schema'::text COLLATE pg_catalog.\"C\" AND c.relname='mil_city_origin')"
schema=$long_schema
entry "$create"
entry "$audit"
schema="${long_schema}_extra"
reject "$audit" 'audit requires PG17 and existing marker'
assert "SELECT count(*)=0 FROM \"$long_schema\".mil_city_origin"
schema=pg_catalog
reject "$create" 'create requires PG17'
reject "$audit" 'audit requires PG17'
echo "mil_city_origin: $assertions assertions, $rejections expected rejections passed"
