-- R4-S1: 玩家声望与爵位/官职。
CREATE TABLE IF NOT EXISTS player_rank (
    server_id   INT    NOT NULL,
    player_id   BIGINT NOT NULL,
    prestige    BIGINT NOT NULL DEFAULT 0 CHECK (prestige >= 0),
    rank_level  SMALLINT NOT NULL DEFAULT 0 CHECK (rank_level >= 0 AND rank_level <= 5),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id)
);
COMMENT ON TABLE player_rank IS '声望与爵位：rank_level 0..5，城市上限=rank+1';
