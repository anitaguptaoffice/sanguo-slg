package api

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

// wildGarrisonRecover is how long a defeated or damaged wild tile stays at its
// remaining garrison before the configured full garrison returns.
const wildGarrisonRecover = 30 * time.Minute

// garrisonWriter is implemented by the PG store; in-memory test stores are not.
type garrisonWriter interface {
	SaveGarrison(ctx context.Context, serverID int32, x, y int, garrisonJSON []byte, recoverAt time.Time) error
}

// wildGarrisons resolves a destination tile's defenders from the persisted world
// state and the world_wild profile. It replaces the removed (5,5) memory fixture.
type wildGarrisons struct {
	world    *world.Service
	serverID int32
}

func NewWorldGarrisons(svc *world.Service, serverID int32) *wildGarrisons {
	return &wildGarrisons{world: svc, serverID: serverID}
}

func (g *wildGarrisons) Get(ctx context.Context, x, y int) *combat.Garrison {
	if g == nil || g.world == nil {
		return nil
	}
	loadCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
	defer cancel()
	tile, err := g.world.TileDetail(loadCtx, g.serverID, x, y)
	if err != nil || tile == nil {
		return nil
	}
	profile := g.world.Wild.Profile(tile.Cell)
	if profile == nil {
		return nil
	}
	if tile.RecoverAt.After(time.Now()) && len(tile.GarrisonJSON) > 0 {
		var stored []march.TroopStack
		if err := json.Unmarshal(tile.GarrisonJSON, &stored); err == nil {
			if len(stored) == 0 {
				return nil
			}
			return &combat.Garrison{
				Troops: stored, HeroLevel: int(profile.HeroLevel),
				HeroForce: profile.HeroForce, HeroIntel: profile.HeroIntel, Morale: 1,
				Name:     world.TerrainName(tile.Terrain) + fmt.Sprintf(" Lv%d", profile.Level),
				HeroName: "野地守将",
				Loot: battle.Loot{Food: profile.Loot.Food, Wood: profile.Loot.Wood, Stone: profile.Loot.Stone,
					Iron: profile.Loot.Iron, Gold: profile.Loot.Gold, HeroExp: profile.HeroExp},
			}
		}
	}
	loot := battle.Loot{
		Food: profile.Loot.Food, Wood: profile.Loot.Wood, Stone: profile.Loot.Stone,
		Iron: profile.Loot.Iron, Gold: profile.Loot.Gold, HeroExp: profile.HeroExp,
	}
	for _, drop := range profile.Items {
		loot.Items = append(loot.Items, battle.LootItem{ItemCfgID: drop.ItemCfgID, Count: 1})
	}
	name, heroName := world.TerrainName(tile.Terrain)+fmt.Sprintf(" Lv%d", profile.Level), "野地守将"
	if tile.NpcKind == 1 {
		if camp := g.world.Wild.Camps[tile.NpcKind]; camp != nil {
			name = camp.Name + fmt.Sprintf(" Lv%d", profile.Level)
		} else {
			name = fmt.Sprintf("黄巾营寨 Lv%d", profile.Level)
		}
		heroName = "黄巾渠帅"
	}
	garrison := &combat.Garrison{
		HeroLevel: int(profile.HeroLevel), HeroForce: profile.HeroForce,
		HeroIntel: profile.HeroIntel, Morale: 1, Name: name, HeroName: heroName, Loot: loot,
	}
	for _, troop := range profile.Troops {
		garrison.Troops = append(garrison.Troops, march.TroopStack{UnitCfgID: troop.UnitCfgID, Count: troop.Count})
	}
	if len(garrison.Troops) == 0 {
		return nil
	}
	return garrison
}

// ApplyRemaining persists the remaining defenders and their recovery deadline.
func (g *wildGarrisons) ApplyRemaining(ctx context.Context, x, y int, troops []march.TroopStack) {
	if g == nil || g.world == nil {
		return
	}
	writer, ok := g.world.Store.(garrisonWriter)
	if !ok {
		return
	}
	payload, err := json.Marshal(troops)
	if err != nil {
		return
	}
	writeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
	defer cancel()
	_ = writer.SaveGarrison(writeCtx, g.serverID, x, y, payload, time.Now().Add(wildGarrisonRecover))
}
