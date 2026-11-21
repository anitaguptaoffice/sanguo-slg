package combat

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TacticsPG loads drill-ground presets for one city. Missing rows mean the
// engine defaults; a missing table is an unavailable source, not a battle error.
func TacticsPG(pool *pgxpool.Pool) func(context.Context, int32, int64) (map[battle.TroopType]battle.Tactic, error) {
	return func(ctx context.Context, serverID int32, cityID int64) (map[battle.TroopType]battle.Tactic, error) {
		if pool == nil || cityID <= 0 {
			return nil, nil
		}
		rows, err := pool.Query(ctx, `SELECT troop_type,target_type,hold FROM city_tactic
			WHERE server_id=$1 AND city_id=$2 ORDER BY troop_type`, serverID, cityID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := make(map[battle.TroopType]battle.Tactic)
		for rows.Next() {
			var troop, target int32
			var hold bool
			if err := rows.Scan(&troop, &target, &hold); err != nil {
				return nil, err
			}
			if troop < 0 || troop >= int32(len(battle.AllTroopTypes)) || target < -1 || target > 3 {
				continue
			}
			t := battle.Tactic{Hold: hold}
			if target >= 0 {
				t.Target = battle.AllTroopTypes[target]
			}
			out[battle.AllTroopTypes[troop]] = t
		}
		return out, rows.Err()
	}
}
