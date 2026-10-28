-- SPEC-MARCH-PERSIST-001: durable march identity and recovery contract.
-- Review prerequisite only; no Go, writer, backfill or runtime provisioning.
-- ApplySpecs runs this body and records its ledger entry separately, so a
-- SQL-success/ledger-missing replay must re-run safely without resetting IDs.
-- See ../rules/MARCH_PERSISTENCE.md and the affected cards named there.
DO $march_identity$
DECLARE
    ns pg_catalog.text := pg_catalog.current_schema();
    runtime_path pg_catalog.text := pg_catalog.current_setting('search_path');
    namespace_id pg_catalog.oid;
    owner_id pg_catalog.oid;
    table_name pg_catalog.text;
    seq_name pg_catalog.text;
    tbl pg_catalog.oid;
    seq pg_catalog.oid;
    cfg record;
    last_id pg_catalog.int8;
    called pg_catalog.bool;
    ceiling CONSTANT pg_catalog.int8 := 9007199254740991;
BEGIN
    -- Trusted catalog lookup; never adopt a relation from a later or temp schema.
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    PERFORM pg_catalog.set_config('row_security', 'off', true);
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR ns = 'information_schema' THEN
        RAISE EXCEPTION 'march identity: invalid application schema';
    END IF;
    IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'march identity: requires READ COMMITTED';
    END IF;
    SELECT oid INTO STRICT owner_id FROM pg_catalog.pg_roles WHERE rolname = current_user;
    SELECT oid INTO STRICT namespace_id FROM pg_catalog.pg_namespace WHERE nspname = ns;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_namespace WHERE oid = namespace_id AND (nspowner = owner_id
        OR (ns = 'public' AND nspowner = 'pg_database_owner'::pg_catalog.regrole
            AND EXISTS (SELECT FROM pg_catalog.pg_database
                WHERE datname = current_database() AND datdba = owner_id))))
       OR NOT pg_catalog.has_schema_privilege(namespace_id, 'USAGE')
       OR NOT pg_catalog.has_schema_privilege(namespace_id, 'CREATE') THEN
        RAISE EXCEPTION 'march identity: schema ownership/privileges mismatch';
    END IF;

    -- Lock and recheck the three reviewed tables. This file never rewrites rows.
    FOREACH table_name IN ARRAY ARRAY['march_order', 'field_army', 'battle_report'] LOOP
        SELECT c.oid INTO tbl FROM pg_catalog.pg_class c
            WHERE c.relnamespace = namespace_id AND c.relname = table_name;
        IF tbl IS NULL THEN
            RAISE EXCEPTION 'march identity: missing schema-local %', table_name;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_class c JOIN pg_catalog.pg_am a ON a.oid = c.relam
            WHERE c.oid = tbl AND c.relnamespace = namespace_id AND c.relname = table_name
                AND c.relkind = 'r' AND c.relpersistence = 'p' AND c.relowner = owner_id
                AND a.amname = 'heap' AND c.reloftype = 0 AND NOT c.relispartition
                AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity)
           OR EXISTS (SELECT FROM pg_catalog.pg_inherits WHERE inhrelid = tbl OR inhparent = tbl)
           OR EXISTS (SELECT FROM pg_catalog.pg_policy WHERE polrelid = tbl)
           OR EXISTS (SELECT FROM pg_catalog.pg_rewrite WHERE ev_class = tbl)
           OR NOT pg_catalog.has_table_privilege(tbl, 'SELECT') THEN
            RAISE EXCEPTION 'march identity: incompatible % ownership/metadata', table_name;
        END IF;
        EXECUTE pg_catalog.format('LOCK TABLE ONLY %I.%I IN SHARE ROW EXCLUSIVE MODE', ns, table_name);
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_class c
            WHERE c.oid = tbl AND c.relnamespace = namespace_id AND c.relname = table_name
                AND c.relkind = 'r' AND c.relpersistence = 'p' AND c.relowner = owner_id) THEN
            RAISE EXCEPTION 'march identity: % changed during lock', table_name;
        END IF;
    END LOOP;

    -- The reviewed tables must keep their identity columns; a same-name decoy in
    -- another schema must not become the ALTER target.
    IF EXISTS (SELECT FROM (VALUES
            ('march_order', 'server_id', 'int4'), ('march_order', 'march_id', 'int8'),
            ('march_order', 'army_id', 'int8'), ('march_order', 'status', 'int2'),
            ('march_order', 'depart_at', 'timestamptz'), ('march_order', 'arrive_at', 'timestamptz'),
            ('field_army', 'server_id', 'int4'), ('field_army', 'army_id', 'int8'),
            ('field_army', 'owner_player_id', 'int8'), ('field_army', 'status', 'int2'),
            ('field_army', 'hero_ids', 'int8[]'),
            ('battle_report', 'server_id', 'int4'), ('battle_report', 'report_id', 'int8')
        ) AS req(t, c, tp)
        WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            WHERE c.relnamespace = namespace_id AND c.relname = req.t
                AND a.attname = req.c AND a.atttypid = req.tp::pg_catalog.regtype
                AND a.attnum > 0 AND NOT a.attisdropped)) THEN
        RAISE EXCEPTION 'march identity: incompatible reviewed table columns';
    END IF;

    -- Additive, nullable-only columns. No NOT NULL, DEFAULT or backfill.
    EXECUTE pg_catalog.format(
        'ALTER TABLE %I.march_order ADD COLUMN IF NOT EXISTS origin_city_id BIGINT', ns);
    EXECUTE pg_catalog.format(
        'ALTER TABLE %I.march_order ADD COLUMN IF NOT EXISTS return_finish_at TIMESTAMPTZ', ns);
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = pg_catalog.to_regclass(pg_catalog.format('%I.march_order', ns))
            AND a.attname = 'origin_city_id' AND a.atttypid = 'int8'::pg_catalog.regtype
            AND a.attnum > 0 AND NOT a.attisdropped AND NOT a.attnotnull AND NOT a.atthasdef
            AND a.atttypmod = -1 AND a.attndims = 0 AND a.attidentity = '' AND a.attgenerated = ''
            AND a.attislocal AND a.attinhcount = 0)
       OR NOT EXISTS (SELECT FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = pg_catalog.to_regclass(pg_catalog.format('%I.march_order', ns))
            AND a.attname = 'return_finish_at' AND a.atttypid = 'timestamptz'::pg_catalog.regtype
            AND a.attnum > 0 AND NOT a.attisdropped AND NOT a.attnotnull AND NOT a.atthasdef
            AND a.atttypmod = -1 AND a.attndims = 0 AND a.attidentity = '' AND a.attgenerated = ''
            AND a.attislocal AND a.attinhcount = 0) THEN
        RAISE EXCEPTION 'march identity: incompatible added columns';
    END IF;

    -- Freeze the ownership/return deadlines and the SQL phase vocabulary.
    EXECUTE pg_catalog.format('COMMENT ON COLUMN %I.march_order.origin_city_id IS %L', ns,
        'Departure city ID for return settlement; nullable until a reviewed audit proves every row attributable. No FK (SPEC-001 logical references).');
    EXECUTE pg_catalog.format('COMMENT ON COLUMN %I.march_order.return_finish_at IS %L', ns,
        'Expected home-return deadline while status=3 (returning); zero/NULL otherwise. Durable source for restore, not inferred from arrive_at.');
    EXECUTE pg_catalog.format('COMMENT ON COLUMN %I.march_order.status IS %L', ns,
        'March lifecycle: 1=marching; 2=arrived (reserved for reinforce/unknown; the first slice does not write it); 3=returning; 4=returned. CONTRACT CHANGE: 3 was previously documented as 撤回/withdrawn and had no writer, so 3 is now returning, not a silent reinterpretation.');

    -- Return-deadline scan; the existing idx_march_arrive covers only status=1.
    EXECUTE pg_catalog.format(
        'CREATE INDEX IF NOT EXISTS idx_march_return ON %I.march_order '
        '(server_id, status, return_finish_at) WHERE status = 3', ns);
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_index x
        JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid
        JOIN pg_catalog.pg_class t ON t.oid = x.indrelid
        WHERE t.relnamespace = namespace_id AND t.relname = 'march_order'
            AND i.relnamespace = namespace_id AND i.relname = 'idx_march_return'
            AND i.relkind = 'i' AND i.relpersistence = 'p' AND i.relowner = owner_id
            AND x.indisvalid AND x.indisready AND x.indislive
            AND NOT x.indisunique AND NOT x.indisexclusion AND x.indpred IS NOT NULL
            AND x.indexprs IS NULL AND x.indnkeyatts = 3 AND x.indnatts = 3
            AND (SELECT pg_catalog.array_agg(a.attname::pg_catalog.text ORDER BY k.ord)
                FROM pg_catalog.unnest(x.indkey::pg_catalog.int2[]) WITH ORDINALITY k(attnum, ord)
                JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum)
                = ARRAY['server_id', 'status', 'return_finish_at']
            AND pg_catalog.regexp_replace(pg_catalog.regexp_replace(
                pg_catalog.pg_get_expr(x.indpred, x.indrelid),
                '::(smallint|integer|bigint)', '', 'g'), '[()[:space:]]', '', 'g') = 'status=3') THEN
        RAISE EXCEPTION 'march identity: incompatible idx_march_return';
    END IF;

    -- Durable, explicitly allocated identities. No column default is added.
    FOREACH seq_name IN ARRAY ARRAY['march_order_march_id_seq',
        'field_army_army_id_seq', 'battle_report_report_id_seq'] LOOP
        SELECT c.oid INTO seq FROM pg_catalog.pg_class c
            WHERE c.relnamespace = namespace_id AND c.relname = seq_name;
        IF seq IS NULL THEN
            EXECUTE pg_catalog.format('CREATE SEQUENCE %I.%I AS bigint INCREMENT 1 MINVALUE 1 '
                'MAXVALUE 9007199254740991 START 1 CACHE 1 NO CYCLE OWNED BY NONE', ns, seq_name);
            SELECT c.oid INTO seq FROM pg_catalog.pg_class c
                WHERE c.relnamespace = namespace_id AND c.relname = seq_name;
        END IF;
        IF seq IS NULL OR NOT EXISTS (SELECT FROM pg_catalog.pg_class c
            WHERE c.oid = seq AND c.relnamespace = namespace_id AND c.relname = seq_name
                AND c.relkind = 'S' AND c.relpersistence = 'p' AND c.relowner = owner_id)
           OR EXISTS (SELECT FROM pg_catalog.pg_depend
                WHERE classid = 'pg_catalog.pg_class'::pg_catalog.regclass
                    AND objid = seq AND deptype IN ('a', 'i', 'e'))
           OR NOT pg_catalog.has_sequence_privilege(seq, 'SELECT')
           OR NOT pg_catalog.has_sequence_privilege(seq, 'UPDATE')
           OR NOT pg_catalog.has_sequence_privilege(seq, 'USAGE') THEN
            RAISE EXCEPTION 'march identity: incompatible % ownership/object', seq_name;
        END IF;
        SELECT * INTO STRICT cfg FROM pg_catalog.pg_sequence WHERE seqrelid = seq;
        IF cfg.seqtypid <> 'int8'::pg_catalog.regtype OR cfg.seqincrement <> 1
           OR cfg.seqcycle OR cfg.seqmin <> 1 OR cfg.seqmax <> ceiling
           OR cfg.seqcache <> 1 OR cfg.seqstart <> 1 THEN
            RAISE EXCEPTION 'march identity: incompatible % configuration', seq_name;
        END IF;
        EXECUTE pg_catalog.format('SELECT last_value, is_called FROM %I.%I', ns, seq_name)
            INTO last_id, called;
        IF last_id < 1 OR last_id > ceiling OR (last_id = ceiling AND called) THEN
            RAISE EXCEPTION 'march identity: % exhausted/invalid', seq_name;
        END IF;
        -- No setval here: a downstream writer audits and fails closed if a
        -- persisted ID is at or above last_value. Advancing is not this file's job.
    END LOOP;

    -- Runtime resolution must not fall back to another schema or a temp decoy.
    PERFORM pg_catalog.set_config('search_path', runtime_path, true);
    FOREACH table_name IN ARRAY ARRAY['march_order', 'field_army', 'battle_report'] LOOP
        IF pg_catalog.to_regclass(table_name) IS DISTINCT FROM
           (SELECT c.oid FROM pg_catalog.pg_class c
                WHERE c.relnamespace = namespace_id AND c.relname = table_name) THEN
            RAISE EXCEPTION 'march identity: shadowed runtime table %', table_name;
        END IF;
    END LOOP;
    FOREACH seq_name IN ARRAY ARRAY['march_order_march_id_seq',
        'field_army_army_id_seq', 'battle_report_report_id_seq'] LOOP
        IF pg_catalog.to_regclass(seq_name) IS DISTINCT FROM
           (SELECT c.oid FROM pg_catalog.pg_class c
                WHERE c.relnamespace = namespace_id AND c.relname = seq_name) THEN
            RAISE EXCEPTION 'march identity: shadowed runtime sequence %', seq_name;
        END IF;
    END LOOP;
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
END
$march_identity$;
