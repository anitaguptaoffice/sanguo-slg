-- R2-S4: 招贤馆三职任命（1=城守 2=军师 3=主将）。
CREATE TABLE IF NOT EXISTS city_office (
    server_id   INT    NOT NULL,
    city_id     BIGINT NOT NULL,
    office      SMALLINT NOT NULL,
    hero_id     BIGINT NOT NULL,
    appointed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, city_id, office),
    UNIQUE (server_id, hero_id)
);
COMMENT ON TABLE city_office IS '招贤馆三职：一城每职一名，一名将领最多任一职';
