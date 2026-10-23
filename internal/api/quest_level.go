package api

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func questPlayerLevelProvider(pool *pgxpool.Pool) quest.LevelProvider {
	if pool == nil {
		return nil
	}
	return func(ctx context.Context, serverID int32, playerID int64) (int32, error) {
		var lvl int32
		err := pool.QueryRow(ctx, `
			SELECT level FROM player WHERE server_id = $1 AND player_id = $2`,
			serverID, playerID).Scan(&lvl)
		if errors.Is(err, pgx.ErrNoRows) {
			return 1, nil
		}
		if err != nil {
			return 0, err
		}
		if lvl < 1 {
			return 1, nil
		}
		return lvl, nil
	}
}
