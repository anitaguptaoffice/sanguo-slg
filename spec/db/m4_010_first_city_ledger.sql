-- SPEC-FIRST-CITY-LEDGER-DDL-001 (#2552): durable WORLD first-city ledger; see FIRST_CITY_LEDGER.md.
-- Review prerequisite only: no runtime writer, route, realm enrollment or cutover authorization.
-- ApplySpecs runs this body and records its ledger entry separately; missing-ledger replay must
-- remain idempotent without rewriting rows, terminal states or recycled command IDs.
-- Depends on CITY_CREATION_RECOVERY.md, FIRST-CITY-WIRE.md and FRESH_CITY_TEMPLATE_CODEC.md.
-- 002_world.sql has no realm column; this ledger does not alter player_city or legacy CreateCity.
DO $first_city_ledger$
DECLARE
    ns pg_catalog.text := pg_catalog.current_schema();
    runtime_path pg_catalog.text := pg_catalog.current_setting('search_path');
    namespace_id pg_catalog.oid;
    owner_id pg_catalog.oid;
BEGIN
    PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
    IF ns IS NULL OR ns LIKE 'pg\_%' ESCAPE '\' OR ns = 'information_schema' THEN
        RAISE EXCEPTION 'first city ledger: invalid application schema';
    END IF;
    IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'first city ledger: requires READ COMMITTED for provisioning';
    END IF;
    SELECT oid INTO STRICT owner_id FROM pg_roles WHERE rolname = current_user;
    SELECT oid INTO STRICT namespace_id FROM pg_namespace WHERE nspname = ns;

    EXECUTE pg_catalog.format($ddl$
CREATE TABLE IF NOT EXISTS %1$I.world_first_city_command (
    realm_id                    UUID         NOT NULL,
    server_id                   INT          NOT NULL
        CONSTRAINT world_first_city_command_server_id_check CHECK (server_id > 0 AND server_id <= 2147483647),
    player_id                   BIGINT       NOT NULL
        CONSTRAINT world_first_city_command_player_id_check CHECK (player_id > 0),
    command_id                  UUID         NOT NULL,
    account_id                  BIGINT       NOT NULL
        CONSTRAINT world_first_city_command_account_id_check CHECK (account_id > 0),
    canonical_c1                BYTEA        NOT NULL
        CONSTRAINT world_first_city_command_canonical_c1_check
            CHECK (octet_length(canonical_c1) BETWEEN 1 AND 231),
    durable_state               SMALLINT     NOT NULL
        CONSTRAINT world_first_city_command_durable_state_check CHECK (durable_state IN (1, 2, 3)),
    template_version            VARCHAR(64)  NOT NULL,
    rules_version               VARCHAR(64)  NOT NULL,
    catalog_version             VARCHAR(64)  NOT NULL,
    content_encoding_version    INT          NOT NULL
        CONSTRAINT world_first_city_command_encoding_ver_check CHECK (content_encoding_version > 0),
    template_fct1               BYTEA        NOT NULL
        CONSTRAINT world_first_city_command_template_fct1_check
            CHECK (octet_length(template_fct1) BETWEEN 52 AND 262144),
    content_sha256              BYTEA        NOT NULL
        CONSTRAINT world_first_city_command_sha256_check CHECK (octet_length(content_sha256) = 32),
    received_at                 TIMESTAMPTZ  NOT NULL,
    terminal_at                 TIMESTAMPTZ,
    success_city_id             BIGINT,
    success_server_id           INT,
    success_player_id           BIGINT,
    success_is_capital          BOOLEAN,
    success_wall_level          INT,
    success_morale              INT,
    rejection_reason            SMALLINT,
  CONSTRAINT world_first_city_command_pkey PRIMARY KEY (realm_id, server_id, player_id, command_id),
  CONSTRAINT world_first_city_command_pending_receipt_check CHECK (
      durable_state <> 1
      OR (terminal_at IS NULL AND success_city_id IS NULL AND success_server_id IS NULL
          AND success_player_id IS NULL AND success_is_capital IS NULL AND success_wall_level IS NULL
          AND success_morale IS NULL AND rejection_reason IS NULL)),
  CONSTRAINT world_first_city_command_success_receipt_check CHECK (
      durable_state <> 2
      OR (terminal_at IS NOT NULL AND rejection_reason IS NULL
          AND success_city_id > 0 AND success_server_id > 0 AND success_player_id > 0
          AND success_server_id = server_id AND success_player_id = player_id
          AND success_is_capital = true AND success_wall_level = 1 AND success_morale = 100)),
  CONSTRAINT world_first_city_command_rejection_receipt_check CHECK (
      durable_state <> 3
      OR (terminal_at IS NOT NULL AND rejection_reason IN (1, 2)
          AND success_city_id IS NULL AND success_server_id IS NULL AND success_player_id IS NULL
          AND success_is_capital IS NULL AND success_wall_level IS NULL AND success_morale IS NULL))
);
COMMENT ON TABLE %1$I.world_first_city_command IS
    'Retained first-city command lineage: 1=PENDING, 2=SUCCEEDED, 3=REJECTED_NO_EFFECT (wire FirstCityRecord). IDs are never recycled.';
COMMENT ON COLUMN %1$I.world_first_city_command.canonical_c1 IS 'Immutable C1 bytes per FIRST-CITY-WIRE.md; same command_id different C1 must conflict without overwrite.';
COMMENT ON COLUMN %1$I.world_first_city_command.durable_state IS '1=PENDING, 2=SUCCEEDED (FirstCitySuccess), 3=REJECTED_NO_EFFECT (FirstCityRejection reason 1/2 only).';
COMMENT ON COLUMN %1$I.world_first_city_command.rejection_reason IS '1=TERRAIN, 2=COORDINATE_OCCUPIED; only when durable_state=3.';

CREATE INDEX IF NOT EXISTS idx_world_first_city_command_received
    ON %1$I.world_first_city_command (realm_id, server_id, player_id, received_at);

CREATE TABLE IF NOT EXISTS %1$I.world_first_city_actor_slot (
    realm_id            UUID         NOT NULL,
    server_id           INT          NOT NULL
        CONSTRAINT world_first_city_actor_slot_server_id_check CHECK (server_id > 0 AND server_id <= 2147483647),
    player_id           BIGINT       NOT NULL
        CONSTRAINT world_first_city_actor_slot_player_id_check CHECK (player_id > 0),
    account_id          BIGINT       NOT NULL
        CONSTRAINT world_first_city_actor_slot_account_id_check CHECK (account_id > 0),
    head_command_id     UUID,
  CONSTRAINT world_first_city_actor_slot_pkey PRIMARY KEY (realm_id, server_id, player_id),
  CONSTRAINT world_first_city_actor_slot_head_fkey FOREIGN KEY (realm_id, server_id, player_id, head_command_id)
      REFERENCES %1$I.world_first_city_command (realm_id, server_id, player_id, command_id)
      DEFERRABLE INITIALLY DEFERRED
);
COMMENT ON TABLE %1$I.world_first_city_actor_slot IS
    'Permanent first-city actor slot: stable key realm_id+server_id+player_id; head_command_id NULL means certified EMPTY head. Does not prove physical realm isolation.';
$ddl$, ns);

    -- Slot must be created after command table exists; FK is deferred. Re-run validates shape.
    IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ns AND c.relname = 'world_first_city_command' AND c.relkind = 'r') THEN
        RAISE EXCEPTION 'first city ledger: command table missing after DDL';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ns AND c.relname = 'world_first_city_actor_slot' AND c.relkind = 'r') THEN
        RAISE EXCEPTION 'first city ledger: actor slot table missing after DDL';
    END IF;

    EXECUTE pg_catalog.format($fn$
CREATE OR REPLACE FUNCTION %1$I.world_first_city_command_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $guard$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.realm_id IS DISTINCT FROM OLD.realm_id
            OR NEW.server_id IS DISTINCT FROM OLD.server_id
            OR NEW.player_id IS DISTINCT FROM OLD.player_id
            OR NEW.command_id IS DISTINCT FROM OLD.command_id
            OR NEW.account_id IS DISTINCT FROM OLD.account_id
            OR NEW.canonical_c1 IS DISTINCT FROM OLD.canonical_c1
            OR NEW.template_version IS DISTINCT FROM OLD.template_version
            OR NEW.rules_version IS DISTINCT FROM OLD.rules_version
            OR NEW.catalog_version IS DISTINCT FROM OLD.catalog_version
            OR NEW.content_encoding_version IS DISTINCT FROM OLD.content_encoding_version
            OR NEW.template_fct1 IS DISTINCT FROM OLD.template_fct1
            OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
            OR NEW.received_at IS DISTINCT FROM OLD.received_at THEN
            RAISE EXCEPTION 'first city ledger: immutable intake fields cannot change';
        END IF;
        IF OLD.durable_state IN (2, 3) AND NEW.durable_state IS DISTINCT FROM OLD.durable_state THEN
            RAISE EXCEPTION 'first city ledger: terminal durable_state is immutable';
        END IF;
        IF OLD.durable_state = 1 AND NEW.durable_state NOT IN (1, 2, 3) THEN
            RAISE EXCEPTION 'first city ledger: invalid durable_state transition';
        END IF;
        IF OLD.durable_state = 1 AND NEW.durable_state IN (2, 3) AND NEW.terminal_at IS NULL THEN
            RAISE EXCEPTION 'first city ledger: terminal transition requires terminal_at';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'first city ledger: command rows are retained and must not be deleted';
    END IF;
    RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS trg_world_first_city_command_guard ON %1$I.world_first_city_command;
CREATE TRIGGER trg_world_first_city_command_guard
    BEFORE UPDATE OR DELETE ON %1$I.world_first_city_command
    FOR EACH ROW EXECUTE FUNCTION %1$I.world_first_city_command_guard();

CREATE OR REPLACE FUNCTION %1$I.world_first_city_actor_slot_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $slot$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.realm_id IS DISTINCT FROM OLD.realm_id
            OR NEW.server_id IS DISTINCT FROM OLD.server_id
            OR NEW.player_id IS DISTINCT FROM OLD.player_id
            OR NEW.account_id IS DISTINCT FROM OLD.account_id THEN
            RAISE EXCEPTION 'first city ledger: slot identity/account binding is immutable';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'first city ledger: actor slot rows are retained and must not be deleted';
    END IF;
    RETURN NEW;
END;
$slot$;

DROP TRIGGER IF EXISTS trg_world_first_city_actor_slot_guard ON %1$I.world_first_city_actor_slot;
CREATE TRIGGER trg_world_first_city_actor_slot_guard
    BEFORE UPDATE OR DELETE ON %1$I.world_first_city_actor_slot
    FOR EACH ROW EXECUTE FUNCTION %1$I.world_first_city_actor_slot_guard();
$fn$, ns);

    PERFORM pg_catalog.set_config('search_path', runtime_path, true);
END
$first_city_ledger$;
