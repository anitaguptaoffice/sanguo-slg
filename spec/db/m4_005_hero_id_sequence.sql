-- SPEC-RECRUIT-ID: maintenance-only; see recruit_id_sequence.md before execution.
-- All old writers/maintenance/DDL and sequence clients must be stopped and drained.
-- One DO statement is one transaction under ApplySpecs (whose ledger is separate).
DO $migration$
DECLARE
    ns text := pg_catalog.current_schema();
    source record;
    obj oid;
    seq oid;
    cfg record;
    highwater bigint := COALESCE(NULLIF(pg_catalog.current_setting(
        'sanguo.hero_id_reserved_highwater', true), ''), '0')::bigint;
    found_max bigint;
    last_id bigint;
    called boolean;
    ceiling CONSTANT bigint := 9223372036854775807;
BEGIN
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR highwater < 0 THEN
        RAISE EXCEPTION 'hero ID migration: invalid target schema/reserved highwater';
    END IF;
    IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'hero ID migration requires READ COMMITTED';
    END IF;
    -- Explicit pg_temp last prevents temporary relations from shadowing catalogs.
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    PERFORM pg_catalog.set_config('row_security', 'off', true);
    -- Qualify every object: never adopt a sequence/reference from a later schema.
    FOR source IN SELECT * FROM (VALUES
        ('player_hero', 'hero_id', true),
        ('hero_skill', 'hero_id', true),
        ('hero_assignment', 'hero_id', true),
        ('field_army', 'hero_ids', true),
        ('hero_largess_schedule', 'hero_id', false),
        ('hero_march_force', 'hero_id', false),
        ('hero_expr_session', 'hero_id', false),
        ('player_hero_coming', 'hero_id', false),
        ('player_hero_captive', 'hero_id', false)
    ) AS refs(tab, col, required)
    LOOP
        obj := to_regclass(format('%I.%I', ns, source.tab));
        IF obj IS NULL THEN
            IF source.required THEN
                RAISE EXCEPTION 'hero ID migration: missing %.%', ns, source.tab;
            END IF;
            CONTINUE;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_class WHERE oid = obj AND relkind IN ('r','p'))
           OR NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = obj
               AND attname = source.col AND NOT attisdropped AND atttypid =
               CASE WHEN source.col = 'hero_ids' THEN 'int8[]'::regtype
                    ELSE 'int8'::regtype END) THEN
            RAISE EXCEPTION 'hero ID migration: unexpected reference shape %.%', ns, source.tab;
        END IF;
        -- player_hero is first; this self-conflicting lock also serializes reruns.
        EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE', ns, source.tab);
        IF source.col = 'hero_ids' THEN
            EXECUTE format('SELECT max(id) FROM %I.%I CROSS JOIN LATERAL unnest(hero_ids) AS u(id)',
                           ns, source.tab) INTO found_max;
        ELSE
            EXECUTE format('SELECT max(hero_id) FROM %I.%I', ns, source.tab) INTO found_max;
        END IF;
        highwater := greatest(highwater, COALESCE(found_max, 0));
    END LOOP;
    -- Unknown hero references require a reviewed contract, not a guessed scan.
    IF EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = ns AND c.relkind IN ('r','p','v','m','f')
        AND NOT a.attisdropped AND a.attname IN ('hero_id','hero_ids')
        AND (c.relname, a.attname) NOT IN (
            ('player_hero','hero_id'),('hero_skill','hero_id'),('hero_assignment','hero_id'),
            ('field_army','hero_ids'),('hero_largess_schedule','hero_id'),('hero_march_force','hero_id'),
            ('hero_expr_session','hero_id'),('player_hero_coming','hero_id'),('player_hero_captive','hero_id'))) THEN
        RAISE EXCEPTION 'hero ID migration: unreviewed hero reference relation';
    END IF;
    IF highwater = ceiling THEN
        RAISE EXCEPTION 'hero ID migration: exhausted persistent/reserved highwater';
    END IF;
    seq := to_regclass(format('%I.player_hero_id_seq', ns));
    IF seq IS NULL THEN
        EXECUTE format('CREATE SEQUENCE %I.player_hero_id_seq AS bigint INCREMENT 1 '
            'MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE OWNED BY NONE', ns);
        seq := to_regclass(format('%I.player_hero_id_seq', ns));
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class WHERE oid = seq AND relkind = 'S'
                   AND relpersistence = 'p') THEN
        RAISE EXCEPTION 'hero ID migration: expected permanent logged sequence';
    END IF;
    SELECT * INTO STRICT cfg FROM pg_sequence WHERE seqrelid = seq;
    IF cfg.seqtypid <> 'int8'::regtype OR cfg.seqincrement <> 1 OR cfg.seqcycle
       OR cfg.seqmin <> 1 OR cfg.seqmax <> ceiling OR cfg.seqcache <> 1
       OR cfg.seqstart <> 1 OR EXISTS (SELECT FROM pg_depend WHERE classid = 'pg_class'::regclass
           AND objid = seq AND deptype IN ('a','i')) THEN
        RAISE EXCEPTION 'hero ID migration: incompatible sequence configuration/ownership';
    END IF;
    EXECUTE format('SELECT last_value, is_called FROM %I.player_hero_id_seq', ns)
        INTO last_id, called;
    IF last_id = ceiling AND called THEN
        RAISE EXCEPTION 'hero ID migration: sequence exhausted';
    END IF;
    -- setval is NOT rolled back. Only advance, only after every validation, last.
    -- Preserve uncalled higher values; empty/new stays (1,false), so first ID = 1.
    IF highwater > last_id OR (highwater = last_id AND NOT called) THEN
        PERFORM setval(seq::regclass, highwater, true);
    END IF;
END
$migration$;
