#!/usr/bin/env python3
"""SPEC catalog-spoof regression. Requires an explicit disposable PostgreSQL DSN."""
import os
from pathlib import Path
import subprocess
import uuid

DB = Path(__file__).resolve().parents[1]
DSN = os.environ["SPEC_CATALOG_SHADOW_TEST_DSN"]
BASE = "\n".join(p.read_text() for p in sorted(DB.glob("*.sql")) if p.name < "m4_005_hero_id_sequence.sql")
PREFIX, SCHEMAS = "catalog_shadow_" + uuid.uuid4().hex[:12], []


def sql(schema, body, error=None):
    result = subprocess.run([os.environ.get("PSQL", "psql"), "-XqAt", DSN, "-v", "ON_ERROR_STOP=1"],
                            input=f"SET search_path={schema};\n" + body, text=True, capture_output=True)
    if error:
        assert result.returncode != 0 and error in result.stderr, result.stderr
    else:
        assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def fresh():
    schema = f"{PREFIX}_{len(SCHEMAS)}"
    sql("public", f"CREATE SCHEMA {schema};")
    SCHEMAS.append(schema)
    sql(schema, BASE)
    return schema


def dump(schema):
    executable = str(Path(os.environ.get("PSQL", "psql")).with_name("pg_dump"))
    result = subprocess.run([executable, DSN, "--schema=" + schema], text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return "\n".join(line for line in result.stdout.splitlines()
                     if not line.startswith(("\\restrict ", "\\unrestrict ")))


try:
    for file, seq, source, column in [
        ("m4_005_hero_id_sequence.sql", "player_hero_id_seq", "player_hero", "hero_id"),
        ("m4_006_hotel_candidate_id_sequence.sql", "city_hotel_candidate_id_seq", "city_hotel_recruit", "candidate_id"),
    ]:
        migration = (DB / file).read_text()
        s = fresh()
        sql(s, f"CREATE SEQUENCE {seq} AS bigint MINVALUE 1 MAXVALUE 2 START 1 CYCLE;")
        before = dump(s)
        # Exact aggregate-review spoof: a real cycling allocator disguised by copied catalog rows.
        spoof = ("CREATE TEMP TABLE pg_sequence AS SELECT * FROM pg_catalog.pg_sequence;"
                 "UPDATE pg_temp.pg_sequence SET seqmax=9223372036854775807,seqcycle=false "
                 f"WHERE seqrelid='{s}.{seq}'::regclass;")
        sql(s, spoof + migration, error="incompatible sequence configuration/ownership")
        assert dump(s) == before
        assert sql(s, f"SELECT seqmax,seqcycle FROM pg_catalog.pg_sequence WHERE seqrelid='{seq}'::regclass") == "2|t"
        assert sql(s, f"SELECT last_value,is_called FROM {seq}") == "1|f"
        print("PASS " + seq + " forged pg_sequence rejected; no allocation/advance/ACL/data/owner mutation", flush=True)

        s = fresh()
        before = dump(s)
        sql(s, "BEGIN;CREATE TEMP TABLE pg_attribute AS SELECT attrelid,attname,attisdropped,atttypid FROM pg_catalog.pg_attribute;"
            f"ALTER TABLE {source} ALTER {column} TYPE integer;" + migration, error="unexpected reference shape")
        assert dump(s) == before
        assert sql(s, f"SELECT to_regclass('{seq}') IS NULL") == "t"
        print("PASS " + source + " forged pg_attribute cannot hide wrong source type; rollback/no allocator", flush=True)

        s = fresh()
        sql(s, "CREATE TEMP TABLE pg_sequence AS SELECT * FROM pg_catalog.pg_sequence;" + migration)
        before = dump(s)
        sql(s, migration)
        assert dump(s) == before and sql(s, f"SELECT nextval('{seq}')") == "1"
        print("PASS " + seq + " genuine fresh allocation/replay ignores stale temp catalog", flush=True)

    migration = (DB / "m4_007_hero_metadata.sql").read_text()
    for readonly in [False, True]:
        s = fresh()
        sql(s, migration + "INSERT INTO player_hero_captive VALUES(1,7,9,3,4);")
        # Preserve the reviewer's ordering: snapshot correct defaults, then change the real one.
        spoof = ("CREATE TEMP TABLE pg_attrdef AS SELECT * FROM pg_catalog.pg_attrdef;"
                 "ALTER TABLE player_hero_captive ALTER summon_item_qty SET DEFAULT 1;")
        if readonly:
            spoof += "BEGIN READ ONLY;SET LOCAL sanguo.hero_metadata_validate_only='true';"
        sql(s, spoof + migration, error="incompatible columns/defaults")
        assert sql(s, "SELECT pg_catalog.pg_get_expr(d.adbin,d.adrelid) FROM pg_catalog.pg_attrdef d "
                   "JOIN pg_catalog.pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum "
                   "WHERE a.attrelid='player_hero_captive'::regclass AND a.attname='summon_item_qty'") == "1"
        before = dump(s)
        sql(s, migration, error="incompatible columns/defaults")
        assert dump(s) == before
        assert sql(s, "SELECT * FROM player_hero_captive") == "1|7|9|3|4"
        print(f"PASS metadata forged pg_attrdef rejected; read_only={readonly}; existing default/data/ACL/owner retained", flush=True)
finally:
    for schema in SCHEMAS:
        sql("public", f"DROP SCHEMA IF EXISTS {schema} CASCADE;")
