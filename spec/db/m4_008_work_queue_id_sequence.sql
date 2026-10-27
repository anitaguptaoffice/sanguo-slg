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
    origin_id pg_catalog.oid;
    receipt_id pg_catalog.oid;
    recruit_id pg_catalog.oid;
    definitions pg_catalog.text[];
    expected_definitions pg_catalog.text[];
    fk record;
    corrupt pg_catalog.bool;
    runtime_timezone pg_catalog.text := pg_catalog.current_setting('TimeZone');
    runtime_datestyle pg_catalog.text := pg_catalog.current_setting('DateStyle');
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
    -- SPEC-RECRUIT-ALLOCATOR-GUARD-001: recognize only the reviewed physical pair.
    -- This body is skipped by an existing filename ledger; not an upgrade hook.
    SELECT oid INTO origin_id FROM pg_class WHERE relnamespace = namespace_id AND relname = 'mil_recruit_origin';
    SELECT oid INTO receipt_id FROM pg_class WHERE relnamespace = namespace_id AND relname = 'mil_recruit_receipt';
    IF (origin_id IS NULL) <> (receipt_id IS NULL) THEN
        RAISE EXCEPTION 'queue identity: partial recruit storage';
    END IF;
    IF origin_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT FROM pg_class WHERE relnamespace = namespace_id
            AND relname = 'work_queue_id_seq' AND relkind = 'S') THEN
            RAISE EXCEPTION 'queue identity: recruit storage requires existing sequence';
        END IF;
        -- Reject non-tables before LOCK; revalidate exact identities after locks.
        IF (SELECT count(*) FROM pg_class WHERE oid IN (origin_id,receipt_id) AND relkind = 'r') <> 2 THEN
            RAISE EXCEPTION 'queue identity: incompatible recruit relations';
        END IF;
        EXECUTE format('LOCK TABLE ONLY %I.mil_recruit_origin, ONLY %I.mil_recruit_receipt IN SHARE ROW EXCLUSIVE MODE', ns, ns);
        PERFORM set_config('TimeZone', 'UTC', true);
        PERFORM set_config('DateStyle', 'ISO, YMD', true);
        FOREACH recruit_id IN ARRAY ARRAY[origin_id,receipt_id] LOOP
            IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_am a ON a.oid = c.relam
                WHERE c.oid = recruit_id AND c.relnamespace = namespace_id
                AND c.relname = CASE WHEN recruit_id = origin_id THEN 'mil_recruit_origin' ELSE 'mil_recruit_receipt' END
                AND c.relkind = 'r' AND c.relpersistence = 'p' AND c.relowner = owner_id
                AND a.amname = 'heap' AND c.reloftype = 0 AND NOT c.relispartition
                AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity)
                OR EXISTS (SELECT FROM pg_inherits WHERE inhrelid = recruit_id OR inhparent = recruit_id)
                OR EXISTS (SELECT FROM pg_policy WHERE polrelid = recruit_id)
                OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class = recruit_id)
                OR NOT has_table_privilege(recruit_id, 'SELECT') THEN
                RAISE EXCEPTION 'queue identity: incompatible recruit ownership/metadata';
            END IF;
            SELECT array_agg(attname::text ORDER BY attnum) names,
                array_agg(atttypid ORDER BY attnum) types INTO cfg
                FROM pg_attribute WHERE attrelid = recruit_id AND attnum > 0;
            IF cfg.names IS DISTINCT FROM (CASE WHEN recruit_id = origin_id
                THEN ARRAY['server_id','queue_id','player_id','operation','command_id']
                ELSE ARRAY['server_id','queue_id','intent_version','city_id','unit_cfg_id','count','food_paid','wood_paid',
                    'iron_paid','stone_paid','duration_sec','catalog_version','rule_digest','accepted_at',
                    'initial_start_at','initial_finish_at','initial_status'] END)
                OR cfg.types IS DISTINCT FROM (CASE WHEN recruit_id = origin_id
                THEN ARRAY['int4'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid,'int2'::regtype::oid,'bytea'::regtype::oid]
                ELSE ARRAY['int4'::regtype::oid,'int8'::regtype::oid,'int2'::regtype::oid,'int8'::regtype::oid,
                    'int4'::regtype::oid,'int4'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid,
                    'int8'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid,'bytea'::regtype::oid,
                    'bytea'::regtype::oid,'timestamptz'::regtype::oid,'timestamptz'::regtype::oid,
                    'timestamptz'::regtype::oid,'int2'::regtype::oid] END)
                OR EXISTS (SELECT FROM pg_attribute WHERE attrelid = recruit_id AND attnum > 0
                    AND (NOT attnotnull OR attisdropped OR attidentity <> '' OR attgenerated <> '' OR atttypmod <> -1
                        OR attndims <> 0 OR attcollation <> 0 OR NOT attislocal OR attinhcount <> 0))
                OR EXISTS (SELECT FROM pg_attrdef WHERE adrelid = recruit_id) THEN
                RAISE EXCEPTION 'queue identity: incompatible recruit columns';
            END IF;
            -- Static reviewed PostgreSQL 17 definitions, never a mutable DB template.
            SELECT array_agg(pg_get_constraintdef(oid) ORDER BY pg_get_constraintdef(oid)) INTO definitions
                FROM pg_constraint WHERE conrelid = recruit_id;
            SELECT array_agg(value ORDER BY value) INTO expected_definitions FROM unnest(
                CASE WHEN recruit_id = origin_id THEN ARRAY[
                    'PRIMARY KEY (server_id, queue_id)', 'UNIQUE (server_id, player_id, operation, command_id)',
                    'CHECK (((queue_id >= 1) AND (queue_id <= ''9007199254740991''::bigint)))',
                    'CHECK ((operation = 1))',
                    'CHECK (((octet_length(command_id) = 16) AND (command_id <> decode(repeat(''00''::text, 16), ''hex''::text))))']
                ELSE ARRAY[
                    'PRIMARY KEY (server_id, queue_id)',
                    format('FOREIGN KEY (server_id, queue_id) REFERENCES %I.mil_recruit_origin(server_id, queue_id) ON UPDATE RESTRICT ON DELETE RESTRICT',ns),
                    'CHECK (((queue_id >= 1) AND (queue_id <= ''9007199254740991''::bigint)))',
                    'CHECK ((intent_version = 1))', 'CHECK (((unit_cfg_id >= 1) AND (unit_cfg_id <= 4)))',
                    'CHECK ((count > 0))', 'CHECK ((food_paid >= 0))', 'CHECK ((wood_paid >= 0))',
                    'CHECK ((iron_paid >= 0))', 'CHECK ((stone_paid >= 0))', 'CHECK ((duration_sec > 0))',
                    'CHECK ((octet_length(catalog_version) > 0))', 'CHECK ((octet_length(rule_digest) = 32))',
                    'CHECK ((initial_status = ANY (ARRAY[0, 1])))',
                    'CHECK ((isfinite(accepted_at) AND (accepted_at >= ''0001-01-01 00:00:00+00''::timestamp with time zone) AND (accepted_at < ''10000-01-01 00:00:00+00''::timestamp with time zone) AND (date_trunc(''milliseconds''::text, accepted_at) = accepted_at)))',
                    'CHECK ((isfinite(initial_start_at) AND (initial_start_at >= ''0001-01-01 00:00:00+00''::timestamp with time zone) AND (initial_start_at < ''10000-01-01 00:00:00+00''::timestamp with time zone) AND (date_trunc(''milliseconds''::text, initial_start_at) = initial_start_at)))',
                    'CHECK ((isfinite(initial_finish_at) AND (initial_finish_at >= ''0001-01-01 00:00:00+00''::timestamp with time zone) AND (initial_finish_at < ''10000-01-01 00:00:00+00''::timestamp with time zone) AND (date_trunc(''milliseconds''::text, initial_finish_at) = initial_finish_at)))'] END) value;
            IF definitions IS DISTINCT FROM expected_definitions
                OR EXISTS (SELECT FROM pg_constraint WHERE conrelid = recruit_id AND
                    (condeferrable OR condeferred OR NOT convalidated OR NOT conislocal OR coninhcount <> 0
                     OR connamespace <> namespace_id OR (contype = 'c' AND connoinherit) OR conparentid <> 0)) THEN
                RAISE EXCEPTION 'queue identity: incompatible recruit constraints';
            END IF;
            IF (SELECT count(*) FROM pg_index WHERE indrelid = recruit_id) <> (CASE WHEN recruit_id = origin_id THEN 2 ELSE 1 END) THEN
                RAISE EXCEPTION 'queue identity: unexpected recruit index';
            END IF;
            FOR pk IN SELECT * FROM pg_constraint WHERE conrelid = recruit_id AND contype IN ('p','u') LOOP
                IF NOT EXISTS (SELECT FROM pg_index x JOIN pg_class c ON c.oid = x.indexrelid JOIN pg_am a ON a.oid = c.relam
                    WHERE x.indexrelid = pk.conindid AND x.indrelid = recruit_id AND c.relnamespace = namespace_id
                    AND c.relowner = owner_id AND c.relkind = 'i' AND c.relpersistence = 'p' AND a.amname = 'btree'
                    AND x.indisprimary = (pk.contype = 'p') AND x.indisunique AND x.indimmediate
                    AND x.indisvalid AND x.indisready AND x.indislive AND NOT x.indisexclusion
                    AND NOT x.indnullsnotdistinct AND x.indpred IS NULL AND x.indexprs IS NULL
                    AND x.indnkeyatts = cardinality(pk.conkey) AND x.indnatts = cardinality(pk.conkey)
                    AND ARRAY(SELECT unnest(x.indkey::smallint[])) = pk.conkey
                    AND NOT EXISTS (SELECT FROM unnest(x.indclass::oid[]) WITH ORDINALITY op(id,n)
                        JOIN pg_opclass oc ON oc.oid = op.id
                        JOIN pg_attribute att ON att.attrelid = recruit_id AND att.attnum = pk.conkey[op.n::integer]
                        WHERE NOT oc.opcdefault OR oc.opcintype <> att.atttypid OR oc.opcnamespace <> 'pg_catalog'::regnamespace)
                    AND NOT EXISTS (SELECT FROM unnest(x.indoption::smallint[]) opt WHERE opt <> 0)
                    AND NOT EXISTS (SELECT FROM unnest(x.indcollation::oid[]) coll WHERE coll <> 0)) THEN
                    RAISE EXCEPTION 'queue identity: incompatible recruit index';
                END IF;
            END LOOP;
        END LOOP;
        SELECT * INTO STRICT fk FROM pg_constraint WHERE conrelid = receipt_id AND contype = 'f';
        IF fk.confrelid <> origin_id OR fk.conkey <> ARRAY[1,2]::smallint[] OR fk.confkey <> ARRAY[1,2]::smallint[]
            OR fk.confupdtype <> 'r' OR fk.confdeltype <> 'r' OR fk.confmatchtype <> 's'
            OR (SELECT count(*) FROM pg_trigger WHERE tgrelid IN (origin_id,receipt_id)) <> 4
            OR EXISTS (SELECT FROM pg_trigger WHERE tgrelid IN (origin_id,receipt_id) AND
                (NOT tgisinternal OR tgconstraint <> fk.oid OR tgenabled <> 'O' OR tgdeferrable OR tginitdeferred
                OR tgnargs <> 0 OR octet_length(tgargs) <> 0 OR tgqual IS NOT NULL OR tgattr::text <> ''
                OR tgparentid <> 0 OR tgoldtable IS NOT NULL OR tgnewtable IS NOT NULL
                OR NOT ((tgrelid = origin_id AND tgconstrrelid = receipt_id AND
                    ((tgfoid = 'pg_catalog."RI_FKey_restrict_del"'::regproc AND tgtype = 9)
                    OR (tgfoid = 'pg_catalog."RI_FKey_restrict_upd"'::regproc AND tgtype = 17)))
                OR (tgrelid = receipt_id AND tgconstrrelid = origin_id AND
                    ((tgfoid = 'pg_catalog."RI_FKey_check_ins"'::regproc AND tgtype = 5)
                    OR (tgfoid = 'pg_catalog."RI_FKey_check_upd"'::regproc AND tgtype = 17)))))) THEN
            RAISE EXCEPTION 'queue identity: incompatible recruit FK/triggers';
        END IF;
        EXECUTE format('SELECT EXISTS (SELECT FROM %1$I.mil_recruit_receipt r LEFT JOIN %1$I.mil_recruit_origin o '
            'USING (server_id,queue_id) WHERE o.queue_id IS NULL) OR EXISTS '
            '(SELECT queue_id FROM %1$I.mil_recruit_origin GROUP BY queue_id HAVING count(*) > 1) OR EXISTS '
            '(SELECT FROM %1$I.mil_recruit_origin o JOIN %1$I.work_queue q USING (queue_id) '
            'WHERE q.server_id <> o.server_id OR q.player_id <> o.player_id OR q.queue_type <> 3) OR EXISTS '
            '(SELECT FROM %1$I.mil_recruit_receipt r JOIN %1$I.work_queue q USING (queue_id) '
            'WHERE q.server_id <> r.server_id OR q.city_id IS DISTINCT FROM r.city_id)', ns) INTO corrupt;
        IF corrupt THEN RAISE EXCEPTION 'queue identity: corrupt recruit identity'; END IF;
        -- Retained origin-only IDs still reserve the namespace; this is not an activation audit.
        EXECUTE format('SELECT min(queue_id),max(queue_id) FROM (SELECT queue_id FROM %1$I.mil_recruit_origin '
            'UNION ALL SELECT queue_id FROM %1$I.mil_recruit_receipt) ids',ns) INTO found_min,found_max;
        IF found_min <= 0 OR found_max > ceiling THEN RAISE EXCEPTION 'queue identity: invalid recruit ID'; END IF;
        highwater := greatest(highwater,COALESCE(found_max,0));
        PERFORM set_config('TimeZone', runtime_timezone, true);
        PERFORM set_config('DateStyle', runtime_datestyle, true);
    END IF;
    IF EXISTS (SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relnamespace = namespace_id AND c.relkind IN ('r','p','v','m','f')
        AND NOT a.attisdropped AND a.attname IN ('queue_id','queue_ids')
        AND (c.oid, a.attname) <> (obj, 'queue_id')
        AND NOT (origin_id IS NOT NULL AND c.oid IN (origin_id,receipt_id) AND a.attname = 'queue_id')) THEN
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
