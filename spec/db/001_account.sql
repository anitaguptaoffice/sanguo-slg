-- domain: account（全局账号中心，无 server_id）
-- 玩家角色 player 表携带 server_id，表示分服角色。

CREATE TABLE account (
    account_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    login_name      VARCHAR(64)  NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    status          SMALLINT     NOT NULL DEFAULT 1, -- 1=正常 2=封禁
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_account_login_name ON account (login_name);
COMMENT ON TABLE account IS '全局账号：登录名与凭证，与具体游戏服无关';
COMMENT ON COLUMN account.status IS '账号状态，封禁后禁止登录任意服';

CREATE TABLE account_session (
    session_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      BIGINT       NOT NULL REFERENCES account (account_id),
    expires_at      TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_account_session_account ON account_session (account_id);
COMMENT ON TABLE account_session IS '登录会话令牌，网关鉴权用';

CREATE TABLE game_server (
    server_id       INT          PRIMARY KEY,
    display_name    VARCHAR(64)  NOT NULL,
    status          SMALLINT     NOT NULL DEFAULT 0, -- 0=维护 1=流畅 2=火爆 3=停服
    opened_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE game_server IS '游戏服注册表：分片元数据，开服时间用于新服流程';

CREATE TABLE player (
    server_id       INT          NOT NULL,
    player_id       BIGINT       NOT NULL,
    account_id      BIGINT       NOT NULL REFERENCES account (account_id),
    display_name    VARCHAR(32)  NOT NULL,
    level           INT          NOT NULL DEFAULT 1,
    power           BIGINT       NOT NULL DEFAULT 0,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id)
);
CREATE UNIQUE INDEX uq_player_account_per_server ON player (server_id, account_id);
CREATE INDEX idx_player_account ON player (account_id);
COMMENT ON TABLE player IS '分服玩家角色：一账号在同一服仅一个角色';
COMMENT ON COLUMN player.power IS '战力快照，排行用 Redis 为主、此字段异步回写';
