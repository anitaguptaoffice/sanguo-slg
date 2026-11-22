package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/specialcity"
)

// wireSpecialCity attaches national-war defense and ownership callbacks.
func wireSpecialCity(resolver *combat.Resolver, svc *specialcity.Service, onCapture func(ctx context.Context)) {
	if resolver == nil || svc == nil {
		return
	}
	resolver.SpecialCityDefense = func(ctx context.Context, x, y int) (*combat.CityDefense, error) {
		city, err := svc.Defense(ctx, defaultServerID, x, y)
		if err != nil {
			return nil, err
		}
		out := &combat.CityDefense{CityID: 0, Name: city.Name, SpecialCityCfgID: city.CfgID,
			Troops: city.Garrison, HeroLevel: city.HeroLevel, HeroForce: city.HeroForce, HeroIntel: city.HeroIntel,
			Loot: battle.Loot{Food: city.Loot.Food, Wood: city.Loot.Wood, Stone: city.Loot.Stone,
				Iron: city.Loot.Iron, Gold: city.Loot.Gold, HeroExp: city.Loot.HeroExp}}
		if group, ok := battle.WallDefense("tower", int(city.WallLevel)*10, city.WallLevel); ok {
			out.Walls = []battle.WallGroup{group}
		}
		return out, nil
	}
	resolver.SpecialCityBattle = func(ctx context.Context, ev march.MarchArrivalEvent, city *combat.CityDefense, won bool, defenders []march.TroopStack) (*march.LootRecord, error) {
		captured, _, err := svc.AfterBattle(ctx, defaultServerID, city.SpecialCityCfgID, ev.PlayerID, won, defenders)
		if err != nil || !won {
			return nil, err
		}
		if captured && onCapture != nil {
			onCapture(ctx)
		}
		return &march.LootRecord{Food: city.Loot.Food, Wood: city.Loot.Wood, Stone: city.Loot.Stone,
			Iron: city.Loot.Iron, Gold: city.Loot.Gold}, nil
	}
}
