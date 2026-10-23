-- domain: social / rank（定时刷新写入的榜单快照）

CREATE TABLE rank_snapshot (
    server_id           INT          NOT NULL,
    rank_type           SMALLINT     NOT NULL, -- 1=玩家战力 2=玩家等级 3=军团战力 …
    batch_id            BIGINT       NOT NULL,
    refreshed_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    entry_count         INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (server_id, rank_type, batch_id)
);
CREATE INDEX idx_rank_snapshot_latest
    ON rank_snapshot (server_id, rank_type, refreshed_at DESC);
COMMENT ON TABLE rank_snapshot IS '榜单刷新批次头：每次定时任务递增 batch_id';
COMMENT ON COLUMN rank_snapshot.rank_type IS '榜单类型枚举，与规则文档 social.md 对齐';
COMMENT ON COLUMN rank_snapshot.batch_id IS '同服同类型单调递增，客户端拉取指定或最新批次';

CREATE TABLE rank_snapshot_entry (
    server_id           INT          NOT NULL,
    rank_type           SMALLINT     NOT NULL,
    batch_id            BIGINT       NOT NULL,
    rank_position       INT          NOT NULL,
    subject_id          BIGINT       NOT NULL, -- 玩家 player_id 或军团 guild_id
    score               BIGINT       NOT NULL,
    display_name        VARCHAR(64),
    extra_json          JSONB,
    PRIMARY KEY (server_id, rank_type, batch_id, rank_position)
);
CREATE UNIQUE INDEX uq_rank_entry_subject
    ON rank_snapshot_entry (server_id, rank_type, batch_id, subject_id);
CREATE INDEX idx_rank_entry_score
    ON rank_snapshot_entry (server_id, rank_type, batch_id, score DESC);
COMMENT ON TABLE rank_snapshot_entry IS '单批次排行行：subject_id 含义由 rank_type 决定';
COMMENT ON COLUMN rank_snapshot_entry.display_name IS '刷新时复制的展示名，避免历史榜查实时玩家表';
