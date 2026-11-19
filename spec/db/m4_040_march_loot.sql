-- R1-S4: rewards won by a wild/Yellow-Turban battle, settled when the army returns.
CREATE TABLE IF NOT EXISTS march_loot (
    server_id  INT    NOT NULL,
    march_id   BIGINT NOT NULL,
    food       BIGINT NOT NULL DEFAULT 0,
    wood       BIGINT NOT NULL DEFAULT 0,
    stone      BIGINT NOT NULL DEFAULT 0,
    iron       BIGINT NOT NULL DEFAULT 0,
    gold       BIGINT NOT NULL DEFAULT 0,
    items      JSONB  NOT NULL DEFAULT '[]',
    hero_exp   BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, march_id)
);
COMMENT ON TABLE march_loot IS '战斗胜利战利品；部队返程入账后删除';
