package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pgRankSource aggregates live scores from the integration DB (rank domain stays table-agnostic).
type pgRankSource struct {
	pool *pgxpool.Pool
}

func newPGRankSource(pool *pgxpool.Pool) rank.DataSource {
	return &pgRankSource{pool: pool}
}

func (s *pgRankSource) ListPlayerScores(ctx context.Context, serverID int32, rankType rank.RankType) ([]rank.PlayerRow, error) {
	switch rankType {
	case rank.RankPlayerPower:
		return s.listPlayerPower(ctx, serverID)
	case rank.RankPlayerResource:
		return s.listPlayerResources(ctx, serverID)
	default:
		return nil, rank.ErrUnknownRankType
	}
}

func (s *pgRankSource) listPlayerPower(ctx context.Context, serverID int32) ([]rank.PlayerRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT player_id, display_name, power
		FROM player
		WHERE server_id = $1 AND power > 0
		ORDER BY power DESC
		LIMIT 500`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []rank.PlayerRow
	for rows.Next() {
		var r rank.PlayerRow
		if err := rows.Scan(&r.PlayerID, &r.DisplayName, &r.Score); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *pgRankSource) listPlayerResources(ctx context.Context, serverID int32) ([]rank.PlayerRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT p.player_id, p.display_name,
		       w.food + w.wood + w.iron + w.stone + w.gold AS total_res
		FROM player p
		JOIN player_wallet w ON w.server_id = p.server_id AND w.player_id = p.player_id
		WHERE p.server_id = $1
		ORDER BY total_res DESC
		LIMIT 500`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []rank.PlayerRow
	for rows.Next() {
		var r rank.PlayerRow
		if err := rows.Scan(&r.PlayerID, &r.DisplayName, &r.Score); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
