-- domain: hero — 客栈招将池（HERO-hotel-001，对齐 legacy sys_recruit_hero）

CREATE TABLE city_hotel_recruit (
    server_id       INT          NOT NULL,
    city_id         BIGINT       NOT NULL,
    candidate_id    BIGINT       NOT NULL,
    display_name    VARCHAR(64)  NOT NULL,
    sex             SMALLINT     NOT NULL DEFAULT 1,
    face_id         INT          NOT NULL DEFAULT 0,
    level           INT          NOT NULL,
    force_base      INT          NOT NULL,
    intel_base      INT          NOT NULL,
    politics_base   INT          NOT NULL,
    command_base    INT          NOT NULL DEFAULT 0,
    force_add       INT          NOT NULL DEFAULT 0,
    intel_add       INT          NOT NULL DEFAULT 0,
    politics_add    INT          NOT NULL DEFAULT 0,
    loyalty         INT          NOT NULL DEFAULT 70,
    gold_cost       BIGINT       NOT NULL,
    generated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, city_id, candidate_id)
);
CREATE INDEX idx_city_hotel_recruit_city ON city_hotel_recruit (server_id, city_id, generated_at);
COMMENT ON TABLE city_hotel_recruit IS '城池客栈可招募候选（原版 sys_recruit_hero 子集）';

CREATE TABLE city_hotel_schedule (
    server_id           INT          NOT NULL,
    city_id             BIGINT       NOT NULL,
    last_pool_tick_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, city_id)
);
COMMENT ON TABLE city_hotel_schedule IS '客栈池定时刷新锚点（对齐 mem_city_schedule.last_reset_recruit）';

ALTER TABLE player_hero
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(64);
COMMENT ON COLUMN player_hero.display_name IS '客栈随机将等无模板名时的展示名；template_cfg_id=0 时使用';

DROP INDEX IF EXISTS uq_player_hero_template_once;
CREATE UNIQUE INDEX uq_player_hero_template_once
    ON player_hero (server_id, player_id, template_cfg_id)
    WHERE template_cfg_id > 0;
