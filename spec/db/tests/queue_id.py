#!/usr/bin/env python3
"""Explicit disposable PostgreSQL only; unique owned schemas, no runtime activation."""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import subprocess
import uuid

DB = Path(__file__).resolve().parents[1]
DSN = os.environ["QUEUE_ID_TEST_DSN"]
MIGRATION = (DB / "m4_008_work_queue_id_sequence.sql").read_text()
BASE = (DB / "003_domestic.sql").read_text()
SEQ, SETTING = "work_queue_id_seq", "sanguo.queue_id_retained_highwater"
MAX = 9007199254740991
PREFIX, SCHEMAS = "queue_id_" + uuid.uuid4().hex[:12], []


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


def cleanup():
    for schema in SCHEMAS:
        sql("public", f"DROP SCHEMA IF EXISTS {schema} CASCADE")


def next_id(schema, expected):
    assert sql(schema, f"SELECT nextval('{SEQ}')") == str(expected)


def row(server, city, identity, kind=1, status=0):
    return ("INSERT INTO work_queue(server_id,city_id,queue_id,player_id,queue_type,start_at,finish_at,status) "
            f"VALUES({server},{city},{identity},42,{kind},'2026-01-01','2026-01-02',{status});")


def core():
    s = fresh()
    sql(s, MIGRATION)
    assert sql(s, f"SELECT last_value,is_called FROM {SEQ}") == "1|f"
    oid = sql(s, f"SELECT '{SEQ}'::regclass::oid")
    next_id(s, 1)
    sql(s, MIGRATION)
    next_id(s, 2)
    assert sql(s, f"SELECT '{SEQ}'::regclass::oid") == oid
    print("PASS empty first ID; same-object replay", flush=True)

    s = fresh()
    sql(s, row(1, 1, 70) + row(1, 2, 80, 1, 1) + row(2, 1, 70, 3, 2) + row(2, 2, 900, 2, 3))
    before = sql(s, "SELECT row_to_json(q) FROM work_queue q ORDER BY server_id,queue_id")
    sql(s, MIGRATION)
    assert sql(s, "SELECT row_to_json(q) FROM work_queue q ORDER BY server_id,queue_id") == before
    next_id(s, 901)
    sql(s, "DELETE FROM work_queue;" + MIGRATION)
    next_id(s, 902)
    print("PASS all cities/shards/types/statuses; unchanged identities/rows; no deletion reset", flush=True)

    for called, expected in [("true", 9001), ("false", 9000)]:
        s = fresh()
        sql(s, MIGRATION + f"SELECT setval('{SEQ}',9000,{called});" + MIGRATION)
        next_id(s, expected)
    s = fresh()
    sql(s, MIGRATION + f"SELECT setval('{SEQ}',5000,false);SET {SETTING}='5000';" + MIGRATION)
    next_id(s, 5001)
    sql(s, f"BEGIN; SET LOCAL {SETTING}='8000';" + MIGRATION + "ROLLBACK;")
    next_id(s, 8001)
    sql(s, row(2, 3, 9500) + f"SET {SETTING}='10000';" + MIGRATION)
    next_id(s, 10001)
    print("PASS higher called/uncalled state; equal reservation; rollback and restore forward-only", flush=True)

    s = fresh()
    sql(s, MIGRATION)
    with ThreadPoolExecutor(max_workers=8) as workers:
        batches = list(workers.map(lambda _: sql(s, f"SELECT nextval('{SEQ}') FROM generate_series(1,20)"), range(8)))
    ids = [int(v) for batch in batches for v in batch.splitlines()]
    assert len(ids) == len(set(ids)) == 160 and min(ids) > 0
    next_id(s, max(ids) + 1)
    print("PASS independent concurrent allocator connections", flush=True)

    for fixture, message in [
        (f"SET {SETTING}='{MAX}';", "exhausted"), (row(1, 1, MAX), "exhausted"),
        (f"SET {SETTING}='-1';", "invalid"), (f"SET {SETTING}='{MAX + 1}';", "invalid"),
        (f"SET {SETTING}='bogus';", "invalid input"), (row(1, 1, 0), "invalid retained"),
        (row(1, 1, MAX + 1), "invalid retained"),
    ]:
        s = fresh()
        sql(s, fixture + MIGRATION, error=message)
        assert sql(s, f"SELECT to_regclass('{SEQ}') IS NULL") == "t"
    s = fresh()
    sql(s, f"SET {SETTING}='{MAX - 1}';" + MIGRATION)
    next_id(s, MAX)
    sql(s, f"SELECT nextval('{SEQ}')", error="maximum value")
    sql(s, MIGRATION, error="sequence exhausted")
    print("PASS safe-integer ceiling once; exhaustion/no cycle; invalid row/reservation rejected", flush=True)


if __name__ == "__main__":
    try:
        core()
    finally:
        cleanup()
