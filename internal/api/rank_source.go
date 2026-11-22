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
	case rank.RankPlayerPrestige:
		return s.listPlayerPrestige(ctx, serverID)
	case rank.RankHeroForce:
		return s.listHeroStat(ctx, serverID, "force")
	case rank.RankHeroIntel:
		return s.listHeroStat(ctx, serverID, "intel")
	case rank.RankHeroPolitics:
		return s.listHeroStat(ctx, serverID, "politics")
	case rank.RankHeroCommand:
		return s.listHeroStat(ctx, serverID, "command")
	case rank.RankGuildPower:
		return s.listGuildPower(ctx, serverID)
	case rank.RankSpecialCities:
		return s.listGuildSpecialCities(ctx, serverID)
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

func (s *pgRankSource) listPlayerPrestige(ctx context.Context, serverID int32) ([]rank.PlayerRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT p.player_id, p.display_name, r.prestige
		FROM player_rank r
		JOIN player p ON p.server_id = r.server_id AND p.player_id = r.player_id
		WHERE r.server_id = $1 AND r.prestige > 0
		ORDER BY r.prestige DESC
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

func (s *pgRankSource) listHeroStat(ctx context.Context, serverID int32, column string) ([]rank.PlayerRow, error) {
	var sql string
	switch column {
	case "force", "intel", "politics", "command":
		sql = `SELECT p.player_id, p.display_name, MAX(h.` + column + `)::bigint
			FROM player p JOIN player_hero h ON h.server_id = p.server_id AND h.player_id = p.player_id
			WHERE p.server_id = $1 AND h.status = 1
			GROUP BY p.player_id, p.display_name
			ORDER BY MAX(h.` + column + `) DESC
			LIMIT 500`
	default:
		return nil, rank.ErrUnknownRankType
	}
	rows, err := s.pool.Query(ctx, sql, serverID)
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

func (s *pgRankSource) listGuildPower(ctx context.Context, serverID int32) ([]rank.PlayerRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT guild_id, name, power, name FROM guild
		WHERE server_id = $1
		ORDER BY power DESC
		LIMIT 200`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []rank.PlayerRow
	for rows.Next() {
		var r rank.PlayerRow
		if err := rows.Scan(&r.PlayerID, &r.DisplayName, &r.Score, &r.GuildName); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *pgRankSource) listGuildSpecialCities(ctx context.Context, serverID int32) ([]rank.PlayerRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT st.owner_guild_id, g.name, count(*)::bigint, g.name
		FROM special_city_state st JOIN guild g ON g.server_id = st.server_id AND g.guild_id = st.owner_guild_id
		WHERE st.server_id = $1 AND st.owner_guild_id > 0
		GROUP BY st.owner_guild_id, g.name
		ORDER BY count(*) DESC
		LIMIT 200`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []rank.PlayerRow
	for rows.Next() {
		var r rank.PlayerRow
		if err := rows.Scan(&r.PlayerID, &r.DisplayName, &r.Score, &r.GuildName); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
