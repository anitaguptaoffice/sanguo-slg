-- domain: world（地图与城池，按 server_id 隔离）

CREATE TABLE map_cell (
    server_id       INT          NOT NULL,
    x               INT          NOT NULL,
    y               INT          NOT NULL,
    terrain         SMALLINT     NOT NULL, -- 地形枚举：平原/山地/水域等
    resource_type   SMALLINT,              -- 可采集资源类型，空地 NULL
    resource_level  SMALLINT     NOT NULL DEFAULT 0,
    PRIMARY KEY (server_id, x, y)
);
COMMENT ON TABLE map_cell IS '静态地图格：地形与资源点定义，开服时灌入';
COMMENT ON COLUMN map_cell.terrain IS '影响行军速度与是否可建城';

CREATE TABLE player_city (
    server_id       INT          NOT NULL,
    city_id         BIGINT       NOT NULL,
    player_id       BIGINT       NOT NULL,
    name            VARCHAR(32)  NOT NULL,
    x               INT          NOT NULL,
    y               INT          NOT NULL,
    is_capital      BOOLEAN      NOT NULL DEFAULT false,
    wall_level      INT          NOT NULL DEFAULT 1,
    morale          INT          NOT NULL DEFAULT 100,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, city_id),
    UNIQUE (server_id, x, y)
);
CREATE INDEX idx_player_city_owner ON player_city (server_id, player_id);
COMMENT ON TABLE player_city IS '玩家城池实例：坐标占用与城防概览';
COMMENT ON COLUMN player_city.is_capital IS '主城不可被放弃，迁城规则在 rules 域定义';

CREATE TABLE resource_node_state (
    server_id       INT          NOT NULL,
    x               INT          NOT NULL,
    y               INT          NOT NULL,
    occupier_player_id BIGINT,
    gather_rate     INT          NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, x, y)
);
CREATE INDEX idx_resource_node_occupier ON resource_node_state (server_id, occupier_player_id)
    WHERE occupier_player_id IS NOT NULL;
COMMENT ON TABLE resource_node_state IS '野地占领态：谁占、采集效率，与 map_cell 坐标对齐';
