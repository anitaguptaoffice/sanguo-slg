#!/usr/bin/env python3
"""Explicit disposable PG only; no runtime consumer or role changes."""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import subprocess
import uuid

DB = Path(__file__).resolve().parents[1]
DSN = os.environ["HOTEL_CANDIDATE_ID_TEST_DSN"]
MIGRATION = (DB / "m4_006_hotel_candidate_id_sequence.sql").read_text()
BASE = "\n".join(p.read_text() for p in sorted(DB.glob("*.sql"))
                 if p.name < "m4_006_hotel_candidate_id_sequence.sql")
SEQ = "city_hotel_candidate_id_seq"
SETTING = "sanguo.hotel_candidate_id_reserved_highwater"
PREFIX = "hotel_id_" + uuid.uuid4().hex[:12]
SCHEMAS = []
COUNT = 0


def sql(schema, body, error=None, path=None):
    result = subprocess.run([os.environ.get("PSQL", "psql"), "-XqAt", DSN,
                             "-v", "ON_ERROR_STOP=1"], text=True, capture_output=True,
                            input=f"SET search_path TO {path or schema};\n" + body)
    if error is not None:
        assert result.returncode != 0 and error in result.stderr, result.stderr
    else:
        assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def fresh():
    name = f"{PREFIX}_{len(SCHEMAS)}"
    sql("public", f"CREATE SCHEMA {name}")
    SCHEMAS.append(name)
    sql(name, BASE)
    return name


def check(label):
    global COUNT
    COUNT += 1
    print("PASS " + label, flush=True)


def next_id(schema, expected):
    assert sql(schema, f"SELECT nextval('{SEQ}')") == str(expected)


def candidate(server, city, identity):
    return ("INSERT INTO city_hotel_recruit(server_id,city_id,candidate_id,display_name,"
            "level,force_base,intel_base,politics_base,gold_cost) "
            f"VALUES({server},{city},{identity},'fixture',1,1,1,1,1);")


try:
    s = fresh()
    sql(s, MIGRATION)
    assert sql(s, f"SELECT last_value,is_called FROM {SEQ}") == "1|f"
    next_id(s, 1)
    sql(s, MIGRATION)
    next_id(s, 2)
    assert sql(s, "SELECT last_value,is_called FROM player_hero_id_seq") == "1|f"
    check("empty first ID; replay; independent hero sequence untouched")

    s = fresh()
    sql(s, candidate(1,1,70) + candidate(1,2,70) + candidate(2,1,900) + MIGRATION)
    next_id(s, 901)
    sql(s, "DELETE FROM city_hotel_recruit;" + MIGRATION)
    next_id(s, 902)
    check("all cities/shards; historical duplicate IDs accepted; deleted high ID not reused")

    for called, expected in [("true",9001), ("false",9000)]:
        s = fresh()
        sql(s, MIGRATION + f"SELECT setval('{SEQ}',9000,{called});" + MIGRATION)
        next_id(s, expected)
    s = fresh()
    sql(s, MIGRATION + f"SELECT setval('{SEQ}',5000,false);SET {SETTING}='5000';" + MIGRATION)
    next_id(s, 5001)
    sql(s, f"BEGIN; SET LOCAL {SETTING}='8000';" + MIGRATION + "ROLLBACK;")
    next_id(s, 8001)
    check("higher called/uncalled state; equal reservation; rollback advances only forward")

    s = fresh()
    sql(s, MIGRATION + candidate(2,3,1500) + f"SET {SETTING}='2000';" + MIGRATION)
    next_id(s, 2001)
    check("restore audit advances existing lower sequence above rows and external reservations")

    s = fresh()
    sql(s, MIGRATION)
    oid = sql(s, f"SELECT '{SEQ}'::regclass::oid")
    sql(s, MIGRATION)
    assert sql(s, f"SELECT '{SEQ}'::regclass::oid") == oid
    with ThreadPoolExecutor(max_workers=8) as workers:
        batches = list(workers.map(lambda _: sql(s, f"SELECT nextval('{SEQ}') FROM generate_series(1,20)"), range(8)))
    ids = [int(v) for batch in batches for v in batch.splitlines()]
    assert len(ids) == len(set(ids)) == 160 and min(ids) > 0
    next_id(s, max(ids) + 1)
    check("same-object replay; concurrent independent connections reserve unique batches")

    for fixture, message in [
        (f"SET {SETTING}='9223372036854775807';", "exhausted"),
        (candidate(1,1,9223372036854775807), "exhausted"),
        (f"SET {SETTING}='-1';", "invalid"),
        (f"SET {SETTING}='bogus';", "invalid input"),
        (f"SET {SETTING}='9223372036854775808';", "out of range"),
    ]:
        s = fresh()
        sql(s, fixture + MIGRATION, error=message)
        assert sql(s, f"SELECT to_regclass('{SEQ}') IS NULL") == "t"
    s = fresh()
    sql(s, f"SET {SETTING}='9223372036854775806';" + MIGRATION)
    next_id(s, 9223372036854775807)
    sql(s, f"SELECT nextval('{SEQ}')", error="maximum value")
    sql(s, MIGRATION, error="sequence exhausted")
    check("reserved/row limits; invalid inputs; last BIGINT once; no wraparound")

    configs = ["AS integer", "INCREMENT 2", "CYCLE", "MINVALUE 0", "MAXVALUE 99",
               "CACHE 8", "START 5", "OWNED BY city_hotel_recruit.candidate_id", "unlogged", "table"]
    for config in configs:
        s = fresh()
        ddl = f"CREATE SEQUENCE {SEQ} {config}"
        if config == "unlogged":
            ddl = f"CREATE UNLOGGED SEQUENCE {SEQ}"
        if config == "table":
            ddl = f"CREATE TABLE {SEQ}(id bigint)"
        sql(s, ddl)
        sql(s, MIGRATION, error="hotel candidate ID migration:")
        if config != "table":
            assert sql(s, f"SELECT is_called FROM {SEQ}") == "f"
        check("reject incompatible object/config: " + config)

    s, shadow = fresh(), fresh()
    sql(shadow, f"CREATE SEQUENCE {SEQ} START 7000")
    sql(s, MIGRATION, path=f"{s},{shadow}")
    next_id(s, 1)
    next_id(shadow, 7000)
    sql(s, "DROP TABLE city_hotel_recruit")
    sql(s, MIGRATION, error="missing", path=f"{s},{shadow}")
    check("schema-local lookup; no later-schema table/sequence adoption")

    for fixture, message in [
        ("ALTER TABLE city_hotel_recruit ALTER candidate_id TYPE integer;", "unexpected reference shape"),
        ("DROP TABLE city_hotel_recruit;CREATE VIEW city_hotel_recruit AS SELECT 1::bigint AS candidate_id;", "unexpected reference shape"),
        ("CREATE TABLE extra_ref(candidate_id bigint);", "unreviewed candidate reference"),
        ("ALTER TABLE city_hotel_recruit ADD candidate_ids bigint[];", "unreviewed candidate reference"),
        ("BEGIN ISOLATION LEVEL REPEATABLE READ;", "requires READ COMMITTED"),
    ]:
        s = fresh()
        sql(s, fixture + MIGRATION, error=message)
        assert sql(s, f"SELECT to_regclass('{SEQ}') IS NULL") == "t"
    check("wrong source shape, unknown table/column reference and stale isolation fail closed")
    print(f"PASS {COUNT} grouped PostgreSQL candidate migration checks")
finally:
    for schema in SCHEMAS:
        sql("public", f"DROP SCHEMA IF EXISTS {schema} CASCADE")
