-- SPEC-QUEUE-ID: maintenance only; see ../rules/queue_identity.md.
-- Fence/drain every old queue writer, allocator client and concurrent DDL first.
-- Atomic body; ApplySpecs records its ledger separately. No runtime provisioning.
DO $queue_identity$
DECLARE
    ns pg_catalog.text := pg_catalog.current_schema();
    runtime_path pg_catalog.text := pg_catalog.current_setting('search_path');
    namespace_id pg_catalog.oid;
    owner_id pg_catalog.oid;
    obj pg_catalog.oid;
    seq pg_catalog.oid;
    cfg record;
    pk record;
    highwater pg_catalog.int8;
    found_max pg_catalog.int8;
    found_min pg_catalog.int8;
    last_id pg_catalog.int8;
    called pg_catalog.bool;
    ceiling CONSTANT pg_catalog.int8 := 9007199254740991;
BEGIN
    -- Explicitly put pg_temp last: otherwise its relations precede pg_catalog.
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    PERFORM pg_catalog.set_config('row_security', 'off', true);
    highwater := COALESCE(NULLIF(current_setting('sanguo.queue_id_retained_highwater', true), ''), '0')::bigint;
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR ns = 'information_schema'
       OR highwater < 0 OR highwater > ceiling THEN
        RAISE EXCEPTION 'queue identity: invalid schema/retained highwater';
    END IF;
    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'queue identity: requires READ COMMITTED';
    END IF;
    SELECT oid INTO STRICT owner_id FROM pg_roles WHERE rolname = current_user;
    SELECT oid INTO STRICT namespace_id FROM pg_namespace WHERE nspname = ns;
    IF NOT EXISTS (SELECT FROM pg_namespace WHERE oid = namespace_id AND (nspowner = owner_id
        OR (ns = 'public' AND nspowner = 'pg_database_owner'::regrole
            AND EXISTS (SELECT FROM pg_database WHERE datname = current_database() AND datdba = owner_id))))
       OR NOT has_schema_privilege(namespace_id, 'USAGE') OR NOT has_schema_privilege(namespace_id, 'CREATE') THEN
        RAISE EXCEPTION 'queue identity: schema ownership/privileges mismatch';
    END IF;
    SELECT oid INTO obj FROM pg_class WHERE relnamespace = namespace_id AND relname = 'work_queue';
    IF obj IS NULL THEN
        RAISE EXCEPTION 'queue identity: missing schema-local work_queue';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class WHERE oid = obj AND relkind = 'r') THEN
        RAISE EXCEPTION 'queue identity: incompatible work_queue relation';
    END IF;
    EXECUTE format('LOCK TABLE ONLY %I.work_queue IN SHARE ROW EXCLUSIVE MODE', ns);
    -- Recheck after the lock; never scan an inherited, hidden, temporary or foreign source.
    IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_am a ON a.oid = c.relam
        WHERE c.oid = obj AND c.relnamespace = namespace_id AND c.relname = 'work_queue'
        AND c.relkind = 'r' AND c.relpersistence = 'p' AND c.relowner = owner_id
        AND a.amname = 'heap' AND c.reloftype = 0 AND NOT c.relispartition
        AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity)
       OR EXISTS (SELECT FROM pg_inherits WHERE inhrelid = obj OR inhparent = obj)
       OR EXISTS (SELECT FROM pg_trigger WHERE tgrelid = obj)
       OR EXISTS (SELECT FROM pg_policy WHERE polrelid = obj)
       OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class = obj)
       OR NOT has_table_privilege(obj, 'SELECT') THEN
        RAISE EXCEPTION 'queue identity: incompatible work_queue ownership/metadata';
    END IF;
    SELECT array_agg(a.attname::text ORDER BY a.attnum) names,
        array_agg(a.atttypid ORDER BY a.attnum) types,
        array_agg(a.attnotnull ORDER BY a.attnum) nulls,
        array_agg(pg_get_expr(d.adbin,d.adrelid) ORDER BY a.attnum) defaults
        INTO cfg FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = obj AND a.attnum > 0;
    IF cfg.names IS DISTINCT FROM ARRAY['server_id','queue_id','player_id','city_id','queue_type','payload','start_at','finish_at','status']
       OR cfg.types IS DISTINCT FROM ARRAY['int4'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid,
           'int2'::regtype::oid,'jsonb'::regtype::oid,'timestamptz'::regtype::oid,'timestamptz'::regtype::oid,'int2'::regtype::oid]
       OR cfg.nulls IS DISTINCT FROM ARRAY[true,true,true,false,true,true,true,true,true]
       OR cfg.defaults IS DISTINCT FROM ARRAY[NULL,NULL,NULL,NULL,NULL,'''{}''::jsonb',NULL,NULL,'0']::text[]
       OR EXISTS (SELECT FROM pg_attribute WHERE attrelid = obj AND attnum > 0
           AND (attisdropped OR attidentity <> '' OR attgenerated <> '' OR atttypmod <> -1
               OR attndims <> 0 OR attcollation <> 0 OR NOT attislocal OR attinhcount <> 0)) THEN
        RAISE EXCEPTION 'queue identity: incompatible work_queue columns/defaults';
    END IF;
    SELECT * INTO pk FROM pg_constraint WHERE conrelid = obj AND contype = 'p';
    IF NOT FOUND OR pk.conkey IS DISTINCT FROM ARRAY[1,2]::smallint[] OR pk.condeferrable OR pk.condeferred
       OR NOT pk.convalidated OR NOT pk.conislocal OR pk.coninhcount <> 0 OR pk.connamespace <> namespace_id
       OR (SELECT count(*) FROM pg_constraint WHERE conrelid = obj) <> 1
       OR NOT EXISTS (SELECT FROM pg_index x JOIN pg_class c ON c.oid = x.indexrelid JOIN pg_am a ON a.oid = c.relam
           WHERE x.indexrelid = pk.conindid AND x.indrelid = obj AND c.relnamespace = namespace_id
           AND c.relkind = 'i' AND c.relpersistence = 'p' AND a.amname = 'btree'
           AND x.indisprimary AND x.indisunique AND x.indimmediate AND x.indisvalid AND x.indisready AND x.indislive
           AND NOT x.indisexclusion AND NOT x.indnullsnotdistinct AND x.indpred IS NULL AND x.indexprs IS NULL
           AND x.indnkeyatts = 2 AND x.indnatts = 2 AND x.indkey::text = '1 2'
           AND NOT EXISTS (SELECT FROM unnest(x.indclass::oid[]) WITH ORDINALITY op(id,n)
               JOIN pg_opclass oc ON oc.oid = op.id WHERE NOT oc.opcdefault
               OR oc.opcintype <> (ARRAY['int4'::regtype::oid,'int8'::regtype::oid])[op.n::integer]
               OR oc.opcnamespace <> 'pg_catalog'::regnamespace)
           AND NOT EXISTS (SELECT FROM unnest(x.indoption::smallint[]) opt WHERE opt <> 0)
           AND NOT EXISTS (SELECT FROM unnest(x.indcollation::oid[]) coll WHERE coll <> 0)) THEN
        RAISE EXCEPTION 'queue identity: incompatible work_queue primary key';
    END IF;
    IF EXISTS (SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relnamespace = namespace_id AND c.relkind IN ('r','p','v','m','f')
        AND NOT a.attisdropped AND a.attname IN ('queue_id','queue_ids')
        AND (c.oid, a.attname) <> (obj, 'queue_id')) THEN
        RAISE EXCEPTION 'queue identity: unreviewed queue reference';
    END IF;
    EXECUTE format('SELECT min(queue_id), max(queue_id) FROM %I.work_queue', ns) INTO found_min, found_max;
    IF found_min <= 0 OR found_max > ceiling THEN
        RAISE EXCEPTION 'queue identity: invalid retained row ID';
    END IF;
    highwater := greatest(highwater, COALESCE(found_max, 0));
    IF highwater = ceiling THEN
        RAISE EXCEPTION 'queue identity: retained namespace exhausted';
    END IF;
    SELECT oid INTO seq FROM pg_class WHERE relnamespace = namespace_id AND relname = 'work_queue_id_seq';
    IF seq IS NULL THEN
        EXECUTE format('CREATE SEQUENCE %I.work_queue_id_seq AS bigint INCREMENT 1 MINVALUE 1 '
            'MAXVALUE 9007199254740991 START 1 CACHE 1 NO CYCLE OWNED BY NONE', ns);
        SELECT oid INTO STRICT seq FROM pg_class WHERE relnamespace = namespace_id AND relname = 'work_queue_id_seq';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class WHERE oid = seq AND relkind = 'S' AND relpersistence = 'p' AND relowner = owner_id)
       OR EXISTS (SELECT FROM pg_depend WHERE classid = 'pg_class'::regclass AND objid = seq AND deptype IN ('a','i','e'))
       OR NOT has_sequence_privilege(seq, 'SELECT') OR NOT has_sequence_privilege(seq, 'UPDATE')
       OR NOT has_sequence_privilege(seq, 'USAGE') THEN
        RAISE EXCEPTION 'queue identity: incompatible sequence ownership/object';
    END IF;
    SELECT * INTO STRICT cfg FROM pg_sequence WHERE seqrelid = seq;
    IF cfg.seqtypid <> 'int8'::regtype OR cfg.seqincrement <> 1 OR cfg.seqcycle OR cfg.seqmin <> 1
       OR cfg.seqmax <> ceiling OR cfg.seqcache <> 1 OR cfg.seqstart <> 1 THEN
        RAISE EXCEPTION 'queue identity: incompatible sequence configuration';
    END IF;
    EXECUTE format('SELECT last_value, is_called FROM %I.work_queue_id_seq', ns) INTO last_id, called;
    IF last_id < 1 OR last_id > ceiling OR (last_id = ceiling AND called) THEN
        RAISE EXCEPTION 'queue identity: sequence exhausted/invalid';
    END IF;
    PERFORM pg_catalog.set_config('search_path', runtime_path, true);
    IF NOT COALESCE(pg_catalog.to_regclass('work_queue')::pg_catalog.oid OPERATOR(pg_catalog.=) obj, false)
       OR NOT COALESCE(pg_catalog.to_regclass('work_queue_id_seq')::pg_catalog.oid OPERATOR(pg_catalog.=) seq, false) THEN
        RAISE EXCEPTION 'queue identity: shadowed runtime relation';
    END IF;
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    -- setval does not roll back. Validate everything first and only move forward, last.
    IF highwater > last_id OR (highwater = last_id AND NOT called) THEN
        PERFORM setval(seq::regclass, highwater, true);
    END IF;
END
$queue_identity$;
