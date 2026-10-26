#!/usr/bin/env python3
"""Adversarial source/sequence/namespace fixtures; same disposable-DSN contract."""
import queue_id as q

CREATE = f"CREATE SEQUENCE {q.SEQ} AS bigint MINVALUE 1 MAXVALUE {q.MAX} START 1 CACHE 1 NO CYCLE;"


def rejects(fixture, message):
    s = q.fresh()
    q.sql(s, fixture)
    q.sql(s, q.MIGRATION, error=message)
    assert q.sql(s, f"SELECT to_regclass('{q.SEQ}') IS NULL") == "t"


try:
    for change in ["AS integer MAXVALUE 2147483647", "INCREMENT 2", "CYCLE", "MINVALUE 0",
                   "MAXVALUE 99", "CACHE 8", "START 5", "OWNED BY work_queue.queue_id",
                   "OWNER TO pg_database_owner", "SET UNLOGGED"]:
        s = q.fresh()
        q.sql(s, CREATE + f"ALTER SEQUENCE {q.SEQ} {change};")
        q.sql(s, q.MIGRATION, error="queue identity:")
        assert q.sql(s, f"SELECT last_value,is_called FROM {q.SEQ}") == "1|f"
        print("PASS unchanged incompatible sequence: " + change, flush=True)
    s = q.fresh()
    q.sql(s, f"CREATE TABLE {q.SEQ}(id bigint)")
    q.sql(s, q.MIGRATION, error="queue identity:")
    print("PASS sequence-name table not adopted", flush=True)

    for fixture, message in [
        ("DROP TABLE work_queue;", "missing schema-local"),
        ("DROP TABLE work_queue;CREATE VIEW work_queue AS SELECT 1::bigint queue_id;", "incompatible work_queue relation"),
        ("ALTER TABLE work_queue ALTER queue_id TYPE integer;", "columns/defaults"),
        ("ALTER TABLE work_queue ALTER city_id SET NOT NULL;", "columns/defaults"),
        ("ALTER TABLE work_queue ALTER payload SET DEFAULT '[]';", "columns/defaults"),
        ("ALTER TABLE work_queue ADD extra integer;", "columns/defaults"),
        ("ALTER TABLE work_queue ADD extra integer;ALTER TABLE work_queue DROP extra;", "columns/defaults"),
        ("ALTER TABLE work_queue DROP CONSTRAINT work_queue_pkey;", "primary key"),
        ("ALTER TABLE work_queue DROP CONSTRAINT work_queue_pkey;ALTER TABLE work_queue ADD PRIMARY KEY(queue_id);", "primary key"),
        ("ALTER TABLE work_queue DROP CONSTRAINT work_queue_pkey;ALTER TABLE work_queue ADD PRIMARY KEY(server_id,queue_id) DEFERRABLE;", "ownership/metadata"),
        ("ALTER TABLE work_queue ADD CHECK(queue_id>0);", "primary key"),
        ("ALTER TABLE work_queue SET UNLOGGED;", "ownership/metadata"),
        ("ALTER TABLE work_queue OWNER TO pg_database_owner;", "ownership/metadata"),
        ("ALTER TABLE work_queue ENABLE ROW LEVEL SECURITY;", "ownership/metadata"),
        ("ALTER TABLE work_queue FORCE ROW LEVEL SECURITY;", "ownership/metadata"),
        ("CREATE TABLE child() INHERITS(work_queue);", "ownership/metadata"),
        ("CREATE RULE ignore_delete AS ON DELETE TO work_queue DO INSTEAD NOTHING;", "ownership/metadata"),
        ("CREATE TRIGGER suppress BEFORE UPDATE ON work_queue FOR EACH ROW EXECUTE FUNCTION pg_catalog.suppress_redundant_updates_trigger();", "ownership/metadata"),
        ("CREATE TABLE extra_ref(queue_id bigint);", "unreviewed queue reference"),
        ("CREATE VIEW extra_ref AS SELECT queue_id FROM work_queue;", "unreviewed queue reference"),
        ("CREATE TABLE extra_ref(queue_ids bigint[]);", "unreviewed queue reference"),
    ]:
        rejects(fixture, message)
    print("PASS 21 wrong source shape/PK/ownership/RLS/inheritance/trigger/rule/reference cases", flush=True)

    s = q.fresh()
    q.sql(s, f"ALTER SCHEMA {s} OWNER TO pg_database_owner;")
    q.sql(s, q.MIGRATION, error="schema ownership/privileges")
    q.sql(s, "BEGIN ISOLATION LEVEL REPEATABLE READ;" + q.MIGRATION, error="requires READ COMMITTED")
    q.sql("pg_catalog", q.MIGRATION, error="invalid schema")
    q.sql("information_schema", q.MIGRATION, error="invalid schema")
    print("PASS wrong namespace owner/system namespace/isolation", flush=True)

    s = q.fresh()
    q.sql(s, CREATE + f"SELECT setval('{q.SEQ}',{q.MAX},false);" + q.MIGRATION)
    q.next_id(s, q.MAX)
    q.sql(s, q.MIGRATION, error="sequence exhausted")
    assert q.sql(s, f"SELECT last_value,is_called FROM {q.SEQ}") == f"{q.MAX}|t"
    print("PASS existing uncalled safe maximum allocated once; exhausted replay unchanged", flush=True)

    s, later = q.fresh(), q.fresh()
    q.sql(later, CREATE + f"SELECT setval('{q.SEQ}',7000,false)")
    q.sql(s, q.MIGRATION, path=f"{s},{later}")
    q.next_id(s, 1)
    q.next_id(later, 7000)
    q.sql(s, "DROP TABLE work_queue;")
    q.sql(s, q.MIGRATION, path=f"{s},{later}", error="missing schema-local")
    print("PASS schema-local sequence creation; later source/sequence never adopted", flush=True)

    for decoy in ["CREATE TEMP TABLE work_queue(queue_id bigint);",
                  f"CREATE TEMP SEQUENCE {q.SEQ};"]:
        s = q.fresh()
        q.sql(s, decoy + q.MIGRATION, error="shadowed runtime relation")
        assert q.sql(s, f"SELECT to_regclass('{q.SEQ}') IS NULL") == "t"
        q.sql(s, CREATE + f"SELECT setval('{q.SEQ}',50,true)")
        q.sql(s, decoy + f"SET {q.SETTING}='9000';" + q.MIGRATION, error="shadowed runtime relation")
        assert q.sql(s, f"SELECT last_value,is_called FROM {q.SEQ}") == "50|t"
    print("PASS implicit pg_temp source/sequence shadows abort before create/advance persists", flush=True)

    s = q.fresh()
    decoys = ""
    for name, args, result in [("current_schema", "", "name"), ("current_setting", "text,boolean", "text"),
                               ("set_config", "text,text,boolean", "text"), ("to_regclass", "text", "regclass"),
                               ("setval", "regclass,bigint,boolean", "bigint"), ("min", "bigint", "bigint"),
                               ("max", "bigint", "bigint")]:
        decoys += (f"CREATE FUNCTION {s}.{name}({args}) RETURNS {result} LANGUAGE plpgsql "
                   "AS $$BEGIN RAISE EXCEPTION 'unsafe shadow called'; END$$;")
    decoys += (f"CREATE FUNCTION {s}.false_eq(oid,oid) RETURNS boolean LANGUAGE sql AS 'SELECT false';"
               f"CREATE OPERATOR {s}.= (FUNCTION={s}.false_eq, LEFTARG=oid, RIGHTARG=oid);")
    q.sql(s, decoys)
    q.sql(s, q.row(1, 1, 123) + q.MIGRATION, path=f"{s},pg_catalog")
    q.next_id(s, 124)
    print("PASS hostile function/operator search_path does not affect trusted validation/allocation", flush=True)

    s = q.fresh()
    q.sql(s, f"CREATE SEQUENCE {q.SEQ} AS bigint MINVALUE 1 MAXVALUE 2 START 1 CYCLE;")
    spoof_sequence = ("CREATE TEMP TABLE pg_sequence AS SELECT * FROM pg_catalog.pg_sequence;"
                      f"UPDATE pg_temp.pg_sequence SET seqmax={q.MAX},seqcycle=false "
                      f"WHERE seqrelid='{s}.{q.SEQ}'::regclass;")
    q.sql(s, spoof_sequence + q.MIGRATION, error="incompatible sequence configuration")
    assert q.sql(s, f"SELECT last_value,is_called FROM {q.SEQ}") == "1|f"
    assert q.sql(s, f"SELECT seqmax,seqcycle FROM pg_catalog.pg_sequence WHERE seqrelid='{q.SEQ}'::regclass") == "2|t"
    print("PASS forged pg_temp.pg_sequence cannot bless or advance a real cycling allocator", flush=True)

    for existing in [False, True]:
        s = q.fresh()
        if existing:
            q.sql(s, CREATE + f"SELECT setval('{q.SEQ}',50,true);")
        spoof_defaults = ("CREATE TEMP TABLE pg_attrdef AS SELECT * FROM pg_catalog.pg_attrdef;"
                          "ALTER TABLE work_queue ALTER payload SET DEFAULT '[]';"
                          f"SET {q.SETTING}='9000';")
        q.sql(s, spoof_defaults + q.MIGRATION, error="columns/defaults")
        if existing:
            assert q.sql(s, f"SELECT last_value,is_called FROM {q.SEQ}") == "50|t"
        else:
            assert q.sql(s, f"SELECT to_regclass('{q.SEQ}') IS NULL") == "t"
    print("PASS forged pg_temp.pg_attrdef cannot hide wrong default; no create/advance persists", flush=True)
finally:
    q.cleanup()
