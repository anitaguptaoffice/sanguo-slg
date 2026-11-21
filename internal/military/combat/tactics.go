package combat

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TacticsPG loads per-unit drill-ground presets for one city. Missing rows
// mean the engine defaults; a missing table is an unavailable source.
func TacticsPG(pool *pgxpool.Pool) func(context.Context, int32, int64) (map[int32]battle.Tactic, error) {
	return func(ctx context.Context, serverID int32, cityID int64) (map[int32]battle.Tactic, error) {
		if pool == nil || cityID <= 0 {
			return nil, nil
		}
		rows, err := pool.Query(ctx, `SELECT unit_cfg_id,target_type,hold FROM city_unit_tactic
			WHERE server_id=$1 AND city_id=$2 ORDER BY unit_cfg_id`, serverID, cityID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := make(map[int32]battle.Tactic)
		for rows.Next() {
			var unit, target int32
			var hold bool
			if err := rows.Scan(&unit, &target, &hold); err != nil {
				return nil, err
			}
			if unit < 1 || unit > 12 || target < -1 || target > 3 {
				continue
			}
			t := battle.Tactic{Hold: hold}
			if target >= 0 {
				t.Target = battle.AllTroopTypes[target]
			}
			out[unit] = t
		}
		return out, rows.Err()
	}
}
