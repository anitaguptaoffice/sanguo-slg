-- R3-S3: 历史名将全服唯一实例、传闻发现与招降状态。
CREATE TABLE IF NOT EXISTS historical_hero (
    server_id       INT    NOT NULL,
    npc_cfg_id      INT    NOT NULL,
    template_cfg_id INT    NOT NULL,
    display_name    VARCHAR(32) NOT NULL,
    level           INT    NOT NULL DEFAULT 40,
    force           INT    NOT NULL,
    intel           INT    NOT NULL,
    politics        INT    NOT NULL,
    command         INT    NOT NULL,
    x               INT    NOT NULL,
    y               INT    NOT NULL,
    state           SMALLINT NOT NULL DEFAULT 0 CHECK (state >= 0 AND state <= 3),
    owner_player_id BIGINT,
    city_id         BIGINT,
    hero_id         BIGINT,
    friend          INT    NOT NULL DEFAULT 0,
    last_persuade_at TIMESTAMPTZ,
    captured_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, npc_cfg_id)
);
ALTER TABLE historical_hero ADD COLUMN IF NOT EXISTS hero_id BIGINT;
COMMENT ON TABLE historical_hero IS '历史名将全服唯一：0在野 1被俘 2归顺 3叛逃';

INSERT INTO historical_hero(server_id,npc_cfg_id,template_cfg_id,display_name,level,force,intel,politics,command,x,y,state)
VALUES
 (1,1001,1001,'刘备',40,72,75,88,78,65,65,0),
 (1,1002,1002,'关羽',40,95,62,55,82,68,68,0),
 (1,1003,1003,'张飞',40,98,40,35,75,72,72,0),
 (1,1004,1004,'赵云',40,96,70,60,85,78,78,0)
ON CONFLICT (server_id,npc_cfg_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS player_hero_rumor (
    server_id    INT    NOT NULL,
    player_id    BIGINT NOT NULL,
    npc_cfg_id   INT    NOT NULL,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id, npc_cfg_id)
);
COMMENT ON TABLE player_hero_rumor IS '客栈传闻发现的历史名将坐标';
