-- R5-S3: 史诗成就、世界进程阶段与名城占领计数。

CREATE TABLE IF NOT EXISTS cfg_achievement (
    achievement_id INT          PRIMARY KEY,
    code           VARCHAR(48)  NOT NULL UNIQUE,
    name           VARCHAR(48)  NOT NULL,
    description    VARCHAR(160) NOT NULL,
    category       SMALLINT     NOT NULL CHECK (category BETWEEN 1 AND 4),
    metric         VARCHAR(32)  NOT NULL,
    threshold      BIGINT       NOT NULL CHECK (threshold > 0),
    rewards        JSONB        NOT NULL DEFAULT '{}'
);
COMMENT ON TABLE cfg_achievement IS '成就配置：metric 由服务端实时求值，首达阈值后可领取一次';

CREATE TABLE IF NOT EXISTS player_achievement (
    server_id      INT    NOT NULL,
    player_id      BIGINT NOT NULL,
    achievement_id INT    NOT NULL REFERENCES cfg_achievement(achievement_id),
    claimed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS player_special_capture (
    server_id INT    NOT NULL,
    player_id BIGINT NOT NULL,
    captures  BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (server_id, player_id)
);

CREATE TABLE IF NOT EXISTS world_phase_state (
    server_id  INT    PRIMARY KEY,
    phase      SMALLINT NOT NULL DEFAULT 1 CHECK (phase BETWEEN 1 AND 3),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE world_phase_state IS '世界进程：1讨平黄巾 2群雄割据 3问鼎洛阳';

INSERT INTO cfg_achievement(achievement_id,code,name,description,category,metric,threshold,rewards) VALUES
 (1,'prestige_100','初露锋芒','声望达到 100。',1,'prestige',100,'{"gold":300,"prestige":50,"items":[{"item_cfg_id":2060,"count":1}]}'),
 (2,'prestige_500','声名鹊起','声望达到 500。',1,'prestige',500,'{"gold":800,"prestige":120,"items":[{"item_cfg_id":2061,"count":1}]}'),
 (3,'prestige_2000','名震一方','声望达到 2000。',1,'prestige',2000,'{"gold":2000,"prestige":300,"items":[{"item_cfg_id":2060,"count":2}]}'),
 (4,'campaign_2','黄巾克星','通关 2 个历史战役关卡。',2,'campaign_cleared',2,'{"gold":500,"prestige":80,"items":[{"item_cfg_id":2061,"count":1}]}'),
 (5,'campaign_8','百战名将','通关全部 8 个历史战役关卡。',2,'campaign_cleared',8,'{"gold":3000,"prestige":500,"items":[{"item_cfg_id":2060,"count":3}]}'),
 (6,'capture_1','攻城拔寨','首次攻占名城。',3,'special_captures',1,'{"gold":600,"prestige":100,"items":[{"item_cfg_id":2060,"count":1}]}'),
 (7,'capture_3','连下三城','累计攻占 3 座名城。',3,'special_captures',3,'{"gold":1800,"prestige":260,"items":[{"item_cfg_id":2061,"count":2}]}'),
 (8,'arena_10','比武状元','累计获得 10 次沙场比武首胜。',4,'arena_rewards',10,'{"gold":1500,"prestige":200,"items":[{"item_cfg_id":2061,"count":2}]}'),
 (9,'luoyang','问鼎洛阳','所在联盟占领洛阳。',3,'luoyang_owned',1,'{"gold":5000,"prestige":800,"items":[{"item_cfg_id":2060,"count":5}]}'),
 (10,'guild_cities_3','雄踞州郡','所在联盟占领 3 座名城。',3,'guild_cities',3,'{"gold":2500,"prestige":400,"items":[{"item_cfg_id":2061,"count":3}]}')
ON CONFLICT (achievement_id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,description=EXCLUDED.description,
 category=EXCLUDED.category,metric=EXCLUDED.metric,threshold=EXCLUDED.threshold,rewards=EXCLUDED.rewards;
