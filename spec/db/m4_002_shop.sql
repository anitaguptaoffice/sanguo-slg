-- domain: content / shop（M4 商城：货架、商品、购买记录）
-- 依赖 006_content cfg_item / player_item；跨域不设 FK。

CREATE TABLE cfg_shop (
    shop_cfg_id     INT          PRIMARY KEY,
    code            VARCHAR(64)  NOT NULL UNIQUE,
    name            VARCHAR(64)  NOT NULL,
    unlock_level    INT          NOT NULL DEFAULT 1,
    meta            JSONB        NOT NULL DEFAULT '{}'
);
COMMENT ON TABLE cfg_shop IS '商城入口：如资源商店、活动商店';

CREATE TABLE cfg_shop_shelf (
    shelf_cfg_id    INT          PRIMARY KEY,
    shop_cfg_id     INT          NOT NULL,
    code            VARCHAR(64)  NOT NULL,
    name            VARCHAR(64)  NOT NULL,
    sort_order      INT          NOT NULL DEFAULT 0,
    visible_from    TIMESTAMPTZ,
    visible_until   TIMESTAMPTZ,
    meta            JSONB        NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX uq_shop_shelf_shop_code ON cfg_shop_shelf (shop_cfg_id, code);
CREATE INDEX idx_shop_shelf_shop_sort ON cfg_shop_shelf (shop_cfg_id, sort_order);
COMMENT ON TABLE cfg_shop_shelf IS '货架页签；visible_* 为空表示长期上架';

CREATE TABLE cfg_shop_offer (
    offer_cfg_id            INT          PRIMARY KEY,
    shelf_cfg_id            INT          NOT NULL,
    code                    VARCHAR(64)  NOT NULL UNIQUE,
    item_cfg_id             INT          NOT NULL,
    item_count              INT          NOT NULL DEFAULT 1 CHECK (item_count > 0),
    price                   JSONB        NOT NULL DEFAULT '{}',
    server_stock_limit      INT,
    per_player_daily_limit  INT,
    per_player_total_limit  INT,
    sort_order              INT          NOT NULL DEFAULT 0,
    meta                    JSONB        NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_shop_offer_shelf ON cfg_shop_offer (shelf_cfg_id, sort_order);
COMMENT ON TABLE cfg_shop_offer IS '可购商品行';
COMMENT ON COLUMN cfg_shop_offer.price IS '扣费：{\"resources\":{\"food\":1000},\"items\":[{\"item_cfg_id\":2001,\"qty\":1}]}';
COMMENT ON COLUMN cfg_shop_offer.server_stock_limit IS '全服库存上限；NULL 不限';
COMMENT ON COLUMN cfg_shop_offer.per_player_daily_limit IS '单玩家自然日限购；NULL 不限';
COMMENT ON COLUMN cfg_shop_offer.per_player_total_limit IS '单玩家终身限购；NULL 不限';

CREATE TABLE player_shop_purchase (
    server_id           INT          NOT NULL,
    purchase_id         BIGINT       NOT NULL,
    player_id           BIGINT       NOT NULL,
    offer_cfg_id        INT          NOT NULL,
    quantity            INT          NOT NULL DEFAULT 1 CHECK (quantity > 0),
    cost_snapshot       JSONB        NOT NULL DEFAULT '{}',
    idempotency_key     VARCHAR(64),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, purchase_id)
);
CREATE UNIQUE INDEX uq_player_shop_purchase_idem
    ON player_shop_purchase (server_id, player_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_player_shop_purchase_player
    ON player_shop_purchase (server_id, player_id, created_at DESC);
CREATE INDEX idx_player_shop_purchase_offer
    ON player_shop_purchase (server_id, offer_cfg_id, created_at DESC);
COMMENT ON TABLE player_shop_purchase IS '购买流水；限购统计可由此聚合或配合 counter 表';

CREATE TABLE player_shop_offer_counter (
    server_id           INT          NOT NULL,
    player_id           BIGINT       NOT NULL,
    offer_cfg_id        INT          NOT NULL,
    total_bought        INT          NOT NULL DEFAULT 0 CHECK (total_bought >= 0),
    daily_bought        INT          NOT NULL DEFAULT 0 CHECK (daily_bought >= 0),
    daily_period        DATE         NOT NULL DEFAULT CURRENT_DATE,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id, offer_cfg_id)
);
COMMENT ON TABLE player_shop_offer_counter IS '限购快查；daily_period 变更日需重置 daily_bought';
