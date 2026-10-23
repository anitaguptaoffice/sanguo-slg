-- domain: content / mail & reward（M4 邮件与待发奖队列）
-- 依赖 player、006_content player_item；跨域不设 FK。

CREATE TABLE player_mail (
    server_id           INT          NOT NULL,
    mail_id             BIGINT       NOT NULL,
    player_id           BIGINT       NOT NULL,
    mail_type           SMALLINT     NOT NULL DEFAULT 1, -- 1=系统 2=奖励 3=公告
    title               VARCHAR(128) NOT NULL,
    body                TEXT,
    attachments         JSONB        NOT NULL DEFAULT '{}',
    status              SMALLINT     NOT NULL DEFAULT 0, -- 0=未读 1=已读 2=已领附件 3=删除
    expire_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    read_at             TIMESTAMPTZ,
    claimed_at          TIMESTAMPTZ,
    PRIMARY KEY (server_id, mail_id)
);
CREATE INDEX idx_player_mail_inbox
    ON player_mail (server_id, player_id, status, created_at DESC)
    WHERE status <> 3;
COMMENT ON TABLE player_mail IS '玩家邮件；attachments 与 cfg_quest.rewards 同 schema';
COMMENT ON COLUMN player_mail.attachments IS '未领附件：{\"items\":[...],\"resources\":{...}}；领完后可清空或保留快照';

CREATE TABLE reward_grant_queue (
    server_id           INT          NOT NULL,
    grant_id            BIGINT       NOT NULL,
    player_id           BIGINT       NOT NULL,
    source_type         VARCHAR(32)  NOT NULL,
    source_ref          VARCHAR(128) NOT NULL,
    rewards             JSONB        NOT NULL DEFAULT '{}',
    status              SMALLINT     NOT NULL DEFAULT 0, -- 0=待处理 1=处理中 2=成功 3=失败
    idempotency_key     VARCHAR(128) NOT NULL,
    error_msg           VARCHAR(255),
    retry_count         INT          NOT NULL DEFAULT 0,
    next_retry_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    PRIMARY KEY (server_id, grant_id)
);
CREATE UNIQUE INDEX uq_reward_grant_idempotency
    ON reward_grant_queue (server_id, idempotency_key);
CREATE INDEX idx_reward_grant_pending
    ON reward_grant_queue (server_id, status, next_retry_at NULLS FIRST, created_at)
    WHERE status IN (0, 3);
COMMENT ON TABLE reward_grant_queue IS '异步发奖队列：任务领奖、商城、GM、邮件附件等统一入队';
COMMENT ON COLUMN reward_grant_queue.source_type IS '来源枚举：quest | shop | gm | mail | manual';
COMMENT ON COLUMN reward_grant_queue.source_ref IS '业务主键字符串，如 quest_cfg_id=1001 或 purchase_id';
COMMENT ON COLUMN reward_grant_queue.idempotency_key IS '幂等键；同服重复提交返回已有 grant';
