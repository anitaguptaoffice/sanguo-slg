-- domain: content（静态配置 + 玩家背包/任务）

-- 静态配置表全局共享，版本由 content 管线发布
CREATE TABLE cfg_item (
    item_cfg_id     INT          PRIMARY KEY,
    code            VARCHAR(64)  NOT NULL UNIQUE,
    name            VARCHAR(64)  NOT NULL,
    item_type       SMALLINT     NOT NULL,
    max_stack       INT          NOT NULL DEFAULT 1,
    meta            JSONB        NOT NULL DEFAULT '{}'
);
COMMENT ON TABLE cfg_item IS '道具定义：名称、类型、堆叠上限';

CREATE TABLE cfg_hero_template (
    template_cfg_id INT          PRIMARY KEY,
    code            VARCHAR(64)  NOT NULL UNIQUE,
    name            VARCHAR(64)  NOT NULL,
    rarity          SMALLINT     NOT NULL,
    base_stats      JSONB        NOT NULL DEFAULT '{}'
);
COMMENT ON TABLE cfg_hero_template IS '将领模板：稀有度与初始属性';

CREATE TABLE cfg_unit (
    unit_cfg_id     INT          PRIMARY KEY,
    code            VARCHAR(64)  NOT NULL UNIQUE,
    name            VARCHAR(64)  NOT NULL,
    tier            SMALLINT     NOT NULL,
    stats           JSONB        NOT NULL DEFAULT '{}'
);
COMMENT ON TABLE cfg_unit IS '兵种配置：阶级与战斗属性';

CREATE TABLE cfg_quest (
    quest_cfg_id    INT          PRIMARY KEY,
    code            VARCHAR(64)  NOT NULL UNIQUE,
    quest_type      SMALLINT     NOT NULL,
    rewards         JSONB        NOT NULL DEFAULT '{}'
);
COMMENT ON TABLE cfg_quest IS '任务定义：类型与奖励包';

CREATE TABLE player_item (
    server_id       INT          NOT NULL,
    player_id       BIGINT       NOT NULL,
    item_cfg_id     INT          NOT NULL,
    quantity        INT          NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (server_id, player_id, item_cfg_id)
);
COMMENT ON TABLE player_item IS '玩家背包道具数量';

CREATE TABLE player_quest (
    server_id       INT          NOT NULL,
    player_id       BIGINT       NOT NULL,
    quest_cfg_id    INT          NOT NULL,
    state           SMALLINT     NOT NULL DEFAULT 0, -- 0=未接 1=进行 2=可领 3=完成
    progress        JSONB        NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id, quest_cfg_id)
);
CREATE INDEX idx_player_quest_active ON player_quest (server_id, player_id, state)
    WHERE state IN (1, 2);
COMMENT ON TABLE player_quest IS '任务进度：progress 存计数器与阶段';
