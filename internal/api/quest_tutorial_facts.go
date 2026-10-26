package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/jackc/pgx/v5/pgxpool"
)

// questTutorialFactsProvider reads persisted completed levels, never queue
// targets or mutable city caches. An upgrading building retains its old level.
func questTutorialFactsProvider(pool *pgxpool.Pool) quest.TutorialFactsProvider {
	return func(ctx context.Context, actor quest.Actor) (quest.TutorialFacts, error) {
		var facts quest.TutorialFacts
		if pool == nil || actor.ServerID <= 0 || actor.PlayerID <= 0 {
			return facts, quest.ErrProgressInvalid
		}
		err := pool.QueryRow(ctx, `
			SELECT COALESCE(jsonb_object_agg(building_cfg_id, level), '{}'::jsonb),
			       EXISTS(SELECT 1 FROM player_hero WHERE server_id=$1 AND player_id=$2)
			FROM (
				SELECT b.building_cfg_id, MAX(b.level) AS level
				FROM city_building b JOIN player_city c
				  ON c.server_id=b.server_id AND c.city_id=b.city_id
				WHERE c.server_id=$1 AND c.player_id=$2
				GROUP BY b.building_cfg_id
			) completed`, actor.ServerID, actor.PlayerID).
			Scan(&facts.CompletedBuildingLevels, &facts.HasOwnedHero)
		if err != nil {
			return quest.TutorialFacts{}, err
		}
		return facts, nil
	}
}
