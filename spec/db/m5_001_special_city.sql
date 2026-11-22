-- R5-S1: 县城/郡城/州城/洛阳名城与地域精锐兵种。

INSERT INTO cfg_unit(unit_cfg_id,code,name,tier,stats) VALUES
 (13,'xiliang_iron','西凉铁骑',3,'{"atk":26,"def":14,"hp":130,"speed":95,"food_upkeep":3,"troop_type":"cavalry","counter":{"advantage":1.25,"disadvantage":0.8,"neutral":1.0},"counter_edges":[["cavalry","infantry"],["infantry","archer"],["archer","cavalry"]]}'),
 (14,'hubao','虎豹骑',3,'{"atk":30,"def":16,"hp":140,"speed":105,"food_upkeep":3,"troop_type":"cavalry","counter":{"advantage":1.25,"disadvantage":0.8,"neutral":1.0},"counter_edges":[["cavalry","infantry"],["infantry","archer"],["archer","cavalry"]]}'),
 (15,'qingzhou','青州兵',3,'{"atk":20,"def":20,"hp":150,"speed":55,"food_upkeep":2,"troop_type":"infantry","counter":{"advantage":1.25,"disadvantage":0.8,"neutral":1.0},"counter_edges":[["cavalry","infantry"],["infantry","archer"],["archer","cavalry"]]}'),
 (16,'nanman_elephant','南蛮象兵',3,'{"atk":32,"def":12,"hp":200,"speed":45,"food_upkeep":4,"troop_type":"infantry","counter":{"advantage":1.25,"disadvantage":0.8,"neutral":1.0},"counter_edges":[["cavalry","infantry"],["infantry","archer"],["archer","cavalry"]]}'),
 (17,'rattan','藤甲兵',3,'{"atk":18,"def":28,"hp":120,"speed":50,"food_upkeep":2,"troop_type":"infantry","counter":{"advantage":1.25,"disadvantage":0.8,"neutral":1.0},"counter_edges":[["cavalry","infantry"],["infantry","archer"],["archer","cavalry"]]}'),
 (18,'tuji','突骑兵',3,'{"atk":24,"def":10,"hp":110,"speed":120,"food_upkeep":3,"troop_type":"cavalry","counter":{"advantage":1.25,"disadvantage":0.8,"neutral":1.0},"counter_edges":[["cavalry","infantry"],["infantry","archer"],["archer","cavalry"]]}')
ON CONFLICT (unit_cfg_id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,tier=EXCLUDED.tier,stats=EXCLUDED.stats;

CREATE TABLE IF NOT EXISTS cfg_special_city (
    city_cfg_id      INT          PRIMARY KEY,
    city_type        SMALLINT     NOT NULL CHECK (city_type BETWEEN 1 AND 4),
    name             VARCHAR(32)  NOT NULL,
    x                INT          NOT NULL CHECK (x >= 0),
    y                INT          NOT NULL CHECK (y >= 0),
    wall_level       INT          NOT NULL DEFAULT 1,
    hero_name        VARCHAR(32)  NOT NULL,
    hero_level       INT          NOT NULL DEFAULT 1,
    hero_force       INT          NOT NULL DEFAULT 0,
    hero_intel       INT          NOT NULL DEFAULT 0,
    garrison         JSONB        NOT NULL,
    loot             JSONB        NOT NULL DEFAULT '{}',
    recovery_seconds INT          NOT NULL CHECK (recovery_seconds > 0),
    unit_cfg_id      INT          REFERENCES cfg_unit(unit_cfg_id)
);
COMMENT ON TABLE cfg_special_city IS '名城配置：1县城 2郡城 3州城 4都城；unit_cfg_id 为占领后解锁的地域精锐';

CREATE TABLE IF NOT EXISTS special_city_state (
    server_id        INT          NOT NULL,
    city_cfg_id      INT          NOT NULL REFERENCES cfg_special_city(city_cfg_id),
    owner_guild_id   BIGINT       NOT NULL DEFAULT 0,
    garrison         JSONB,
    occupied_at      TIMESTAMPTZ,
    next_recover_at  TIMESTAMPTZ,
    PRIMARY KEY (server_id, city_cfg_id)
);
COMMENT ON TABLE special_city_state IS '名城运行时：占领联盟、当前守军与恢复节奏';

CREATE TABLE IF NOT EXISTS special_city_tax_claim (
    server_id   INT    NOT NULL,
    player_id   BIGINT NOT NULL,
    claim_date  DATE   NOT NULL,
    cities      INT    NOT NULL,
    food        BIGINT NOT NULL,
    wood        BIGINT NOT NULL,
    stone       BIGINT NOT NULL,
    iron        BIGINT NOT NULL,
    gold        BIGINT NOT NULL,
    PRIMARY KEY (server_id, player_id, claim_date)
);

INSERT INTO cfg_special_city(city_cfg_id,city_type,name,x,y,wall_level,hero_name,hero_level,hero_force,hero_intel,garrison,loot,recovery_seconds,unit_cfg_id) VALUES
 (1,1,'陈留县城',120,140,4,'陈留守将',8,120,80,'{"1":2200,"3":700,"5":100}','{"food":4000,"wood":3000,"stone":800,"iron":500,"gold":150}',1800,NULL),
 (2,1,'汝南县城',180,260,4,'汝南守将',9,130,90,'{"1":2400,"3":800,"5":100}','{"food":4200,"wood":3200,"stone":900,"iron":600,"gold":160}',1800,NULL),
 (3,1,'北海县城',310,210,4,'北海守将',8,120,85,'{"1":2200,"3":900,"5":100}','{"food":4000,"wood":3400,"stone":800,"iron":500,"gold":150}',1800,NULL),
 (4,2,'青州郡城',360,220,6,'青州牧',16,220,160,'{"1":4000,"3":1500,"5":500,"8":1000}','{"food":9000,"wood":7000,"stone":2000,"iron":1500,"gold":400}',3600,15),
 (5,2,'南中郡城',200,380,6,'南中蛮王',18,260,120,'{"1":4500,"3":1000,"5":500}','{"food":9000,"wood":6000,"stone":2500,"iron":1200,"gold":400}',3600,16),
 (6,3,'长安州城',150,180,8,'西凉刺史',24,340,240,'{"1":6000,"2":2200,"3":1800,"9":1000}','{"food":16000,"wood":12000,"stone":4000,"iron":3000,"gold":800}',5400,13),
 (7,3,'幽州州城',340,90,8,'幽州刺史',24,330,230,'{"1":5500,"2":2400,"3":2100}','{"food":15000,"wood":13000,"stone":3500,"iron":3200,"gold":800}',5400,18),
 (8,4,'洛阳',250,250,12,'董卓',35,520,420,'{"1":9000,"2":5000,"3":4000,"4":2000,"9":2000}','{"food":30000,"wood":24000,"stone":9000,"iron":8000,"gold":2000}',7200,14)
ON CONFLICT (city_cfg_id) DO UPDATE SET city_type=EXCLUDED.city_type,name=EXCLUDED.name,x=EXCLUDED.x,y=EXCLUDED.y,
 wall_level=EXCLUDED.wall_level,hero_name=EXCLUDED.hero_name,hero_level=EXCLUDED.hero_level,hero_force=EXCLUDED.hero_force,
 hero_intel=EXCLUDED.hero_intel,garrison=EXCLUDED.garrison,loot=EXCLUDED.loot,recovery_seconds=EXCLUDED.recovery_seconds,unit_cfg_id=EXCLUDED.unit_cfg_id;

-- 藤甲兵以永昌小城解锁，避免与南中郡城冲突。
INSERT INTO cfg_special_city(city_cfg_id,city_type,name,x,y,wall_level,hero_name,hero_level,hero_force,hero_intel,garrison,loot,recovery_seconds,unit_cfg_id) VALUES
 (9,1,'永昌藤甲寨',170,420,5,'兀突骨',14,200,110,'{"1":2600,"3":900,"5":200}','{"food":5000,"wood":4000,"stone":1200,"iron":700,"gold":200}',2400,17)
ON CONFLICT (city_cfg_id) DO UPDATE SET name=EXCLUDED.name,unit_cfg_id=EXCLUDED.unit_cfg_id;
