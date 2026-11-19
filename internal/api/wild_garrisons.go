package api

import (
	"context"
	"sync"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

// wildGarrisons resolves a destination tile's defenders from the persisted world
// state and the world_wild profile. It replaces the removed (5,5) memory fixture.
type wildGarrisons struct {
	world    *world.Service
	serverID int32

	mu    sync.Mutex
	cache map[int64]*combat.Garrison
}

// NewWorldGarrisons exposes the world-backed garrison source to the runtime wiring.
func NewWorldGarrisons(svc *world.Service, serverID int32) *wildGarrisons {
	return &wildGarrisons{world: svc, serverID: serverID, cache: map[int64]*combat.Garrison{}}
}

func garrisonKey(x, y int) int64 { return int64(x)<<32 | int64(uint32(y)) }

func (g *wildGarrisons) Get(x, y int) *combat.Garrison {
	if g == nil || g.world == nil {
		return nil
	}
	key := garrisonKey(x, y)
	g.mu.Lock()
	cached, ok := g.cache[key]
	g.mu.Unlock()
	if ok {
		return copyGarrison(cached)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	tile, err := g.world.TileDetail(ctx, g.serverID, x, y)
	if err != nil || tile == nil {
		return nil
	}
	profile := g.world.Wild.Profile(tile.Cell)
	if profile == nil {
		return nil
	}
	garrison := &combat.Garrison{HeroLevel: int(profile.HeroLevel), Morale: 1}
	for _, troop := range profile.Troops {
		garrison.Troops = append(garrison.Troops, march.TroopStack{UnitCfgID: troop.UnitCfgID, Count: troop.Count})
	}
	if len(garrison.Troops) == 0 {
		return nil
	}
	g.mu.Lock()
	g.cache[key] = garrison
	g.mu.Unlock()
	return copyGarrison(garrison)
}

// ApplyRemaining keeps the in-process remnant accurate until R1-S4 persists it.
func (g *wildGarrisons) ApplyRemaining(x, y int, troops []march.TroopStack) {
	if g == nil {
		return
	}
	key := garrisonKey(x, y)
	g.mu.Lock()
	defer g.mu.Unlock()
	if len(troops) == 0 {
		delete(g.cache, key)
		return
	}
	garrison := g.cache[key]
	if garrison == nil {
		garrison = &combat.Garrison{HeroLevel: 1, Morale: 1}
	}
	garrison.Troops = append([]march.TroopStack(nil), troops...)
	g.cache[key] = garrison
}

func copyGarrison(in *combat.Garrison) *combat.Garrison {
	if in == nil {
		return nil
	}
	out := *in
	out.Troops = append([]march.TroopStack(nil), in.Troops...)
	return &out
}
