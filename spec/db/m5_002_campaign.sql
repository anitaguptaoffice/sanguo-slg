-- R5-S2: 历史剧情战役与沙场比武奖励道具。

INSERT INTO cfg_item(item_cfg_id,code,name,item_type,max_stack,meta) VALUES
 (2060,'blueprint_advanced','高阶装备图纸',1,99,'{"description":"高阶装备图纸：战役首通奖励。"}'),
 (2061,'gem_chest','宝珠匣',1,99,'{"description":"宝珠匣：开启后获得高阶宝珠。"}')
ON CONFLICT (item_cfg_id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,item_type=EXCLUDED.item_type,
 max_stack=EXCLUDED.max_stack,meta=EXCLUDED.meta;

CREATE TABLE IF NOT EXISTS cfg_campaign_stage (
    stage_id           INT          PRIMARY KEY,
    code               VARCHAR(32)  NOT NULL UNIQUE,
    name               VARCHAR(32)  NOT NULL,
    chapter            SMALLINT     NOT NULL CHECK (chapter BETWEEN 1 AND 4),
    stage_order        SMALLINT     NOT NULL CHECK (stage_order > 0),
    prev_stage_id      INT          REFERENCES cfg_campaign_stage(stage_id),
    troop_cap          INT          NOT NULL CHECK (troop_cap > 0),
    defender           JSONB        NOT NULL,
    defender_hero_name VARCHAR(32)  NOT NULL,
    defender_level     INT          NOT NULL DEFAULT 1,
    defender_force     INT          NOT NULL DEFAULT 0,
    defender_intel     INT          NOT NULL DEFAULT 0,
    wall_level         INT          NOT NULL DEFAULT 0,
    wall_tower         INT          NOT NULL DEFAULT 0,
    rewards            JSONB        NOT NULL DEFAULT '{}',
    UNIQUE (chapter, stage_order)
);
COMMENT ON TABLE cfg_campaign_stage IS '历史战役关卡：黄巾/讨董/官渡/赤壁；攻方使用借调兵力不损耗真实部队';

CREATE TABLE IF NOT EXISTS player_campaign_progress (
    server_id  INT    NOT NULL,
    player_id  BIGINT NOT NULL,
    stage_id   INT    NOT NULL REFERENCES cfg_campaign_stage(stage_id),
    stars      SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    cleared_at TIMESTAMPTZ,
    best_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id, stage_id)
);

CREATE TABLE IF NOT EXISTS player_campaign_reward (
    server_id  INT    NOT NULL,
    player_id  BIGINT NOT NULL,
    stage_id   INT    NOT NULL REFERENCES cfg_campaign_stage(stage_id),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id, stage_id)
);

INSERT INTO cfg_campaign_stage(stage_id,code,name,chapter,stage_order,prev_stage_id,troop_cap,defender,
 defender_hero_name,defender_level,defender_force,defender_intel,wall_level,wall_tower,rewards) VALUES
 (1,'huangjin_guangzong','广宗黄巾',1,1,NULL,4000,'{"1":1700,"3":800}','张角',8,90,110,0,0,
  '{"gold":300,"prestige":60,"items":[{"item_cfg_id":2060,"count":1}]}'),
 (2,'huangjin_wancheng','宛城黄巾',1,2,1,6000,'{"1":2300,"3":1500}','张宝',10,110,120,2,20,
  '{"gold":400,"prestige":80,"items":[{"item_cfg_id":2061,"count":1}]}'),
 (3,'taodong_sishui','汜水关',2,1,2,7000,'{"2":2600,"3":1200,"8":800}','华雄',14,160,100,3,40,
  '{"gold":600,"prestige":120,"items":[{"item_cfg_id":2060,"count":1}]}'),
 (4,'taodong_hulao','虎牢关',2,2,3,9000,'{"1":2800,"2":1800,"3":1400}','吕布',18,240,130,5,80,
  '{"gold":800,"prestige":160,"items":[{"item_cfg_id":2061,"count":1}]}'),
 (5,'guandu_baima','白马坡',3,1,4,10000,'{"2":4200,"3":2800}','颜良',20,260,140,4,60,
  '{"gold":1000,"prestige":200,"items":[{"item_cfg_id":2060,"count":2}]}'),
 (6,'guandu_wuchao','乌巢火攻',3,2,5,12000,'{"1":4200,"2":2300,"3":2000}','淳于琼',18,220,120,4,80,
  '{"gold":1200,"prestige":240,"items":[{"item_cfg_id":2061,"count":2}]}'),
 (7,'chibi_jiangxia','江夏水战',4,1,6,14000,'{"1":4600,"3":3400,"4":2000}','黄祖',22,280,180,5,100,
  '{"gold":1500,"prestige":300,"items":[{"item_cfg_id":2060,"count":2}]}'),
 (8,'chibi_fire','赤壁火攻',4,2,7,18000,'{"1":4500,"2":2800,"3":3200,"4":2000}','曹操',30,420,380,6,140,
  '{"gold":2000,"prestige":400,"items":[{"item_cfg_id":2060,"count":3},{"item_cfg_id":2061,"count":2}]}')
ON CONFLICT (stage_id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,chapter=EXCLUDED.chapter,
 stage_order=EXCLUDED.stage_order,prev_stage_id=EXCLUDED.prev_stage_id,troop_cap=EXCLUDED.troop_cap,
 defender=EXCLUDED.defender,defender_hero_name=EXCLUDED.defender_hero_name,defender_level=EXCLUDED.defender_level,
 defender_force=EXCLUDED.defender_force,defender_intel=EXCLUDED.defender_intel,wall_level=EXCLUDED.wall_level,
 wall_tower=EXCLUDED.wall_tower,rewards=EXCLUDED.rewards;
