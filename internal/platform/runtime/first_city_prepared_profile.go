package runtime

import (
	"maps"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

var preparedWorldObjects = []string{"map_cell", "map_cell_pkey", "player_city", "player_city_pkey",
	"player_city_server_id_x_y_key", "idx_player_city_owner", "player_city_id_seq"}
var preparedDomesticObjects = []string{"player_wallet", "player_wallet_pkey", "city_production_checkpoint",
	"city_production_checkpoint_pkey", "idx_city_production_player", "city_building", "city_building_pkey", "idx_city_building_cfg"}

type preparedCityProfiles struct {
	world, domestic, military freshsource.Profile
}

// Copy expectations from one reviewed profile. The MIL constructor verifies
// the exact remaining inventory and every participant validates its own source.
func splitPreparedCityProfile(p freshsource.Profile) (*preparedCityProfiles, error) {
	if len(p.Objects) != 14+len(preparedWorldObjects)+len(preparedDomesticObjects) {
		return nil, badMilitary("prepared-city object inventory")
	}
	out := &preparedCityProfiles{world: p, domestic: p, military: p}
	out.military.Objects = maps.Clone(p.Objects)
	for _, group := range []struct {
		profile *freshsource.Profile
		names   []string
	}{{&out.world, preparedWorldObjects}, {&out.domestic, preparedDomesticObjects}} {
		group.profile.Objects = make(map[string]freshsource.ObjectIdentity, len(group.names))
		for _, name := range group.names {
			object, ok := out.military.Objects[name]
			if !ok {
				return nil, badMilitary("prepared-city object inventory")
			}
			group.profile.Objects[name] = object
			delete(out.military.Objects, name)
		}
	}
	return out, nil
}
