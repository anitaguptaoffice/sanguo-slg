-- R5-S3: 世界阶段解锁与阶段奖励。

CREATE TABLE IF NOT EXISTS cfg_world_phase (
    phase              SMALLINT PRIMARY KEY CHECK (phase BETWEEN 1 AND 3),
    name               VARCHAR(32) NOT NULL,
    unlock_desc        VARCHAR(160) NOT NULL,
    reward_gold        BIGINT NOT NULL DEFAULT 0,
    reward_prestige    BIGINT NOT NULL DEFAULT 0,
    reward_item_cfg_id INT REFERENCES cfg_item(item_cfg_id),
    reward_item_count  INT NOT NULL DEFAULT 0
);
COMMENT ON TABLE cfg_world_phase IS '世界阶段：解锁说明与全服玩家可领取的阶段奖励';

CREATE TABLE IF NOT EXISTS world_phase_claim (
    server_id  INT    NOT NULL,
    player_id  BIGINT NOT NULL,
    phase      SMALLINT NOT NULL REFERENCES cfg_world_phase(phase),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id, phase)
);

INSERT INTO cfg_world_phase(phase,name,unlock_desc,reward_gold,reward_prestige,reward_item_cfg_id,reward_item_count) VALUES
 (1,'讨平黄巾','开放县城国战与黄巾战役。',0,0,NULL,0),
 (2,'群雄割据','开放郡城、州城国战与州郡税赋。',500,50,2061,1),
 (3,'问鼎洛阳','开放洛阳国战与虎豹骑招募。',1500,150,2060,2)
ON CONFLICT (phase) DO UPDATE SET name=EXCLUDED.name,unlock_desc=EXCLUDED.unlock_desc,
 reward_gold=EXCLUDED.reward_gold,reward_prestige=EXCLUDED.reward_prestige,
 reward_item_cfg_id=EXCLUDED.reward_item_cfg_id,reward_item_count=EXCLUDED.reward_item_count;

ALTER TABLE cfg_special_city ADD COLUMN IF NOT EXISTS min_phase SMALLINT NOT NULL DEFAULT 1;
UPDATE cfg_special_city SET min_phase = CASE
    WHEN city_type = 4 THEN 3
    WHEN city_type IN (2,3) THEN 2
    ELSE 1 END;
COMMENT ON COLUMN cfg_special_city.min_phase IS '攻击该名城所需世界阶段';
