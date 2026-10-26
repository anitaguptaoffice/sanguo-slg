#!/usr/bin/env python3
"""Real PostgreSQL fixture; requires explicit RECRUIT_ID_TEST_DSN (disposable DB)."""
import os
from pathlib import Path
import re
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[3]
DB = ROOT / "spec/db"
DSN = os.environ["RECRUIT_ID_TEST_DSN"]
MIGRATION = (DB / "m4_005_hero_id_sequence.sql").read_text()
BASE = "\n".join(p.read_text() for p in sorted(DB.glob("*.sql"))
                 if p.name < "m4_005_hero_id_sequence.sql")
PREFIX = "recruit_id_" + uuid.uuid4().hex[:12]
SCHEMAS = []
COUNT = 0


def sql(schema, body, error=None, path=None):
    command = [os.environ.get("PSQL", "psql"), "-XqAt", DSN, "-v", "ON_ERROR_STOP=1"]
    result = subprocess.run(command, input=f'SET search_path TO {path or schema};\n' + body,
                            text=True, capture_output=True, check=False)
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
    print(f"PASS {label}", flush=True)


def next_id(schema, expected):
    assert sql(schema, "SELECT nextval('player_hero_id_seq')") == str(expected)


def runtime_ddl(file, constant):
    source = (ROOT / "internal/hero" / file).read_text()
    return re.search(r"const " + constant + r" = `([\s\S]*?)`", source).group(1)


try:
    s = fresh()
    assert sql(s, "SELECT to_regclass('player_hero_coming') IS NULL") == "t"
    sql(s, MIGRATION)
    assert sql(s, "SELECT last_value,is_called FROM player_hero_id_seq") == "1|f"
    assert sql(s, "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
               f"WHERE n.nspname='{s}' AND c.relname='hero_expr_session'") == "0"
    next_id(s, 1)
    sql(s, MIGRATION)
    next_id(s, 2)
    check("empty -> 1; optional tables absent; consumed-ID replay never resets")

    s = fresh()
    sql(s, "INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id) "
           "VALUES (1,700,1,1),(2,700,2,1),(3,900,3,1)")
    sql(s, MIGRATION)
    next_id(s, 901)
    sql(s, "INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id) VALUES(4,901,4,1);")
    sql(s, "DELETE FROM player_hero WHERE hero_id>=900;" + MIGRATION)
    next_id(s, 902)
    assert sql(s, "SELECT count(*) FROM player_hero WHERE hero_id=700") == "2"
    check("all shards; old duplicate IDs untouched; deleted highest not reused")

    references = [
        ("hero_skill", "", "INSERT INTO hero_skill VALUES(1,3000,1,1)"),
        ("hero_assignment", "", "INSERT INTO hero_assignment VALUES(2,3000,1,1,now())"),
        ("field_army", "", "INSERT INTO field_army(server_id,army_id,owner_player_id,x,y,hero_ids) "
         "VALUES(3,1,1,0,0,'{NULL,4,3000}')"),
        ("hero_largess_schedule", runtime_ddl("pg_store.go", "heroLargessScheduleDDL"),
         "INSERT INTO hero_largess_schedule VALUES(1,3000,now())"),
        ("hero_march_force", runtime_ddl("pg_store.go", "heroMarchForceDDL"),
         "INSERT INTO hero_march_force VALUES(1,3000,100,now())"),
        ("hero_expr_session", runtime_ddl("pg_store.go", "heroExprSessionDDL"),
         "INSERT INTO hero_expr_session VALUES(1,3000,now(),now(),1)"),
        ("player_hero_coming", runtime_ddl("coming_store.go", "playerHeroComingDDL"),
         "INSERT INTO player_hero_coming VALUES(1,3000,1)"),
        ("player_hero_captive", runtime_ddl("captive_store.go", "playerHeroCaptiveDDL"),
         "INSERT INTO player_hero_captive VALUES(1,3000,1,0,0)"),
    ]
    for table, ddl, data in references:
        s = fresh()
        sql(s, ddl + data + ";" + MIGRATION)
        next_id(s, 3001)
        check(f"orphan reference highwater: {table}")
    s = fresh()
    sql(s, runtime_ddl("persuade_store.go", "playerHeroLionizeDDL") +
        "INSERT INTO player_hero_lionize VALUES(1,9223372036854775807,1,0,0,NULL);" + MIGRATION)
    next_id(s, 1)
    check("lionize player/NPC keys are not hero identities")

    for called, expected in [("true", 9001), ("false", 9000)]:
        s = fresh()
        sql(s, MIGRATION + f"SELECT setval('player_hero_id_seq',9000,{called});" + MIGRATION)
        next_id(s, expected)
    s = fresh()
    sql(s, MIGRATION + "SELECT setval('player_hero_id_seq',5000,false);"
        "SET sanguo.hero_id_reserved_highwater='5000';" + MIGRATION)
    next_id(s, 5001)
    check("higher called/uncalled sequence preserved; reserved equality advances")

    s = fresh()
    sql(s, "CREATE TABLE schema_migrations(name text PRIMARY KEY);" + MIGRATION)
    oid = sql(s, "SELECT 'player_hero_id_seq'::regclass::oid")
    assert sql(s, "SELECT count(*) FROM schema_migrations") == "0"
    sql(s, MIGRATION + "INSERT INTO schema_migrations VALUES('m4_005_hero_id_sequence.sql')")
    assert sql(s, "SELECT 'player_hero_id_seq'::regclass::oid") == oid
    next_id(s, 1)
    sql(s, "BEGIN; SET LOCAL sanguo.hero_id_reserved_highwater='8000';" + MIGRATION + "ROLLBACK;")
    next_id(s, 8001)
    check("SQL-complete/ledger-missing replay keeps object; rollback never lowers existing state")

    for fixture, message in [
        ("SET sanguo.hero_id_reserved_highwater='9223372036854775807';", "exhausted"),
        ("INSERT INTO hero_skill VALUES(1,9223372036854775807,1,1);", "exhausted"),
        ("SET sanguo.hero_id_reserved_highwater='-1';", "invalid"),
        ("SET sanguo.hero_id_reserved_highwater='bogus';", "invalid input"),
        ("SET sanguo.hero_id_reserved_highwater='9223372036854775808';", "out of range"),
    ]:
        s = fresh()
        sql(s, fixture + MIGRATION, error=message)
        assert sql(s, "SELECT to_regclass('player_hero_id_seq') IS NULL") == "t"
    s = fresh()
    sql(s, "SET sanguo.hero_id_reserved_highwater='9223372036854775806';" + MIGRATION)
    next_id(s, 9223372036854775807)
    sql(s, "SELECT nextval('player_hero_id_seq')", error="maximum value")
    sql(s, MIGRATION, error="sequence exhausted")
    check("reserved/reference bounds; last BIGINT allocates once; exhausted never wraps")

    configurations = ["AS integer", "INCREMENT 2", "CYCLE", "MINVALUE 0", "MAXVALUE 99",
                      "CACHE 8", "START 5", "OWNED BY player_hero.hero_id"]
    for config in configurations + ["unlogged", "table"]:
        s = fresh()
        ddl = f"CREATE SEQUENCE player_hero_id_seq {config}"
        if config == "unlogged":
            ddl = "CREATE UNLOGGED SEQUENCE player_hero_id_seq"
        if config == "table":
            ddl = "CREATE TABLE player_hero_id_seq(id bigint)"
        sql(s, ddl)
        sql(s, MIGRATION, error="hero ID migration:")
        if config != "table":
            assert sql(s, "SELECT is_called FROM player_hero_id_seq") == "f"
        check(f"reject incompatible existing object: {config}")

    s, shadow = fresh(), fresh()
    sql(shadow, "CREATE SEQUENCE player_hero_id_seq START 7000")
    sql(s, MIGRATION, path=f"{s},{shadow}")
    next_id(s, 1)
    next_id(shadow, 7000)
    sql(s, "DROP TABLE hero_skill")
    sql(s, MIGRATION, error="missing", path=f"{s},{shadow}")
    check("schema-local sequence/reference lookup; no adoption from later search_path")
    for fixture, error in [
        ("ALTER TABLE hero_skill ALTER hero_id TYPE integer;", "unexpected reference shape"),
        ("CREATE VIEW player_hero_coming AS SELECT 1::bigint AS hero_id;", "unexpected reference shape"),
        ("CREATE TABLE extra_ref(hero_id bigint);", "unreviewed hero reference"),
        ("ALTER TABLE hero_skill ADD hero_ids bigint[] DEFAULT '{9000}'; INSERT INTO hero_skill(server_id,hero_id,skill_cfg_id) VALUES(1,2,1);", "unreviewed hero reference"),
        ("ALTER TABLE field_army ADD hero_id bigint DEFAULT 9000;", "unreviewed hero reference"),
        ("BEGIN ISOLATION LEVEL REPEATABLE READ;", "requires READ COMMITTED"),
    ]:
        s = fresh()
        sql(s, fixture + MIGRATION, error=error)
        assert sql(s, "SELECT to_regclass('player_hero_id_seq') IS NULL") == "t"
    check("fail closed on source shape, view, unknown table/column references, stale snapshot")
    print(f"PASS {COUNT} grouped PostgreSQL migration checks")
finally:
    for schema in SCHEMAS:
        sql("public", f"DROP SCHEMA IF EXISTS {schema} CASCADE")
