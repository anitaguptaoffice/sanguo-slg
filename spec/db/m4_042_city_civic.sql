-- R2-S2: 城池人口/民心/税率/开工率持久化。
CREATE TABLE IF NOT EXISTS city_civic (
    server_id      INT    NOT NULL,
    city_id        BIGINT NOT NULL,
    population     BIGINT NOT NULL DEFAULT 500,
    morale         SMALLINT NOT NULL DEFAULT 80,
    tax_rate       SMALLINT NOT NULL DEFAULT 10,
    work_rate      SMALLINT NOT NULL DEFAULT 100,
    last_civic_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    pop_remainder  BIGINT NOT NULL DEFAULT 0,
    tax_remainder  BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (server_id, city_id)
);
COMMENT ON TABLE city_civic IS '人口/民心/税率/开工率；随内政结算推进';
