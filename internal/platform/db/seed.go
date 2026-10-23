package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SeedDevServer ensures a default playable shard exists (server_id=1).
func SeedDevServer(ctx context.Context, pool *pgxpool.Pool, serverID int32, displayName string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO game_server (server_id, display_name, status, opened_at)
		VALUES ($1, $2, 1, now())
		ON CONFLICT (server_id) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			status = CASE WHEN game_server.status IN (0, 3) THEN 1 ELSE game_server.status END`,
		serverID, displayName)
	return err
}
