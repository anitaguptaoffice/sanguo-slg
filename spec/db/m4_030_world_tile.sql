-- R1-S1: promote map_cell to the full 8-terrain world tile.
--
-- terrain now follows the original world type scale:
--   0=city 1=plain 2=desert 3=forest 4=grass 5=mountain 6=lake 7=swamp
-- Older databases only stored 0=plain, 1=mountain, 2=water, so remap those
-- once. ApplySpecs records this migration, so the remap never runs twice.

ALTER TABLE map_cell ADD COLUMN IF NOT EXISTS level SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE map_cell ADD COLUMN IF NOT EXISTS max_level SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE map_cell ADD COLUMN IF NOT EXISTS province_id SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE map_cell ADD COLUMN IF NOT EXISTS owner_city_id BIGINT;
ALTER TABLE map_cell ADD COLUMN IF NOT EXISTS npc_kind SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE map_cell ADD COLUMN IF NOT EXISTS garrison_json JSONB;
ALTER TABLE map_cell ADD COLUMN IF NOT EXISTS recover_at TIMESTAMPTZ;

UPDATE map_cell
SET terrain = CASE terrain WHEN 0 THEN 1 WHEN 1 THEN 5 WHEN 2 THEN 6 ELSE terrain END
WHERE terrain IN (0, 1, 2);

DO $migration$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'map_cell_level_check' AND conrelid = 'map_cell'::pg_catalog.regclass) THEN
        ALTER TABLE map_cell ADD CONSTRAINT map_cell_level_check CHECK (level BETWEEN 1 AND 10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'map_cell_max_level_check' AND conrelid = 'map_cell'::pg_catalog.regclass) THEN
        ALTER TABLE map_cell ADD CONSTRAINT map_cell_max_level_check CHECK (max_level BETWEEN 1 AND 10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'map_cell_npc_kind_check' AND conrelid = 'map_cell'::pg_catalog.regclass) THEN
        ALTER TABLE map_cell ADD CONSTRAINT map_cell_npc_kind_check CHECK (npc_kind IN (0, 1));
    END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_map_cell_owner_city ON map_cell (server_id, owner_city_id)
    WHERE owner_city_id IS NOT NULL;

COMMENT ON COLUMN map_cell.terrain IS '0=城池 1=平地 2=荒漠 3=森林 4=草原 5=山地 6=湖泊 7=沼泽';
COMMENT ON COLUMN map_cell.level IS '野地等级 1..10';
COMMENT ON COLUMN map_cell.province_id IS '州郡编号 1..14';
COMMENT ON COLUMN map_cell.owner_city_id IS '占据此格的玩家城池，NULL 为无主';
COMMENT ON COLUMN map_cell.npc_kind IS '0=普通野地 1=黄巾营寨';
COMMENT ON COLUMN map_cell.garrison_json IS '战斗后的残余守军；NULL 表示按配置满编';
COMMENT ON COLUMN map_cell.recover_at IS '守军恢复时间；NULL 表示无需恢复';
