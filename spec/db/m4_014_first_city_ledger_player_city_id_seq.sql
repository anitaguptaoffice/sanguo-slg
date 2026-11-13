-- SPEC-FIRST-CITY-LEDGER-PLAYER-CITY-ID-SEQ-001 (#2685): reviewed sequence shape for disposable harness only.
-- NOT production activation / realm enrollment / GRANT. GUC unset/false: no-op on ApplySpecs and validate.sh.
DO $fc_player_city_id_seq$
DECLARE
    ns text := pg_catalog.current_schema();
    harness boolean := COALESCE(NULLIF(pg_catalog.current_setting(
        'sanguo.first_city_ledger_player_city_id_seq_harness', true), ''), 'false')::boolean;
    fixture_h text := pg_catalog.current_setting(
        'sanguo.first_city_ledger_player_city_id_fixture_highwater', true);
    highwater bigint;
    seq oid;
    cfg record;
    last_id bigint;
    called boolean;
    ceiling CONSTANT bigint := 9223372036854775807;
BEGIN
    IF NOT harness THEN
        RETURN;
    END IF;
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' THEN
        RAISE EXCEPTION 'player_city_id_seq harness: invalid application schema';
    END IF;
    IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'player_city_id_seq harness: requires READ COMMITTED';
    END IF;
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);

    seq := to_regclass(format('%I.player_city_id_seq', ns));
    IF seq IS NULL THEN
        EXECUTE format(
            'CREATE SEQUENCE %I.player_city_id_seq AS bigint INCREMENT 1 '
            'MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE OWNED BY NONE', ns);
        seq := to_regclass(format('%I.player_city_id_seq', ns));
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class WHERE oid = seq AND relkind = 'S' AND relpersistence = 'p') THEN
        RAISE EXCEPTION 'player_city_id_seq harness: wrong kind or persistence (no auto repair)';
    END IF;
    SELECT * INTO STRICT cfg FROM pg_sequence WHERE seqrelid = seq;
    IF cfg.seqtypid <> 'int8'::regtype OR cfg.seqincrement <> 1 OR cfg.seqcycle
       OR cfg.seqmin <> 1 OR cfg.seqmax <> ceiling OR cfg.seqcache <> 1 OR cfg.seqstart <> 1
       OR EXISTS (SELECT FROM pg_depend WHERE classid = 'pg_class'::regclass
           AND objid = seq AND deptype IN ('a','i')) THEN
        RAISE EXCEPTION 'player_city_id_seq harness: incompatible configuration/ownership (fail-closed)';
    END IF;

    IF fixture_h IS NOT NULL AND fixture_h <> '' THEN
        highwater := fixture_h::bigint;
        IF highwater < 0 OR highwater > ceiling THEN
            RAISE EXCEPTION 'player_city_id_seq harness: invalid fixture highwater';
        END IF;
        EXECUTE format('SELECT last_value, is_called FROM %I.player_city_id_seq', ns)
            INTO last_id, called;
        IF last_id = ceiling AND called THEN
            RAISE EXCEPTION 'player_city_id_seq harness: sequence exhausted';
        END IF;
        IF highwater > last_id OR (highwater = last_id AND NOT called) THEN
            PERFORM setval(seq::regclass, highwater, true);
        END IF;
    END IF;
END
$fc_player_city_id_seq$;
