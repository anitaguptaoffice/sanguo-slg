-- R3-S1: 校场按兵种保存的集火/坚守战术预设。
CREATE TABLE IF NOT EXISTS city_tactic (
    server_id   INT    NOT NULL,
    city_id     BIGINT NOT NULL,
    troop_type  SMALLINT NOT NULL CHECK (troop_type >= 0 AND troop_type <= 3),
    target_type SMALLINT NOT NULL CHECK (target_type >= -1 AND target_type <= 3),
    hold        BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (server_id, city_id, troop_type)
);
COMMENT ON TABLE city_tactic IS '校场战术：troop_type 0步1骑2弓3器械；target_type -1默认';
