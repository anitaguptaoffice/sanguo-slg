-- SPEC-FIRST-CITY-LEDGER-VALIDATE-ONLY-001 (#2682): transactional validate_only probe.
-- NOT production enablement / enrollment / player_city_id_seq / GRANT publication.
-- GUC unset/false: no-op for ApplySpecs; frozen m4_010/m4_011/m4_012 unchanged.
DO $first_city_validate_only$
DECLARE
    ns pg_catalog.text := pg_catalog.current_schema();
    runtime_path pg_catalog.text := pg_catalog.current_setting('search_path');
    validate_only boolean := COALESCE(NULLIF(pg_catalog.current_setting(
        'sanguo.first_city_ledger_validate_only', true), ''), 'false')::boolean;
    namespace_id pg_catalog.oid;
    names text[] := ARRAY['world_first_city_command','world_first_city_actor_slot'];
    fnames text[] := ARRAY['world_first_city_slot_key_text','world_first_city_slot_advisory_lock'];
    idxname text := 'idx_world_first_city_command_one_pending_per_slot';
    i int;
    obj oid;
    trg_count int;
BEGIN
    IF NOT validate_only THEN
        RETURN;
    END IF;
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR ns = 'information_schema' THEN
        RAISE EXCEPTION 'first city ledger validate_only: invalid application schema';
    END IF;
    IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'first city ledger validate_only: requires READ COMMITTED';
    END IF;
    IF pg_catalog.current_setting('transaction_read_only') <> 'on' THEN
        RAISE EXCEPTION 'first city ledger validate_only: requires READ ONLY transaction';
    END IF;
    SELECT oid INTO STRICT namespace_id FROM pg_namespace WHERE nspname = ns;

    FOR i IN 1..array_length(names, 1) LOOP
        SELECT c.oid INTO obj FROM pg_class c
            WHERE c.relnamespace = namespace_id AND c.relname = names[i] AND c.relkind = 'r';
        IF obj IS NULL THEN
            RAISE EXCEPTION 'first city ledger validate_only: missing %.%', ns, names[i];
        END IF;
        IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_am am ON am.oid = c.relam
            WHERE c.oid = obj AND c.relkind = 'r' AND c.relpersistence = 'p' AND am.amname = 'heap') THEN
            RAISE EXCEPTION 'first city ledger validate_only: incompatible relation %.%', ns, names[i];
        END IF;
        EXECUTE pg_catalog.format('LOCK TABLE ONLY %I.%I IN ACCESS SHARE MODE', ns, names[i]);
        SELECT count(*) INTO trg_count FROM pg_trigger WHERE tgrelid = obj AND NOT tgisinternal;
        IF trg_count < 1 THEN
            RAISE EXCEPTION 'first city ledger validate_only: retention trigger missing on %.%', ns, names[i];
        END IF;
    END LOOP;

    FOR i IN 1..array_length(fnames, 1) LOOP
        IF NOT EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = ns AND p.proname = fnames[i]) THEN
            RAISE EXCEPTION 'first city ledger validate_only: missing function %.%', ns, fnames[i];
        END IF;
    END LOOP;

    IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ns AND c.relname = idxname AND c.relkind = 'i') THEN
        RAISE EXCEPTION 'first city ledger validate_only: missing index %.%', ns, idxname;
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ns AND c.relname = 'world_first_city_command' AND k.contype = 'c'
          AND k.conname = 'world_first_city_command_durable_state_check') THEN
        RAISE EXCEPTION 'first city ledger validate_only: durable_state check missing';
    END IF;

    PERFORM pg_catalog.set_config('search_path', runtime_path, true);
END
$first_city_validate_only$;
