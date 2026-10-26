-- SPEC-HERO-METADATA: existing-shape provisioning only; see hero_metadata.md.
-- One externally serialized owner, drained affected readers/writers, bounded runner timeouts.
-- The body is atomic; ApplySpecs records its ledger entry in a separate statement.
DO $metadata$
DECLARE
    ns text := pg_catalog.current_schema();
    runtime_path text := pg_catalog.current_setting('search_path');
    validate_only boolean := COALESCE(NULLIF(pg_catalog.current_setting(
        'sanguo.hero_metadata_validate_only', true), ''), 'false')::boolean;
    names text[] := ARRAY['player_hero_coming','player_hero_captive','player_hero_lionize'];
    definitions text[] := ARRAY[
        'server_id INT NOT NULL, hero_id BIGINT NOT NULL, city_id BIGINT NOT NULL, PRIMARY KEY(server_id,hero_id)',
        'server_id INT NOT NULL, hero_id BIGINT NOT NULL, city_id BIGINT NOT NULL, summon_item_cfg_id INT NOT NULL DEFAULT 0, summon_item_qty INT NOT NULL DEFAULT 0, PRIMARY KEY(server_id,hero_id)',
        'server_id INT NOT NULL, player_id BIGINT NOT NULL, npc_cfg_id INT NOT NULL, friend INT NOT NULL DEFAULT 0, state SMALLINT NOT NULL DEFAULT 0, last_persuade_at TIMESTAMPTZ, PRIMARY KEY(server_id,player_id,npc_cfg_id)'];
    comments text[] := ARRAY[
        '来投元数据；对齐 legacy sys_city_hero.state=6 待接受队列',
        '俘虏元数据；对齐 legacy sys_hero_captive + mem_hero_summon',
        '名将结交/游说；对齐 legacy sys_lionize (uid,npcid,friend,state)'];
    obj oid;
    namespace_id oid;
    pk record;
    expected_names text[];
    expected_types oid[];
    expected_nulls boolean[];
    expected_defaults text[];
    expected_key smallint[];
    col_names text[];
    col_types oid[];
    col_nulls boolean[];
    col_defaults text[];
    pass integer;
    i integer;
BEGIN
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR ns = 'information_schema' THEN
        RAISE EXCEPTION 'hero metadata: invalid target schema';
    END IF;
    IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'hero metadata: requires READ COMMITTED';
    END IF;
    -- Explicit namespace lookup, never later-search-path adoption (including pg_temp).
    -- Explicit pg_temp last prevents temporary relations from shadowing catalogs.
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    SELECT oid INTO STRICT namespace_id FROM pg_namespace WHERE nspname = ns;
    -- Pass 1 validates/locks EVERY existing object before any create. Pass 2 creates
    -- only absent objects then validates the complete result with the same checks.
    FOR pass IN 1..2 LOOP
        FOR i IN 1..3 LOOP
            SELECT oid INTO obj FROM pg_class
                WHERE relnamespace = namespace_id AND relname = names[i];
            IF obj IS NULL THEN
                IF validate_only THEN
                    RAISE EXCEPTION 'hero metadata: missing %.%', ns, names[i];
                ELSIF pass = 1 THEN
                    CONTINUE;
                END IF;
                EXECUTE format('CREATE TABLE %I.%I (%s)', ns, names[i], definitions[i]);
                EXECUTE format('COMMENT ON TABLE %I.%I IS %L', ns, names[i], comments[i]);
                SELECT oid INTO STRICT obj FROM pg_class
                    WHERE relnamespace = namespace_id AND relname = names[i];
            END IF;
            IF NOT EXISTS (SELECT FROM pg_class WHERE oid = obj AND relkind = 'r') THEN
                RAISE EXCEPTION 'hero metadata: incompatible relation %.%', ns, names[i];
            END IF;
            EXECUTE format('LOCK TABLE ONLY %I.%I IN %s MODE', ns, names[i],
                CASE WHEN validate_only THEN 'ACCESS SHARE' ELSE 'ACCESS EXCLUSIVE' END);
            -- Recheck catalog shape after lock acquisition, not a stale pre-lock observation.
            IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_am am ON am.oid = c.relam
                WHERE c.oid = obj AND c.relnamespace = namespace_id AND c.relname = names[i]
                AND c.relkind = 'r' AND c.relpersistence = 'p'
                AND am.amname = 'heap' AND c.reloftype = 0 AND NOT c.relispartition
                AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity
                AND c.relreplident = 'd' AND c.reloptions IS NULL)
               OR EXISTS (SELECT FROM pg_inherits WHERE inhrelid = obj OR inhparent = obj) THEN
                RAISE EXCEPTION 'hero metadata: incompatible relation %.%', ns, names[i];
            END IF;
            IF NOT has_table_privilege(obj, 'SELECT') OR NOT has_table_privilege(obj, 'INSERT')
               OR NOT has_table_privilege(obj, 'UPDATE') OR NOT has_table_privilege(obj, 'DELETE') THEN
                RAISE EXCEPTION 'hero metadata: missing existing-role DML privileges on %.%', ns, names[i];
            END IF;
            expected_names := CASE i
                WHEN 1 THEN ARRAY['server_id','hero_id','city_id']
                WHEN 2 THEN ARRAY['server_id','hero_id','city_id','summon_item_cfg_id','summon_item_qty']
                ELSE ARRAY['server_id','player_id','npc_cfg_id','friend','state','last_persuade_at'] END;
            expected_types := CASE i
                WHEN 1 THEN ARRAY['int4'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid]
                WHEN 2 THEN ARRAY['int4'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid,'int4'::regtype::oid,'int4'::regtype::oid]
                ELSE ARRAY['int4'::regtype::oid,'int8'::regtype::oid,'int4'::regtype::oid,'int4'::regtype::oid,'int2'::regtype::oid,'timestamptz'::regtype::oid] END;
            expected_nulls := CASE i WHEN 1 THEN ARRAY[true,true,true]
                WHEN 2 THEN ARRAY[true,true,true,true,true] ELSE ARRAY[true,true,true,true,true,false] END;
            expected_defaults := CASE i WHEN 1 THEN ARRAY[NULL,NULL,NULL]::text[]
                WHEN 2 THEN ARRAY[NULL,NULL,NULL,'0','0'] ELSE ARRAY[NULL,NULL,NULL,'0','0',NULL] END;
            expected_key := CASE i WHEN 3 THEN ARRAY[1,2,3]::smallint[] ELSE ARRAY[1,2]::smallint[] END;
            SELECT array_agg(a.attname::text ORDER BY a.attnum), array_agg(a.atttypid ORDER BY a.attnum),
                array_agg(a.attnotnull ORDER BY a.attnum),
                array_agg(pg_get_expr(d.adbin,d.adrelid) ORDER BY a.attnum)
                INTO col_names, col_types, col_nulls, col_defaults
                FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                WHERE a.attrelid = obj AND a.attnum > 0;
            IF col_names IS DISTINCT FROM expected_names OR col_types IS DISTINCT FROM expected_types
               OR col_nulls IS DISTINCT FROM expected_nulls OR col_defaults IS DISTINCT FROM expected_defaults
               OR EXISTS (SELECT FROM pg_attribute WHERE attrelid = obj AND attnum > 0
                   AND (attisdropped OR attidentity <> '' OR attgenerated <> '' OR atttypmod <> -1
                       OR attndims <> 0 OR attcollation <> 0 OR NOT attislocal OR attinhcount <> 0)) THEN
                RAISE EXCEPTION 'hero metadata: incompatible columns/defaults %.%', ns, names[i];
            END IF;
            IF (SELECT count(*) FROM pg_constraint WHERE conrelid = obj) <> 1 THEN
                RAISE EXCEPTION 'hero metadata: unexpected constraints %.%', ns, names[i];
            END IF;
            SELECT * INTO pk FROM pg_constraint WHERE conrelid = obj AND contype = 'p';
            IF NOT FOUND OR pk.conkey IS DISTINCT FROM expected_key OR pk.condeferrable OR pk.condeferred
               OR NOT pk.convalidated OR NOT pk.conislocal OR pk.coninhcount <> 0
               OR pk.connamespace <> namespace_id THEN
                RAISE EXCEPTION 'hero metadata: incompatible primary key %.%', ns, names[i];
            END IF;
            -- Names may differ. Only the exact live immediate unique B-tree PK is approved;
            -- extra indexes need separate classification/review, not automatic deletion.
            IF (SELECT count(*) FROM pg_index WHERE indrelid = obj) <> 1
               OR NOT EXISTS (SELECT FROM pg_index x JOIN pg_class c ON c.oid = x.indexrelid
                   JOIN pg_am am ON am.oid = c.relam
                   WHERE x.indrelid = obj AND x.indexrelid = pk.conindid
                   AND c.relkind = 'i' AND c.relpersistence = 'p' AND c.relnamespace = namespace_id
                   AND am.amname = 'btree' AND x.indisprimary AND x.indisunique AND x.indimmediate
                   AND x.indisvalid AND x.indisready AND x.indislive AND NOT x.indisexclusion
                   AND NOT x.indnullsnotdistinct AND x.indpred IS NULL AND x.indexprs IS NULL
                   AND x.indnkeyatts = cardinality(expected_key) AND x.indnatts = cardinality(expected_key)
                   AND x.indkey::text = array_to_string(expected_key,' ')
                   AND NOT EXISTS (SELECT FROM unnest(x.indclass::oid[]) WITH ORDINALITY op(id,n)
                       JOIN pg_opclass oc ON oc.oid = op.id
                       WHERE NOT oc.opcdefault OR oc.opcintype <> expected_types[op.n::integer]
                           OR oc.opcnamespace <> 'pg_catalog'::regnamespace)
                   AND NOT EXISTS (SELECT FROM unnest(x.indoption::smallint[]) opt WHERE opt <> 0)
                   AND NOT EXISTS (SELECT FROM unnest(x.indcollation::oid[]) coll WHERE coll <> 0)) THEN
                RAISE EXCEPTION 'hero metadata: incompatible primary index %.%', ns, names[i];
            END IF;
            IF EXISTS (SELECT FROM pg_trigger WHERE tgrelid = obj)
               OR EXISTS (SELECT FROM pg_policy WHERE polrelid = obj)
               OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class = obj) THEN
                RAISE EXCEPTION 'hero metadata: unexpected trigger/policy/rule %.%', ns, names[i];
            END IF;
        END LOOP;
    END LOOP;
    -- Runtime queries are unqualified. Validate their actual resolution under the
    -- caller's original path, including implicit pg_temp precedence, after creates.
    -- Any mismatch aborts this whole body; later-schema decoys are still permitted
    -- when the newly provisioned target is what runtime queries actually resolve.
    PERFORM pg_catalog.set_config('search_path', runtime_path, true);
    FOR i IN 1..3 LOOP
        IF NOT COALESCE(pg_catalog.to_regclass(pg_catalog.format('%I', names[i]))::pg_catalog.oid
            OPERATOR(pg_catalog.=) pg_catalog.to_regclass(pg_catalog.format('%I.%I', ns, names[i]))::pg_catalog.oid, false) THEN
            RAISE EXCEPTION 'hero metadata: shadowed runtime relation %.%', ns, names[i];
        END IF;
    END LOOP;
END
$metadata$;
