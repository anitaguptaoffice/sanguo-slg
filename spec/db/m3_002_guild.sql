-- domain: social / guild（按 server_id 分片，跨域不设 FK）

CREATE TABLE guild (
    server_id           INT          NOT NULL,
    guild_id            BIGINT       NOT NULL,
    name                VARCHAR(32)  NOT NULL,
    short_tag           VARCHAR(8),
    leader_player_id    BIGINT       NOT NULL,
    level               INT          NOT NULL DEFAULT 1,
    member_count        INT          NOT NULL DEFAULT 1,
    power               BIGINT       NOT NULL DEFAULT 0,
    notice              VARCHAR(512),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, guild_id)
);
CREATE UNIQUE INDEX uq_guild_name ON guild (server_id, name);
CREATE INDEX idx_guild_leader ON guild (server_id, leader_player_id);
COMMENT ON TABLE guild IS '军团：单服内唯一名称，战力为展示/排行用快照';
COMMENT ON COLUMN guild.power IS '军团战力快照，定时聚合回写';

CREATE TABLE guild_member (
    server_id           INT          NOT NULL,
    guild_id            BIGINT       NOT NULL,
    player_id           BIGINT       NOT NULL,
    role                SMALLINT     NOT NULL DEFAULT 3, -- 1=盟主 2=副盟/官员 3=成员
    permissions         BIGINT       NOT NULL DEFAULT 0, -- 位掩码：邀请/踢人/改公告/开战等
    joined_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id)
);
CREATE INDEX idx_guild_member_guild ON guild_member (server_id, guild_id);
CREATE INDEX idx_guild_member_guild_role ON guild_member (server_id, guild_id, role);
COMMENT ON TABLE guild_member IS '军团成员：同一服内一玩家仅属一个军团';
COMMENT ON COLUMN guild_member.role IS '职位枚举，高权限可覆盖 permissions 默认';
COMMENT ON COLUMN guild_member.permissions IS '细粒度权限位，与 role 默认模板合并后生效';
