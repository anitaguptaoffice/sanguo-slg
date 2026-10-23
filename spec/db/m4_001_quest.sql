-- domain: content / quest（M4 任务链扩展）
-- 依赖 SPEC-001 player、006_content cfg_quest / player_quest；跨域不设 FK。

ALTER TABLE cfg_quest
    ADD COLUMN IF NOT EXISTS chain_id           INT,
    ADD COLUMN IF NOT EXISTS prev_quest_cfg_id  INT,
    ADD COLUMN IF NOT EXISTS sort_in_chain      SMALLINT     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS objectives         JSONB        NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS unlock_level       INT          NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS repeatable         BOOLEAN      NOT NULL DEFAULT false;

COMMENT ON COLUMN cfg_quest.chain_id IS '任务链分组 id；同链内 sort_in_chain 升序展示';
COMMENT ON COLUMN cfg_quest.prev_quest_cfg_id IS '前置任务 cfg id；NULL 表示链首或独立任务';
COMMENT ON COLUMN cfg_quest.objectives IS '目标定义 JSON 数组，如 [{\"type\":\"build_level\",\"building_cfg_id\":1,\"level\":2}]';
COMMENT ON COLUMN cfg_quest.rewards IS '奖励包：{\"items\":[{\"item_cfg_id\":2001,\"qty\":1}],\"resources\":{\"food\":1000}}';
COMMENT ON COLUMN cfg_quest.repeatable IS '是否可重复接取；重复时完成后重置 state 与 progress';

CREATE INDEX IF NOT EXISTS idx_cfg_quest_chain
    ON cfg_quest (chain_id, sort_in_chain)
    WHERE chain_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cfg_quest_prev
    ON cfg_quest (prev_quest_cfg_id)
    WHERE prev_quest_cfg_id IS NOT NULL;

ALTER TABLE player_quest
    ADD COLUMN IF NOT EXISTS accepted_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reward_claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN player_quest.state IS '0=未接 1=进行 2=可领 3=完成（已领奖或无需领奖）';
COMMENT ON COLUMN player_quest.progress IS '计数器 JSON，键与 cfg_quest.objectives 对应';
COMMENT ON COLUMN player_quest.accepted_at IS '接取时间；未接时为 NULL';
COMMENT ON COLUMN player_quest.completed_at IS '目标达成时间；可领前写入';
COMMENT ON COLUMN player_quest.reward_claimed_at IS '领奖时间；走发奖队列成功后写入';

CREATE INDEX IF NOT EXISTS idx_player_quest_chain_lookup
    ON player_quest (server_id, player_id, quest_cfg_id)
    INCLUDE (state);

COMMENT ON COLUMN cfg_item.item_type IS '1=资源包 2=加速 3=招募 4=训练兵力；商城扣费道具见 cfg_shop_offer.price';
COMMENT ON COLUMN cfg_item.meta IS '按 item_type 解析：grants、speedup_sec、hero_pool、unit_code 等';
