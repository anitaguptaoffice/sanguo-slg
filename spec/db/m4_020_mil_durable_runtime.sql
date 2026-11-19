-- Durable MIL runtime prerequisites.
--
-- The first-city v2 effect allocates city ids from player_city_id_seq, and the
-- durable recruit/march runtime pins the three mil_* relations. ApplySpecs is
-- idempotent, so this migration is a plain CREATE IF NOT EXISTS and is safe to
-- replay on an existing database. Constraint names and expressions are part of
-- the durable source contract; keep them stable.

CREATE SEQUENCE IF NOT EXISTS player_city_id_seq AS bigint
    START 1 MINVALUE 1 MAXVALUE 9223372036854775807 INCREMENT 1 CACHE 1 NO CYCLE OWNED BY NONE;

CREATE TABLE IF NOT EXISTS mil_recruit_origin(
    server_id integer NOT NULL,
    queue_id bigint NOT NULL CHECK(queue_id >= 1 AND queue_id <= 9007199254740991),
    player_id bigint NOT NULL,
    operation smallint NOT NULL CHECK(operation = 1),
    command_id bytea NOT NULL CHECK(octet_length(command_id) = 16 AND command_id <> decode(repeat('00',16),'hex')),
    PRIMARY KEY(server_id,queue_id),
    UNIQUE(server_id,player_id,operation,command_id));

CREATE TABLE IF NOT EXISTS mil_recruit_receipt(
    server_id integer NOT NULL,
    queue_id bigint NOT NULL CHECK(queue_id >= 1 AND queue_id <= 9007199254740991),
    intent_version smallint NOT NULL CHECK(intent_version = 1),
    city_id bigint NOT NULL,
    unit_cfg_id integer NOT NULL CHECK(unit_cfg_id >= 1 AND unit_cfg_id <= 4),
    count integer NOT NULL CHECK(count > 0),
    food_paid bigint NOT NULL CHECK(food_paid >= 0),
    wood_paid bigint NOT NULL CHECK(wood_paid >= 0),
    iron_paid bigint NOT NULL CHECK(iron_paid >= 0),
    stone_paid bigint NOT NULL CHECK(stone_paid >= 0),
    duration_sec bigint NOT NULL CHECK(duration_sec > 0),
    catalog_version bytea NOT NULL CHECK(octet_length(catalog_version) > 0),
    rule_digest bytea NOT NULL CHECK(octet_length(rule_digest) = 32),
    accepted_at timestamptz NOT NULL CHECK(isfinite(accepted_at) AND accepted_at >= '0001-01-01T00:00:00Z' AND accepted_at < '10000-01-01T00:00:00Z' AND date_trunc('milliseconds',accepted_at) = accepted_at),
    initial_start_at timestamptz NOT NULL CHECK(isfinite(initial_start_at) AND initial_start_at >= '0001-01-01T00:00:00Z' AND initial_start_at < '10000-01-01T00:00:00Z' AND date_trunc('milliseconds',initial_start_at) = initial_start_at),
    initial_finish_at timestamptz NOT NULL CHECK(isfinite(initial_finish_at) AND initial_finish_at >= '0001-01-01T00:00:00Z' AND initial_finish_at < '10000-01-01T00:00:00Z' AND date_trunc('milliseconds',initial_finish_at) = initial_finish_at),
    initial_status smallint NOT NULL CHECK(initial_status IN (0,1)),
    PRIMARY KEY(server_id,queue_id),
    FOREIGN KEY(server_id,queue_id) REFERENCES mil_recruit_origin(server_id,queue_id) ON UPDATE RESTRICT ON DELETE RESTRICT);

CREATE TABLE IF NOT EXISTS mil_city_origin (
    server_id integer NOT NULL CONSTRAINT mil_city_origin_server_id_check CHECK(server_id > 0),
    city_id bigint NOT NULL CONSTRAINT mil_city_origin_city_id_check CHECK(city_id > 0),
    owner_player_id bigint NOT NULL CONSTRAINT mil_city_origin_owner_player_id_check CHECK(owner_player_id > 0),
    cohort_id bytea NOT NULL CONSTRAINT mil_city_origin_cohort_id_check
        CHECK(octet_length(cohort_id) = 16 AND cohort_id <> decode(repeat('00',16),'hex')),
    format_version smallint NOT NULL CONSTRAINT mil_city_origin_format_version_check CHECK(format_version = 1),
    created_at timestamptz NOT NULL CONSTRAINT mil_city_origin_created_at_check
        CHECK(isfinite(created_at) AND created_at >= '0001-01-01T00:00:00Z'
            AND created_at < '10000-01-01T00:00:00Z' AND date_trunc('milliseconds',created_at) = created_at),
    CONSTRAINT mil_city_origin_pkey PRIMARY KEY(server_id,city_id));
