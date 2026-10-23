-- domain: military（兵力、行军、战报）

CREATE TABLE city_troop (
    server_id       INT          NOT NULL,
    city_id         BIGINT       NOT NULL,
    unit_cfg_id     INT          NOT NULL,
    count           INT          NOT NULL DEFAULT 0 CHECK (count >= 0),
    wounded         INT          NOT NULL DEFAULT 0 CHECK (wounded >= 0),
    PRIMARY KEY (server_id, city_id, unit_cfg_id)
);
COMMENT ON TABLE city_troop IS '城池驻防与城内待命兵力';

CREATE TABLE field_army (
    server_id       INT          NOT NULL,
    army_id         BIGINT       NOT NULL,
    owner_player_id BIGINT       NOT NULL,
    status          SMALLINT     NOT NULL DEFAULT 1, -- 1=驻扎 2=行军 3=战斗
    x               INT          NOT NULL,
    y               INT          NOT NULL,
    hero_ids        BIGINT[]     NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, army_id)
);
CREATE INDEX idx_field_army_owner ON field_army (server_id, owner_player_id);
COMMENT ON TABLE field_army IS '野外军团实体位置与状态';
COMMENT ON COLUMN field_army.hero_ids IS '随行将领 ID 列表，详表见 hero 域';

CREATE TABLE army_troop (
    server_id       INT          NOT NULL,
    army_id         BIGINT       NOT NULL,
    unit_cfg_id     INT          NOT NULL,
    count           INT          NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (server_id, army_id, unit_cfg_id)
);
COMMENT ON TABLE army_troop IS '军团编制：与 field_army 同生命周期';

CREATE TABLE march_order (
    server_id       INT          NOT NULL,
    march_id        BIGINT       NOT NULL,
    army_id         BIGINT       NOT NULL,
    from_x          INT          NOT NULL,
    from_y          INT          NOT NULL,
    to_x            INT          NOT NULL,
    to_y            INT          NOT NULL,
    purpose         SMALLINT     NOT NULL, -- 1=攻击 2=增援 3=采集 ...
    depart_at       TIMESTAMPTZ  NOT NULL,
    arrive_at       TIMESTAMPTZ  NOT NULL,
    status          SMALLINT     NOT NULL DEFAULT 1, -- 1=进行中 2=到达 3=撤回
    path            JSONB        NOT NULL DEFAULT '[]',
    PRIMARY KEY (server_id, march_id)
);
CREATE INDEX idx_march_arrive ON march_order (server_id, status, arrive_at)
    WHERE status = 1;
COMMENT ON TABLE march_order IS '行军订单：到期由调度服触发战斗或占领';

CREATE TABLE battle_report (
    server_id       INT          NOT NULL,
    report_id       BIGINT       NOT NULL,
    attacker_player_id BIGINT    NOT NULL,
    defender_player_id BIGINT,
    defender_city_id BIGINT,
    location_x      INT          NOT NULL,
    location_y      INT          NOT NULL,
    outcome         SMALLINT     NOT NULL, -- 1=攻胜 2=守胜 3=平局
    detail          JSONB        NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, report_id)
);
CREATE INDEX idx_battle_report_time ON battle_report (server_id, created_at DESC);
CREATE INDEX idx_battle_report_attacker ON battle_report (server_id, attacker_player_id, created_at DESC);
COMMENT ON TABLE battle_report IS '战报归档：detail 存回合摘要，大服可按 created_at 分区';
