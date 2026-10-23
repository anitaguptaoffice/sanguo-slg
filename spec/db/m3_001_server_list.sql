-- domain: account / platform（M3 选服列表扩展）
-- 依赖 SPEC-001 game_server；仅 ALTER 扩展字段，不修改 001_account.sql 以利并行开发。

ALTER TABLE game_server
    ADD COLUMN IF NOT EXISTS region_code       VARCHAR(16)  NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS sort_weight       INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_recommend      BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS player_count      INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS online_count      INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_players       INT          NOT NULL DEFAULT 50000,
    ADD COLUMN IF NOT EXISTS list_visible      BOOLEAN      NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS maintenance_msg   VARCHAR(255);

COMMENT ON COLUMN game_server.region_code IS '大区/渠道分组，选服列表筛选';
COMMENT ON COLUMN game_server.sort_weight IS '列表排序权重，越大越靠前';
COMMENT ON COLUMN game_server.is_recommend IS '是否推荐服标签';
COMMENT ON COLUMN game_server.player_count IS '已创角数，选服展示（异步回写）';
COMMENT ON COLUMN game_server.online_count IS '当前在线数，选服展示（异步回写）';
COMMENT ON COLUMN game_server.max_players IS '创角上限，达上限后列表可显示爆满';
COMMENT ON COLUMN game_server.list_visible IS '是否在客户端选服列表展示';
COMMENT ON COLUMN game_server.maintenance_msg IS '维护/停服时展示文案';

CREATE INDEX IF NOT EXISTS idx_game_server_list
    ON game_server (list_visible, status, sort_weight DESC, opened_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_game_server_region
    ON game_server (region_code, list_visible, status);
