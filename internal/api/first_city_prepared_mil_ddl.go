package api

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/jackc/pgx/v5/pgxpool"
)

var firstCityPlayerCitySeqDDL = `CREATE SEQUENCE IF NOT EXISTS player_city_id_seq AS bigint START 1 MINVALUE 1 ` +
	`MAXVALUE 9223372036854775807 INCREMENT 1 CACHE 1 NO CYCLE OWNED BY NONE`

// Harness-only shapes (not ApplySpecs); matches spec/db/migrations 008/010 for fresh-city PG tests.
const firstCityMilRecruitDDL = `
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
    FOREIGN KEY(server_id,queue_id) REFERENCES mil_recruit_origin(server_id,queue_id) ON UPDATE RESTRICT ON DELETE RESTRICT)`

const firstCityMilCityOriginDDL = `
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
    CONSTRAINT mil_city_origin_pkey PRIMARY KEY(server_id,city_id))`

// EnsureFirstCityPreparedMilDDL installs domestic/MIL fresh prerequisites when missing (idempotent on warm schema).
func EnsureFirstCityPreparedMilDDL(ctx context.Context, pool *pgxpool.Pool) error {
	stripDomesticFreshTestPollution(ctx, pool)
	if err := ensureDomesticPreparedFreshDDL(ctx, pool); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, firstCityPlayerCitySeqDDL); err != nil {
		return fmt.Errorf("player_city_id_seq: %w", err)
	}
	ready, err := milFreshReady(ctx, pool)
	if err != nil {
		return err
	}
	if ready {
		return nil
	}
	return applyFirstCityPreparedMilMigrations(ctx, pool)
}

// stripDomesticFreshTestPollution removes deferrable test harness DDL that breaks
// domestic fresh-source catalog validation on the shared warm schema.
func stripDomesticFreshTestPollution(ctx context.Context, pool *pgxpool.Pool) {
	for _, q := range []string{
		`ALTER TABLE city_building DROP CONSTRAINT IF EXISTS reject_atomic`,
		`ALTER TABLE city_building DROP CONSTRAINT IF EXISTS reject_registration`,
		`ALTER TABLE city_building DROP CONSTRAINT IF EXISTS reject_atomic_api`,
		`DROP TRIGGER IF EXISTS reject_registration ON city_production_checkpoint`,
		`DROP TRIGGER IF EXISTS reject_atomic_commit ON city_production_checkpoint`,
	} {
		_, _ = pool.Exec(ctx, q)
	}
}

func ensureDomesticPreparedFreshDDL(ctx context.Context, pool *pgxpool.Pool) error {
	var ok bool
	if err := pool.QueryRow(ctx, `SELECT to_regclass('city_production_checkpoint') IS NOT NULL`).Scan(&ok); err != nil {
		return err
	}
	if ok {
		return nil
	}
	specDir, err := pgfixture.SpecDir()
	if err != nil {
		return err
	}
	body, err := os.ReadFile(filepath.Join(specDir, "007_domestic_production_checkpoint.sql"))
	if err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, string(body)); err != nil {
		return fmt.Errorf("007_domestic_production_checkpoint: %w", err)
	}
	return nil
}

func milFreshReady(ctx context.Context, pool *pgxpool.Pool) (bool, error) {
	var ready bool
	err := pool.QueryRow(ctx, `
		SELECT to_regclass('mil_city_origin') IS NOT NULL
		   AND to_regclass('mil_recruit_origin') IS NOT NULL
		   AND to_regclass('mil_recruit_receipt') IS NOT NULL`).Scan(&ready)
	return ready, err
}

func applyFirstCityPreparedMilMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	specDir, err := pgfixture.SpecDir()
	if err != nil {
		return err
	}
	var seq bool
	if err := pool.QueryRow(ctx, `SELECT to_regclass('work_queue_id_seq') IS NOT NULL`).Scan(&seq); err != nil {
		return err
	}
	if !seq {
		body, err := os.ReadFile(filepath.Join(specDir, "m4_008_work_queue_id_sequence.sql"))
		if err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, string(body)); err != nil {
			return fmt.Errorf("m4_008: %w", err)
		}
	}
	if _, err := pool.Exec(ctx, firstCityMilRecruitDDL); err != nil {
		return fmt.Errorf("mil_recruit: %w", err)
	}
	if _, err := pool.Exec(ctx, firstCityMilCityOriginDDL); err != nil {
		return fmt.Errorf("mil_city_origin: %w", err)
	}
	ready, err := milFreshReady(ctx, pool)
	if err != nil {
		return err
	}
	if !ready {
		return fmt.Errorf("mil fresh ddl incomplete after apply")
	}
	return nil
}
