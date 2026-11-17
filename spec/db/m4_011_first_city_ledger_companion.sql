-- SPEC-FIRST-CITY-LEDGER-PG-COMPANION-001 (#2558): reference SQL helpers; see FIRST_CITY_LEDGER_PG_COMPANION.md.
-- Review prerequisite only: no runtime writer, route, realm enrollment or cutover authorization.
DO $first_city_companion$
DECLARE
    ns pg_catalog.text := pg_catalog.current_schema();
    runtime_path pg_catalog.text := pg_catalog.current_setting('search_path');
BEGIN
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR ns = 'information_schema' THEN
        RAISE EXCEPTION 'first city companion: invalid application schema';
    END IF;

    EXECUTE pg_catalog.format($fn$
CREATE OR REPLACE FUNCTION %1$I.world_first_city_slot_key_text(
    p_realm_id uuid,
    p_server_id integer,
    p_player_id bigint
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $key$
    SELECT p_realm_id::text || U&'\001F' || p_server_id::text || U&'\001F' || p_player_id::text;
$key$;

COMMENT ON FUNCTION %1$I.world_first_city_slot_key_text(uuid, integer, bigint) IS
    'Stable actor slot text for pg_advisory_xact_lock(hashtextextended(...,0)); FIRST_CITY_LEDGER_GLOBAL_PINS.md §3.';

CREATE OR REPLACE FUNCTION %1$I.world_first_city_slot_advisory_lock(
    p_realm_id uuid,
    p_server_id integer,
    p_player_id bigint
) RETURNS void
LANGUAGE sql
VOLATILE
SET search_path = pg_catalog, pg_temp
AS $lock$
    SELECT pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            %1$I.world_first_city_slot_key_text(p_realm_id, p_server_id, p_player_id), 0));
$lock$;

COMMENT ON FUNCTION %1$I.world_first_city_slot_advisory_lock(uuid, integer, bigint) IS
    'Transaction-scoped slot serialization; companion intake/effect/finalizer must call before slot FOR UPDATE.';
$fn$, ns);

    PERFORM pg_catalog.set_config('search_path', runtime_path, true);
END
$first_city_companion$;
