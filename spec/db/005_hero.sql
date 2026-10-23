-- domain: hero（玩家将领）

CREATE TABLE player_hero (
    server_id       INT          NOT NULL,
    hero_id         BIGINT       NOT NULL,
    player_id       BIGINT       NOT NULL,
    template_cfg_id INT          NOT NULL,
    level           INT          NOT NULL DEFAULT 1,
    exp             BIGINT       NOT NULL DEFAULT 0,
    loyalty         INT          NOT NULL DEFAULT 100 CHECK (loyalty BETWEEN 0 AND 100),
    force           INT          NOT NULL DEFAULT 0,
    intel           INT          NOT NULL DEFAULT 0,
    politics        INT          NOT NULL DEFAULT 0,
    command         INT          NOT NULL DEFAULT 0,
    status          SMALLINT     NOT NULL DEFAULT 1, -- 1=空闲 2=驻守 3=出征 4=历练
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, hero_id)
);
CREATE INDEX idx_player_hero_owner ON player_hero (server_id, player_id);
CREATE UNIQUE INDEX uq_player_hero_template_once ON player_hero (server_id, player_id, template_cfg_id);
COMMENT ON TABLE player_hero IS '玩家拥有的将领实例，四维为当前值（含装备加成后落库）';
COMMENT ON COLUMN player_hero.loyalty IS '低于阈值可能叛逃，规则见 spec/rules';

CREATE TABLE hero_skill (
    server_id       INT          NOT NULL,
    hero_id         BIGINT       NOT NULL,
    skill_cfg_id    INT          NOT NULL,
    level           INT          NOT NULL DEFAULT 1,
    PRIMARY KEY (server_id, hero_id, skill_cfg_id)
);
COMMENT ON TABLE hero_skill IS '将领已学技能及等级';

CREATE TABLE hero_assignment (
    server_id       INT          NOT NULL,
    hero_id         BIGINT       NOT NULL,
    assign_type     SMALLINT     NOT NULL, -- 1=城池 2=军团
    target_id       BIGINT       NOT NULL,
    assigned_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, hero_id)
);
CREATE INDEX idx_hero_assignment_target ON hero_assignment (server_id, assign_type, target_id);
COMMENT ON TABLE hero_assignment IS '将领派驻：一城/军至多一名主将等规则在应用层校验';
