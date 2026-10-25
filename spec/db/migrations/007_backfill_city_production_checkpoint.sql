-- Deployment-only backfill. FIRST stop all relevant writers and keep the gate
-- continuously closed through final coverage verification (see contract).
-- Never run this to lazily repair an existing city after consumer activation.
BEGIN;
LOCK TABLE player_wallet, player, player_city, city_building, work_queue,
    city_production_checkpoint IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM player_city c
        LEFT JOIN player p USING (server_id, player_id)
        LEFT JOIN player_wallet w USING (server_id, player_id)
        WHERE p.player_id IS NULL OR w.player_id IS NULL
    ) THEN RAISE EXCEPTION 'production backfill: missing player or wallet'; END IF;
    IF EXISTS (
        SELECT 1 FROM city_production_checkpoint k
        LEFT JOIN player_city c USING (server_id, city_id)
        WHERE c.city_id IS NULL OR k.player_id <> c.player_id
    ) THEN RAISE EXCEPTION 'production backfill: checkpoint orphan or owner mismatch'; END IF;
    IF EXISTS (
        SELECT 1 FROM city_building b LEFT JOIN player_city c USING (server_id, city_id)
        WHERE c.city_id IS NULL
    ) OR EXISTS (
        SELECT 1 FROM work_queue q LEFT JOIN player_city c USING (server_id, city_id)
        WHERE q.queue_type=1 AND (c.city_id IS NULL OR q.player_id <> c.player_id)
    ) THEN RAISE EXCEPTION 'production backfill: orphan domestic city or queue owner mismatch'; END IF;
END $$;
INSERT INTO city_production_checkpoint (server_id, city_id, player_id, settled_at)
SELECT c.server_id, c.city_id, c.player_id, w.updated_at
FROM player_city c JOIN player_wallet w USING (server_id, player_id)
ON CONFLICT (server_id, city_id) DO NOTHING;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM player_city c
        LEFT JOIN city_production_checkpoint k USING (server_id, city_id)
        WHERE k.city_id IS NULL OR k.player_id <> c.player_id
    ) THEN RAISE EXCEPTION 'production backfill: incomplete city coverage'; END IF;
END $$;
COMMIT;
