-- R4-S3: 玩家城池免战保护、民怨、统治度与掠夺/占领状态。
ALTER TABLE player_city ADD COLUMN IF NOT EXISTS protection_until TIMESTAMPTZ;
ALTER TABLE player_city ADD COLUMN IF NOT EXISTS complaint INT NOT NULL DEFAULT 0;
ALTER TABLE player_city ADD COLUMN IF NOT EXISTS rule INT NOT NULL DEFAULT 100;
UPDATE player_city SET protection_until=now()+interval '7 days' WHERE protection_until IS NULL AND is_capital;
COMMENT ON COLUMN player_city.protection_until IS '新手/免战牌保护截止；期间不可被攻击';
COMMENT ON COLUMN player_city.complaint IS '民怨 0..100，被掠夺上升';
COMMENT ON COLUMN player_city.rule IS '统治度 0..100，被占领战削减，归零易主';
