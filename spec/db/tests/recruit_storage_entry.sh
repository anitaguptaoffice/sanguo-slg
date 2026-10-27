#!/usr/bin/env bash
# ONLY a newly owned disposable PG17 database, never a shared/real database.
set -euo pipefail
root=$(cd "$(dirname "$0")/../../.." && pwd)
create="$root/spec/db/migrations/008_create_recruit_storage.psql"
audit="$root/spec/db/migrations/009_audit_recruit_storage.psql"
psql -X -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA recruit_entry_test'
trap 'psql -X -v ON_ERROR_STOP=1 -c "DROP SCHEMA recruit_entry_test CASCADE" >/dev/null' EXIT
export PGOPTIONS="${PGOPTIONS:-} -c search_path=recruit_entry_test,pg_catalog"
sql() { psql -X -v ON_ERROR_STOP=1 -Atq -c "$1"; }
assert() { test "$(sql "$1")" = t || { echo "assertion failed: $1"; exit 1; }; }
reject() {
    local output
    if output=$(psql -X -v ON_ERROR_STOP=1 -f "$1" 2>&1); then
        echo "unexpected success: $1"; exit 1
    fi
    grep -Fq "$2" <<<"$output" || { printf '%s\n' "$output"; exit 1; }
}
assert "SELECT current_setting('server_version_num')::integer / 10000 = 17"
reject "$create" 'pair must be absent and sequence already prepared'
assert "SELECT to_regclass('mil_recruit_origin') IS NULL AND to_regclass('mil_recruit_receipt') IS NULL"
reject "$audit" 'existing pair and sequence required; no repair'
sql 'CREATE SEQUENCE work_queue_id_seq AS bigint MINVALUE 1 MAXVALUE 9007199254740991 CACHE 1 NO CYCLE OWNED BY NONE'
reject "$create" 'missing schema-local work_queue'
assert "SELECT to_regclass('mil_recruit_origin') IS NULL AND to_regclass('mil_recruit_receipt') IS NULL"
sql "CREATE TABLE work_queue(server_id integer NOT NULL, queue_id bigint NOT NULL, player_id bigint NOT NULL,
 city_id bigint, queue_type smallint NOT NULL, payload jsonb NOT NULL DEFAULT '{}', start_at timestamptz NOT NULL,
 finish_at timestamptz NOT NULL, status smallint NOT NULL DEFAULT 0, PRIMARY KEY(server_id,queue_id))"
sql "INSERT INTO work_queue VALUES(1,0,1,1,1,'{}',now(),now(),0)"
reject "$create" 'invalid retained row ID'
assert "SELECT to_regclass('mil_recruit_origin') IS NULL AND to_regclass('mil_recruit_receipt') IS NULL"
sql 'DELETE FROM work_queue'
# Execute from another directory: the entry must resolve its own guard with \ir.
(cd /tmp && psql -X -v ON_ERROR_STOP=1 -f "$create")
assert "SELECT (SELECT count(*) FROM pg_attribute WHERE attrelid='mil_recruit_origin'::regclass AND attnum>0)=5
 AND (SELECT count(*) FROM pg_attribute WHERE attrelid='mil_recruit_receipt'::regclass AND attnum>0)=17"
reject "$create" 'pair must be absent and sequence already prepared'
psql -X -v ON_ERROR_STOP=1 -f "$audit"
sql "CREATE TABLE schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
 INSERT INTO schema_migrations(name) VALUES('m4_008_work_queue_id_sequence.sql')"
psql -X -v ON_ERROR_STOP=1 -f "$audit"
assert "SELECT count(*)=1 FROM schema_migrations WHERE name='m4_008_work_queue_id_sequence.sql'"
sql 'DROP SEQUENCE work_queue_id_seq'
reject "$audit" 'existing pair and sequence required; no repair'
reject "$create" 'pair must be absent and sequence already prepared'
assert "SELECT to_regclass('work_queue_id_seq') IS NULL"
# Further mutations are confined to this disposable fixture, not recovery guidance.
sql 'DROP TABLE mil_recruit_receipt'
reject "$audit" 'existing pair and sequence required; no repair'
reject "$create" 'pair must be absent and sequence already prepared'
assert "SELECT to_regclass('mil_recruit_receipt') IS NULL"
sql 'DROP TABLE mil_recruit_origin; CREATE TABLE mil_recruit_origin(unexpected integer)'
reject "$create" 'pair must be absent and sequence already prepared'
assert "SELECT count(*)=1 FROM pg_attribute WHERE attrelid='mil_recruit_origin'::regclass AND attnum>0"
echo 'recruit storage entry scenarios passed'
