-- R1-S5: 附属野地采集。派遣空闲将领驻留野地一小时，到期领取资源与宝物。
CREATE SEQUENCE IF NOT EXISTS field_gather_id_seq;
CREATE TABLE IF NOT EXISTS field_gather (
    server_id  INT    NOT NULL,
    gather_id  BIGINT NOT NULL,
    player_id  BIGINT NOT NULL,
    city_id    BIGINT NOT NULL,
    hero_id    BIGINT NOT NULL,
    x          INT    NOT NULL,
    y          INT    NOT NULL,
    terrain    SMALLINT NOT NULL,
    level      SMALLINT NOT NULL,
    start_at   TIMESTAMPTZ NOT NULL,
    finish_at  TIMESTAMPTZ NOT NULL,
    status     SMALLINT NOT NULL DEFAULT 1,
    reward     JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (server_id, gather_id)
);
CREATE INDEX IF NOT EXISTS field_gather_active_idx
    ON field_gather (server_id, player_id, status, finish_at);
COMMENT ON TABLE field_gather IS '附属野地采集；status 1=采集中，2=已领取';
