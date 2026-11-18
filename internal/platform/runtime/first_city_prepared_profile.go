package runtime

import (
	"maps"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

var preparedWorldObjects = []string{"map_cell", "map_cell_pkey", "player_city", "player_city_pkey",
	"player_city_server_id_x_y_key", "idx_player_city_owner", "player_city_id_seq"}
var preparedDomesticObjects = []string{"player_wallet", "player_wallet_pkey", "city_production_checkpoint",
	"city_production_checkpoint_pkey", "idx_city_production_player", "city_building", "city_building_pkey", "idx_city_building_cfg"}
var preparedRecruitAccountObjects = []string{"account", "account_pkey", "uq_account_login_name",
	"account_account_id_seq", "account_session", "account_session_pkey", "idx_account_session_account",
	"player", "player_pkey", "uq_player_account_per_server", "idx_player_account"}
var preparedReturnObjects = []string{"march_order", "march_order_pkey", "idx_march_arrive", "idx_march_return",
	"field_army", "field_army_pkey", "idx_field_army_owner", "army_troop", "army_troop_pkey"}

type preparedCityProfiles struct {
	world, domestic, military freshsource.Profile
	recruit                   *freshsource.Profile
	march                     *freshsource.Profile
	catalog                   *march.RecruitCatalog
}

// Copy expectations from one reviewed profile. The MIL constructor verifies
// the exact remaining inventory and every participant validates its own source.
func splitPreparedCityProfile(p freshsource.Profile) (*preparedCityProfiles, error) {
	cityObjects := 14 + len(preparedWorldObjects) + len(preparedDomesticObjects)
	recruitObjects := cityObjects + len(preparedRecruitAccountObjects)
	withMarch := len(p.Objects) == recruitObjects+len(preparedReturnObjects)
	withRecruit := withMarch || len(p.Objects) == recruitObjects
	if len(p.Objects) != cityObjects && !withRecruit {
		return nil, badMilitary("prepared-city object inventory")
	}
	out := &preparedCityProfiles{world: p, domestic: p, military: p}
	out.military.Objects = maps.Clone(p.Objects)
	if withRecruit {
		recruit := p
		recruit.Objects = maps.Clone(p.Objects)
		// Recruit needs the wallet and its primary key, not city buildings/checkpoints.
		for _, name := range preparedDomesticObjects[2:] {
			delete(recruit.Objects, name)
		}
		if withMarch {
			marchProfile := recruit
			marchProfile.Objects = maps.Clone(recruit.Objects)
			out.march = &marchProfile
			for _, name := range preparedReturnObjects {
				if _, ok := out.military.Objects[name]; !ok {
					return nil, badMilitary("prepared return inventory")
				}
				delete(out.military.Objects, name)
				delete(recruit.Objects, name)
			}
		}
		for _, name := range preparedRecruitAccountObjects {
			if _, ok := out.military.Objects[name]; !ok {
				return nil, badMilitary("prepared recruit account inventory")
			}
			delete(out.military.Objects, name)
		}
		out.recruit = &recruit
	}
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
