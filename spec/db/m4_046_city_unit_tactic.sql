-- R3-S1: 校场按 12 个具体兵种保存的集火/坚守战术预设。
CREATE TABLE IF NOT EXISTS city_unit_tactic (
    server_id   INT    NOT NULL,
    city_id     BIGINT NOT NULL,
    unit_cfg_id SMALLINT NOT NULL CHECK (unit_cfg_id >= 1 AND unit_cfg_id <= 12),
    target_type SMALLINT NOT NULL CHECK (target_type >= -1 AND target_type <= 3),
    hold        BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (server_id, city_id, unit_cfg_id)
);
COMMENT ON TABLE city_unit_tactic IS '校场战术：unit_cfg_id 1..12；target_type -1默认';
