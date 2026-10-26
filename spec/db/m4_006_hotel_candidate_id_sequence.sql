-- SPEC-HOTEL-CANDIDATE-ID: maintenance only; read hotel_candidate_id_sequence.md.
-- Stop/drain all candidate writers, sequence clients, maintenance and DDL first.
-- One transaction; replay-safe when ApplySpecs has not yet recorded its ledger row.
DO $migration$
DECLARE
    ns text := pg_catalog.current_schema();
    obj oid;
    seq oid;
    cfg record;
    highwater bigint := COALESCE(NULLIF(pg_catalog.current_setting(
        'sanguo.hotel_candidate_id_reserved_highwater', true), ''), '0')::bigint;
    found_max bigint;
    last_id bigint;
    called boolean;
    ceiling CONSTANT bigint := 9223372036854775807;
BEGIN
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR highwater < 0 THEN
        RAISE EXCEPTION 'hotel candidate ID migration: invalid schema/reserved highwater';
    END IF;
    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'hotel candidate ID migration requires READ COMMITTED';
    END IF;
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog', true);
    PERFORM pg_catalog.set_config('row_security', 'off', true);
    obj := to_regclass(format('%I.city_hotel_recruit', ns));
    IF obj IS NULL THEN
        RAISE EXCEPTION 'hotel candidate ID migration: missing city_hotel_recruit';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class WHERE oid = obj AND relkind IN ('r','p'))
       OR NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = obj
           AND attname = 'candidate_id' AND NOT attisdropped AND atttypid = 'int8'::regtype) THEN
        RAISE EXCEPTION 'hotel candidate ID migration: unexpected reference shape';
    END IF;
    -- The only persisted candidate reference in the audited source. Serializes reruns.
    EXECUTE format('LOCK TABLE %I.city_hotel_recruit IN SHARE ROW EXCLUSIVE MODE', ns);
    IF EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = ns AND c.relkind IN ('r','p','v','m','f')
        AND NOT a.attisdropped AND a.attname IN ('candidate_id','candidate_ids')
        AND (c.relname, a.attname) <> ('city_hotel_recruit','candidate_id')) THEN
        RAISE EXCEPTION 'hotel candidate ID migration: unreviewed candidate reference';
    END IF;
    EXECUTE format('SELECT max(candidate_id) FROM %I.city_hotel_recruit', ns) INTO found_max;
    highwater := greatest(highwater, COALESCE(found_max, 0));
    IF highwater = ceiling THEN
        RAISE EXCEPTION 'hotel candidate ID migration: exhausted persistent/reserved highwater';
    END IF;
    seq := to_regclass(format('%I.city_hotel_candidate_id_seq', ns));
    IF seq IS NULL THEN
        EXECUTE format('CREATE SEQUENCE %I.city_hotel_candidate_id_seq AS bigint INCREMENT 1 '
            'MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE OWNED BY NONE', ns);
        seq := to_regclass(format('%I.city_hotel_candidate_id_seq', ns));
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class WHERE oid = seq AND relkind = 'S' AND relpersistence = 'p') THEN
        RAISE EXCEPTION 'hotel candidate ID migration: expected permanent logged sequence';
    END IF;
    SELECT * INTO STRICT cfg FROM pg_sequence WHERE seqrelid = seq;
    IF cfg.seqtypid <> 'int8'::regtype OR cfg.seqincrement <> 1 OR cfg.seqcycle
       OR cfg.seqmin <> 1 OR cfg.seqmax <> ceiling OR cfg.seqcache <> 1 OR cfg.seqstart <> 1
       OR EXISTS (SELECT FROM pg_depend WHERE classid = 'pg_class'::regclass
           AND objid = seq AND deptype IN ('a','i')) THEN
        RAISE EXCEPTION 'hotel candidate ID migration: incompatible sequence configuration/ownership';
    END IF;
    EXECUTE format('SELECT last_value, is_called FROM %I.city_hotel_candidate_id_seq', ns)
        INTO last_id, called;
    IF last_id = ceiling AND called THEN
        RAISE EXCEPTION 'hotel candidate ID migration: sequence exhausted';
    END IF;
    -- setval is not rolled back: validate first, only advance, and do this last.
    -- Empty/new remains (1,false); preserve any higher called or uncalled state.
    IF highwater > last_id OR (highwater = last_id AND NOT called) THEN
        PERFORM setval(seq::regclass, highwater, true);
    END IF;
END
$migration$;
