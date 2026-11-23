package api

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	"github.com/jackc/pgx/v5"
)

// warViolation rejects player-city attacks that lack an effective guild war
// declaration. Unaffiliated players, wild tiles and special cities stay open.
func (s *Server) warViolation(ctx context.Context, pc PlayerContext, toX, toY, purpose int32) (string, error) {
	switch purpose {
	case 1, 3, 4: // attack, loot, occupy
	default:
		return "", nil
	}
	pool := s.PlayersPool()
	if pool == nil {
		return "", nil
	}
	var owner int64
	err := pool.QueryRow(ctx, `SELECT player_id FROM player_city
		WHERE server_id=$1 AND x=$2 AND y=$3`, pc.ServerID, toX, toY).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if owner == pc.PlayerID {
		return "不能攻击自己的城池", nil
	}
	ok, reason, err := guild.NewDiplomacy(pool, s.now).CanAttack(ctx, pc.ServerID, pc.PlayerID, owner)
	if err != nil {
		return "", err
	}
	if !ok {
		return reason, nil
	}
	return "", nil
}
