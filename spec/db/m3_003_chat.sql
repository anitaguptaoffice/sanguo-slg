-- domain: social / chat（单服 PG 模型；频道 + 消息）

CREATE TABLE chat_channel (
    server_id           INT          NOT NULL,
    channel_id          BIGINT       NOT NULL,
    channel_type        SMALLINT     NOT NULL, -- 1=世界 2=军团 3=私聊
    ref_id              BIGINT       NOT NULL DEFAULT 0, -- 军团频道=guild_id；世界=0；私聊见 chat_private_pair
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, channel_id)
);
CREATE UNIQUE INDEX uq_chat_channel_world
    ON chat_channel (server_id)
    WHERE channel_type = 1;
CREATE UNIQUE INDEX uq_chat_channel_guild
    ON chat_channel (server_id, ref_id)
    WHERE channel_type = 2;
COMMENT ON TABLE chat_channel IS '聊天频道实例：世界每服一条，军团每 guild 一条，私聊每对玩家一条';
COMMENT ON COLUMN chat_channel.channel_type IS '1世界 2军团 3私聊';
COMMENT ON COLUMN chat_channel.ref_id IS '业务关联键：军团 guild_id；世界固定 0';

CREATE TABLE chat_private_pair (
    server_id           INT          NOT NULL,
    channel_id          BIGINT       NOT NULL,
    player_low_id       BIGINT       NOT NULL,
    player_high_id      BIGINT       NOT NULL,
    PRIMARY KEY (server_id, channel_id),
    UNIQUE (server_id, player_low_id, player_high_id),
    CHECK (player_low_id < player_high_id)
);
COMMENT ON TABLE chat_private_pair IS '私聊频道与玩家对映射，player_low_id < player_high_id 规范化';

CREATE TABLE chat_message (
    server_id           INT          NOT NULL,
    channel_id          BIGINT       NOT NULL,
    message_id          BIGINT       NOT NULL,
    sender_player_id    BIGINT       NOT NULL,
    content             VARCHAR(500) NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, channel_id, message_id)
);
CREATE INDEX idx_chat_message_recent
    ON chat_message (server_id, channel_id, created_at DESC);
CREATE INDEX idx_chat_message_sender
    ON chat_message (server_id, sender_player_id, created_at DESC);
COMMENT ON TABLE chat_message IS '频道内消息流水；热数据可 TTL 归档，M3 仅契约';
