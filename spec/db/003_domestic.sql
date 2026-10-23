-- domain: domestic（内政：资源、建筑、科技、队列）

CREATE TABLE player_wallet (
    server_id       INT          NOT NULL,
    player_id       BIGINT       NOT NULL,
    food            BIGINT       NOT NULL DEFAULT 0,
    wood            BIGINT       NOT NULL DEFAULT 0,
    iron            BIGINT       NOT NULL DEFAULT 0,
    stone           BIGINT       NOT NULL DEFAULT 0,
    gold            BIGINT       NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id)
);
COMMENT ON TABLE player_wallet IS '玩家五资+金币钱包，落库为刷盘快照';

CREATE TABLE city_building (
    server_id       INT          NOT NULL,
    city_id         BIGINT       NOT NULL,
    slot_key        VARCHAR(32)  NOT NULL, -- 槽位或建筑实例键
    building_cfg_id INT          NOT NULL,
    level           INT          NOT NULL DEFAULT 1,
    upgrade_finish_at TIMESTAMPTZ,
    PRIMARY KEY (server_id, city_id, slot_key)
);
CREATE INDEX idx_city_building_cfg ON city_building (server_id, building_cfg_id);
COMMENT ON TABLE city_building IS '城池建筑等级与升级完成时间';
COMMENT ON COLUMN city_building.upgrade_finish_at IS 'NULL 表示未在升级';

CREATE TABLE player_research (
    server_id       INT          NOT NULL,
    player_id       BIGINT       NOT NULL,
    tech_cfg_id     INT          NOT NULL,
    level           INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (server_id, player_id, tech_cfg_id)
);
COMMENT ON TABLE player_research IS '玩家科技树进度';

CREATE TABLE work_queue (
    server_id       INT          NOT NULL,
    queue_id        BIGINT       NOT NULL,
    player_id       BIGINT       NOT NULL,
    city_id         BIGINT,
    queue_type      SMALLINT     NOT NULL, -- 1=建造 2=科研 3=生产 ...
    payload         JSONB        NOT NULL DEFAULT '{}',
    start_at        TIMESTAMPTZ  NOT NULL,
    finish_at       TIMESTAMPTZ  NOT NULL,
    status          SMALLINT     NOT NULL DEFAULT 0, -- 0=排队 1=进行 2=完成 3=取消
    PRIMARY KEY (server_id, queue_id)
);
CREATE INDEX idx_work_queue_due ON work_queue (server_id, status, finish_at)
    WHERE status IN (0, 1);
CREATE INDEX idx_work_queue_player ON work_queue (server_id, player_id);
COMMENT ON TABLE work_queue IS '定时事件队列持久化副本，调度以 Redis/NATS 为主';
