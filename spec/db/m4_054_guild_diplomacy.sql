-- R4-S4: 联盟外交关系与盟友驻军。
CREATE TABLE IF NOT EXISTS guild_relation (
    server_id       INT    NOT NULL,
    guild_id        BIGINT NOT NULL,
    target_guild_id BIGINT NOT NULL,
    state           SMALLINT NOT NULL CHECK (state >= 1 AND state <= 3),
    effective_at    TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, guild_id, target_guild_id)
);
COMMENT ON TABLE guild_relation IS '1友好 2中立 3敌对；敌对 8 小时后生效';

CREATE TABLE IF NOT EXISTS guild_garrison (
    server_id   INT    NOT NULL,
    city_id     BIGINT NOT NULL,
    guild_id    BIGINT NOT NULL,
    player_id   BIGINT NOT NULL,
    unit_cfg_id INT    NOT NULL CHECK (unit_cfg_id >= 1 AND unit_cfg_id <= 12),
    count       INT    NOT NULL CHECK (count > 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, city_id, guild_id, player_id, unit_cfg_id)
);
COMMENT ON TABLE guild_garrison IS '盟友驻军：鸿胪寺开启接纳后用于协防';
