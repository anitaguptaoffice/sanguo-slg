-- Run from repository root with psql -X -v ON_ERROR_STOP=1 -f this-file.
-- ONLY an authorized disposable PG17 database, no production connection.
-- The schema name must be absent. No roles, grants, RLS, or trigger mutation.
\set ON_ERROR_STOP on
\set guard_sql `cat spec/db/m4_008_work_queue_id_sequence.sql`
CREATE SCHEMA recruit_guard_test;
SET search_path = recruit_guard_test, pg_catalog;
CREATE FUNCTION pg_temp.expect_guard(source text, expected_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE failure text; before_value bigint; before_called boolean; after_value bigint; after_called boolean;
BEGIN
    IF to_regclass('recruit_guard_test.work_queue_id_seq') IS NOT NULL THEN
        SELECT last_value,is_called INTO before_value,before_called FROM recruit_guard_test.work_queue_id_seq;
    END IF;
    BEGIN EXECUTE source; EXCEPTION WHEN OTHERS THEN failure := SQLERRM; END;
    IF failure IS DISTINCT FROM expected_error THEN
        RAISE EXCEPTION 'guard result mismatch: expected %, got %',expected_error,failure;
    END IF;
    IF failure IS NOT NULL AND before_value IS NOT NULL THEN
        SELECT last_value,is_called INTO after_value,after_called FROM recruit_guard_test.work_queue_id_seq;
        IF (before_value,before_called) IS DISTINCT FROM (after_value,after_called) THEN
            RAISE EXCEPTION 'rejected audit changed sequence';
        END IF;
    END IF;
END $$;
CREATE TABLE work_queue(server_id integer NOT NULL, queue_id bigint NOT NULL, player_id bigint NOT NULL,
    city_id bigint, queue_type smallint NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
    start_at timestamptz NOT NULL, finish_at timestamptz NOT NULL, status smallint NOT NULL DEFAULT 0,
    PRIMARY KEY(server_id,queue_id));
-- Both absent preserves precreate. Every invocation is a fresh statement.
SELECT pg_temp.expect_guard(:'guard_sql');
SET search_path = recruit_guard_test, pg_catalog;
CREATE TABLE mil_recruit_origin(server_id integer NOT NULL,
    queue_id bigint NOT NULL CHECK(queue_id >= 1 AND queue_id <= 9007199254740991), player_id bigint NOT NULL,
    operation smallint NOT NULL CHECK(operation = 1),
    command_id bytea NOT NULL CHECK(octet_length(command_id) = 16 AND command_id <> decode(repeat('00',16),'hex')),
    PRIMARY KEY(server_id,queue_id), UNIQUE(server_id,player_id,operation,command_id));
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: partial recruit storage');
CREATE TABLE mil_recruit_receipt(server_id integer NOT NULL,
    queue_id bigint NOT NULL CHECK(queue_id >= 1 AND queue_id <= 9007199254740991),
    intent_version smallint NOT NULL CHECK(intent_version = 1), city_id bigint NOT NULL,
    unit_cfg_id integer NOT NULL CHECK(unit_cfg_id >= 1 AND unit_cfg_id <= 4), count integer NOT NULL CHECK(count > 0),
    food_paid bigint NOT NULL CHECK(food_paid >= 0), wood_paid bigint NOT NULL CHECK(wood_paid >= 0),
    iron_paid bigint NOT NULL CHECK(iron_paid >= 0), stone_paid bigint NOT NULL CHECK(stone_paid >= 0),
    duration_sec bigint NOT NULL CHECK(duration_sec > 0), catalog_version bytea NOT NULL CHECK(octet_length(catalog_version) > 0),
    rule_digest bytea NOT NULL CHECK(octet_length(rule_digest) = 32),
    accepted_at timestamptz NOT NULL CHECK(isfinite(accepted_at) AND accepted_at >= '0001-01-01T00:00:00Z' AND accepted_at < '10000-01-01T00:00:00Z' AND date_trunc('milliseconds',accepted_at) = accepted_at),
    initial_start_at timestamptz NOT NULL CHECK(isfinite(initial_start_at) AND initial_start_at >= '0001-01-01T00:00:00Z' AND initial_start_at < '10000-01-01T00:00:00Z' AND date_trunc('milliseconds',initial_start_at) = initial_start_at),
    initial_finish_at timestamptz NOT NULL CHECK(isfinite(initial_finish_at) AND initial_finish_at >= '0001-01-01T00:00:00Z' AND initial_finish_at < '10000-01-01T00:00:00Z' AND date_trunc('milliseconds',initial_finish_at) = initial_finish_at),
    initial_status smallint NOT NULL CHECK(initial_status IN (0,1)), PRIMARY KEY(server_id,queue_id),
    FOREIGN KEY(server_id,queue_id) REFERENCES mil_recruit_origin(server_id,queue_id) ON UPDATE RESTRICT ON DELETE RESTRICT);
SELECT pg_temp.expect_guard(:'guard_sql');
SET search_path = recruit_guard_test, pg_catalog;
INSERT INTO mil_recruit_origin VALUES(1,1200,1,1,decode(repeat('01',16),'hex'));
SELECT pg_temp.expect_guard(:'guard_sql');
DO $$ BEGIN IF (SELECT last_value FROM recruit_guard_test.work_queue_id_seq) <> 1200 THEN RAISE EXCEPTION 'origin highwater missed'; END IF; END $$;
SET search_path = recruit_guard_test, pg_catalog;
SELECT setval('work_queue_id_seq',1400,true);
SELECT pg_temp.expect_guard(:'guard_sql');
DO $$ BEGIN IF (SELECT last_value FROM recruit_guard_test.work_queue_id_seq) <> 1400 THEN RAISE EXCEPTION 'sequence lowered'; END IF; END $$;
SET search_path = recruit_guard_test, pg_catalog;
INSERT INTO work_queue VALUES(1,1200,1,10,3,'{}','2026-01-01Z','2026-01-01Z',0);
INSERT INTO mil_recruit_receipt VALUES(1,1200,1,10,1,1,0,0,0,0,1,decode('01','hex'),
    decode(repeat('01',32),'hex'),'2026-01-01Z','2026-01-01Z','2026-01-01 00:00:01Z',0);
SELECT pg_temp.expect_guard(:'guard_sql');
SET search_path = recruit_guard_test, pg_catalog;
BEGIN; UPDATE work_queue SET player_id = 99;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: corrupt recruit identity'); ROLLBACK;
BEGIN; UPDATE work_queue SET city_id = NULL;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: corrupt recruit identity'); ROLLBACK;
BEGIN; UPDATE work_queue SET queue_type = 1;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: corrupt recruit identity'); ROLLBACK;
BEGIN; UPDATE work_queue SET server_id = 2;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: corrupt recruit identity'); ROLLBACK;
-- Safely create a real orphan with an unvalidated FK. Rejection occurs at metadata,
-- not the later anti-join; never claim this independently exercises that branch.
BEGIN; ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_server_id_queue_id_fkey;
UPDATE mil_recruit_receipt SET queue_id = 1199;
ALTER TABLE mil_recruit_receipt ADD FOREIGN KEY(server_id,queue_id)
    REFERENCES mil_recruit_origin(server_id,queue_id) ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: incompatible recruit constraints'); ROLLBACK;
BEGIN; ALTER TABLE mil_recruit_origin ADD COLUMN extra integer;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: incompatible recruit columns'); ROLLBACK;
BEGIN; ALTER TABLE mil_recruit_origin DROP CONSTRAINT mil_recruit_origin_operation_check;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: incompatible recruit constraints'); ROLLBACK;
BEGIN; CREATE INDEX extra_index ON mil_recruit_origin(player_id);
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: unexpected recruit index'); ROLLBACK;
BEGIN; CREATE TABLE extra_reference(queue_id bigint);
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: unreviewed queue reference'); ROLLBACK;
BEGIN; DROP SEQUENCE work_queue_id_seq;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: recruit storage requires existing sequence');
DO $$ BEGIN IF to_regclass('recruit_guard_test.work_queue_id_seq') IS NOT NULL THEN RAISE EXCEPTION 'missing sequence recreated'; END IF; END $$; ROLLBACK;
BEGIN; INSERT INTO mil_recruit_origin VALUES(2,1200,2,1,decode(repeat('02',16),'hex'));
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: corrupt recruit identity'); ROLLBACK;
BEGIN; INSERT INTO mil_recruit_origin VALUES(1,9007199254740991,1,1,decode(repeat('03',16),'hex'));
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: retained namespace exhausted'); ROLLBACK;
BEGIN; ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_server_id_queue_id_fkey;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: incompatible recruit constraints'); ROLLBACK;
BEGIN; INSERT INTO work_queue SELECT server_id,0,player_id,city_id,queue_type,payload,start_at,finish_at,status FROM work_queue;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: invalid retained row ID'); ROLLBACK;
BEGIN; INSERT INTO work_queue SELECT server_id,9007199254740992,player_id,city_id,queue_type,payload,start_at,finish_at,status FROM work_queue;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: invalid retained row ID'); ROLLBACK;
BEGIN; ALTER TABLE mil_recruit_origin ALTER COLUMN player_id SET DEFAULT 1;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: incompatible recruit columns'); ROLLBACK;
BEGIN; DROP TABLE mil_recruit_receipt;
CREATE VIEW mil_recruit_receipt AS SELECT 1 AS queue_id;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: incompatible recruit relations'); ROLLBACK;
BEGIN; ALTER TABLE mil_recruit_receipt DROP CONSTRAINT mil_recruit_receipt_server_id_queue_id_fkey;
ALTER TABLE mil_recruit_receipt ADD FOREIGN KEY(server_id,queue_id)
    REFERENCES mil_recruit_origin(server_id,queue_id) ON UPDATE RESTRICT ON DELETE CASCADE;
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: incompatible recruit constraints'); ROLLBACK;
BEGIN; SET LOCAL sanguo.queue_id_retained_highwater = '1600';
SELECT pg_temp.expect_guard(:'guard_sql'); ROLLBACK;
DO $$ BEGIN IF (SELECT last_value FROM recruit_guard_test.work_queue_id_seq) <> 1600 THEN RAISE EXCEPTION 'forward setval unexpectedly rolled back'; END IF; END $$;
BEGIN; SET LOCAL sanguo.queue_id_retained_highwater = '-1';
SELECT pg_temp.expect_guard(:'guard_sql','queue identity: invalid schema/retained highwater'); ROLLBACK;
BEGIN; SET LOCAL TimeZone = 'Asia/Shanghai'; SET LOCAL DateStyle = 'SQL, DMY';
SELECT pg_temp.expect_guard(:'guard_sql');
DO $$ BEGIN IF current_setting('TimeZone') <> 'Asia/Shanghai' OR current_setting('DateStyle') <> 'SQL, DMY' THEN RAISE EXCEPTION 'session presentation changed'; END IF; END $$; ROLLBACK;
-- Missing-ledger old body refuses new refs; ledger-present skip is not an audit.
-- Full runner/restore provenance and actual application-role tests are separate.
SELECT 'recruit allocator guard cases passed' AS result;
DROP SCHEMA recruit_guard_test CASCADE;
