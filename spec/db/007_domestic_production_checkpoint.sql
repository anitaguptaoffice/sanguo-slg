-- DOM-PRODUCTION-001: proposed contract; review before runtime consumers.
-- Logical references only, following the existing cross-domain FK policy.
CREATE TABLE city_production_checkpoint (
    server_id                  INT         NOT NULL,
    city_id                    BIGINT      NOT NULL,
    player_id                  BIGINT      NOT NULL,
    settled_at                 TIMESTAMPTZ NOT NULL,
    settled_submicro_ns         SMALLINT    NOT NULL DEFAULT 0
        CHECK (settled_submicro_ns >= 0 AND settled_submicro_ns < 1000),
    food_remainder             BIGINT      NOT NULL DEFAULT 0
        CHECK (food_remainder >= 0 AND food_remainder < 3600000000000),
    wood_remainder             BIGINT      NOT NULL DEFAULT 0
        CHECK (wood_remainder >= 0 AND wood_remainder < 3600000000000),
    stone_remainder            BIGINT      NOT NULL DEFAULT 0
        CHECK (stone_remainder >= 0 AND stone_remainder < 3600000000000),
    iron_remainder             BIGINT      NOT NULL DEFAULT 0
        CHECK (iron_remainder >= 0 AND iron_remainder < 3600000000000),
    PRIMARY KEY (server_id, city_id)
);
CREATE INDEX idx_city_production_player ON city_production_checkpoint (server_id, player_id);
COMMENT ON TABLE city_production_checkpoint IS
    'Dedicated domestic accrual clock and fractions; atomic with player_wallet, never reset by external grants/spends';
COMMENT ON COLUMN city_production_checkpoint.settled_at IS
    'Settlement time truncated to microseconds; add settled_submicro_ns to reconstruct the exact nanosecond instant';
COMMENT ON COLUMN city_production_checkpoint.food_remainder IS
    'Earned fractional resource numerator modulo 3600000000000 (nanoseconds per hour); same units for all four remainders';
