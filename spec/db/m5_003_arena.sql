-- R5-S2: 沙场比武对手与每日切磋奖励。

CREATE TABLE IF NOT EXISTS cfg_arena_opponent (
    opponent_id        INT          PRIMARY KEY,
    name               VARCHAR(32)  NOT NULL,
    troop_cap          INT          NOT NULL CHECK (troop_cap > 0),
    defender           JSONB        NOT NULL,
    defender_hero_name VARCHAR(32)  NOT NULL,
    defender_level     INT          NOT NULL DEFAULT 1,
    defender_force     INT          NOT NULL DEFAULT 0,
    defender_intel     INT          NOT NULL DEFAULT 0,
    wall_level         INT          NOT NULL DEFAULT 0,
    wall_tower         INT          NOT NULL DEFAULT 0,
    reward_gold        BIGINT       NOT NULL DEFAULT 0,
    reward_prestige    BIGINT       NOT NULL DEFAULT 0,
    reward_item_cfg_id INT          REFERENCES cfg_item(item_cfg_id),
    reward_item_count  INT          NOT NULL DEFAULT 0
);
COMMENT ON TABLE cfg_arena_opponent IS '沙场比武对手：借调兵力切磋，不损耗真实部队';

CREATE TABLE IF NOT EXISTS player_arena_reward (
    server_id   INT    NOT NULL,
    player_id   BIGINT NOT NULL,
    opponent_id INT    NOT NULL REFERENCES cfg_arena_opponent(opponent_id),
    claim_date  DATE   NOT NULL,
    PRIMARY KEY (server_id, player_id, opponent_id, claim_date)
);

INSERT INTO cfg_arena_opponent(opponent_id,name,troop_cap,defender,defender_hero_name,defender_level,
 defender_force,defender_intel,wall_level,wall_tower,reward_gold,reward_prestige,reward_item_cfg_id,reward_item_count) VALUES
 (1,'黄巾渠帅',3000,'{"1":1200,"3":600}','黄巾渠帅',8,90,80,0,0,200,20,NULL,0),
 (2,'西凉骁将',8000,'{"2":2400,"3":1400}','西凉骁将',16,200,140,3,30,500,50,2061,1),
 (3,'虎卫统领',15000,'{"1":4200,"2":2000,"3":1800}','虎卫统领',24,340,240,5,70,1000,100,2060,1)
ON CONFLICT (opponent_id) DO UPDATE SET name=EXCLUDED.name,troop_cap=EXCLUDED.troop_cap,defender=EXCLUDED.defender,
 defender_hero_name=EXCLUDED.defender_hero_name,defender_level=EXCLUDED.defender_level,defender_force=EXCLUDED.defender_force,
 defender_intel=EXCLUDED.defender_intel,wall_level=EXCLUDED.wall_level,wall_tower=EXCLUDED.wall_tower,
 reward_gold=EXCLUDED.reward_gold,reward_prestige=EXCLUDED.reward_prestige,
 reward_item_cfg_id=EXCLUDED.reward_item_cfg_id,reward_item_count=EXCLUDED.reward_item_count;
