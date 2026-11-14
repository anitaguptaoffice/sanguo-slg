-- SPEC-FIRST-CITY-LEDGER-PENDING-UNIQUE-INDEX-001 (#2672): one-PENDING-per-slot partial unique index;
-- see FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md.
-- Review prerequisite only: no runtime writer, route, realm enrollment or cutover authorization.
-- Depends on m4_010_first_city_ledger.sql; does not alter m4_010 table/trigger bodies.
DO $first_city_pending_unique$
DECLARE
    ns pg_catalog.text := pg_catalog.current_schema();
    runtime_path pg_catalog.text := pg_catalog.current_setting('search_path');
BEGIN
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR ns = 'information_schema' THEN
        RAISE EXCEPTION 'first city pending unique index: invalid application schema';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ns AND c.relname = 'world_first_city_command' AND c.relkind = 'r') THEN
        RAISE EXCEPTION 'first city pending unique index: world_first_city_command missing (apply m4_010 first)';
    END IF;

    EXECUTE pg_catalog.format($ddl$
CREATE UNIQUE INDEX IF NOT EXISTS idx_world_first_city_command_one_pending_per_slot
    ON %1$I.world_first_city_command (realm_id, server_id, player_id)
    WHERE durable_state = 1;
COMMENT ON INDEX %1$I.idx_world_first_city_command_one_pending_per_slot IS
    'Catalog backstop: at most one PENDING (durable_state=1) per actor slot; does not replace slot/head CAS, writer linearization, or m4_010 retention triggers.';
$ddl$, ns);

    PERFORM pg_catalog.set_config('search_path', runtime_path, true);
END
$first_city_pending_unique$;
