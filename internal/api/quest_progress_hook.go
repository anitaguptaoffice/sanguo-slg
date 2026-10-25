package api

import (
	"context"
	"sync"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
)

var (
	embeddedItemCodes     map[int32]string
	embeddedItemCodesOnce sync.Once
)

func itemCodeByCfgID(itemCfgID int32) string {
	embeddedItemCodesOnce.Do(func() {
		embeddedItemCodes = make(map[int32]string)
		cat, err := content.EmbeddedCatalog()
		if err != nil {
			return
		}
		for id, def := range cat.Items {
			embeddedItemCodes[id] = def.Code
		}
	})
	return embeddedItemCodes[itemCfgID]
}

func (s *Server) questAfterRecruitHero(ctx context.Context, serverID int32, playerID int64) {
	if s.questSvc == nil || playerID == 0 {
		return
	}
	_ = s.questSvc.ApplyProgressEvent(ctx, quest.Actor{ServerID: serverID, PlayerID: playerID}, quest.ProgressEvent{
		Kind: quest.EventRecruitHero,
	})
}

func (s *Server) questAfterResourceGain(ctx context.Context, serverID int32, playerID int64, before, after domestic.Resources) {
	if s.questSvc == nil || playerID == 0 {
		return
	}
	for res, delta := range resourceDeltas(before, after) {
		if delta <= 0 {
			continue
		}
		_ = s.questSvc.ApplyProgressEvent(ctx, quest.Actor{ServerID: serverID, PlayerID: playerID}, quest.ProgressEvent{
			Kind:     quest.EventCollectResource,
			Resource: res,
			Delta:    int32(delta),
		})
	}
}

func resourceDeltas(before, after domestic.Resources) map[string]int64 {
	return map[string]int64{
		"food":  after.Food - before.Food,
		"wood":  after.Wood - before.Wood,
		"iron":  after.Iron - before.Iron,
		"stone": after.Stone - before.Stone,
	}
}

func (s *Server) accrueCityWithQuest(ctx context.Context, serverID int32, city *domestic.CityState) error {
	if city == nil {
		return domestic.ErrCityNotFound
	}
	// Domestic reports production measured under the same wallet row lock;
	// concurrent external grants must not count as production a second time.
	_, production, err := s.domestic.SettleCityWithProduction(ctx, city.ID)
	if err != nil {
		return err
	}
	s.questAfterResourceGain(ctx, serverID, city.PlayerID, domestic.Resources{}, production)
	return nil
}

func (s *Server) questAfterTrainTroops(ctx context.Context, serverID int32, playerID int64, unitCfgID, count int32) {
	if s.questSvc == nil || playerID == 0 || count <= 0 {
		return
	}
	code := ""
	if spec, ok := march.DefaultUnitCatalog()[unitCfgID]; ok {
		code = spec.Code
	}
	if code == "" {
		return
	}
	_ = s.questSvc.ApplyProgressEvent(ctx, quest.Actor{ServerID: serverID, PlayerID: playerID}, quest.ProgressEvent{
		Kind: quest.EventTrainTroops, UnitCode: code, Delta: count,
	})
}

func (s *Server) questAfterBuildLevel(ctx context.Context, serverID int32, playerID int64, buildingCfgID, level int32) {
	if s.questSvc == nil || playerID == 0 || buildingCfgID == 0 || level <= 0 {
		return
	}
	_ = s.questSvc.ApplyProgressEvent(ctx, quest.Actor{ServerID: serverID, PlayerID: playerID}, quest.ProgressEvent{
		Kind: quest.EventBuildLevel, BuildingCfgID: buildingCfgID, BuildLevel: level, Delta: 1,
	})
}

func (s *Server) questAfterUseItem(ctx context.Context, serverID int32, playerID int64, itemCode string, count int32) {
	if s.questSvc == nil || playerID == 0 || itemCode == "" || count <= 0 {
		return
	}
	_ = s.questSvc.ApplyProgressEvent(ctx, quest.Actor{ServerID: serverID, PlayerID: playerID}, quest.ProgressEvent{
		Kind: quest.EventUseItem, ItemCode: itemCode, Delta: count,
	})
}

type slotBuildingSnap struct {
	cfgID int32
	level int32
}

func snapshotBuildingLevels(city *domestic.CityState) map[string]slotBuildingSnap {
	out := make(map[string]slotBuildingSnap, len(city.Buildings))
	for slot, inst := range city.Buildings {
		if inst == nil {
			continue
		}
		out[slot] = slotBuildingSnap{cfgID: inst.CfgID, level: inst.Level}
	}
	return out
}

// questFlushBuildCompletions runs domestic queue ticks and emits build_level events for level-ups.
func (s *Server) questFlushBuildCompletions(ctx context.Context, serverID int32, playerID int64, city *domestic.CityState) {
	if city == nil || playerID == 0 {
		return
	}
	before := snapshotBuildingLevels(city)
	s.domestic.Tick()
	after := snapshotBuildingLevels(city)
	for slot, a := range after {
		b, ok := before[slot]
		if !ok || a.level > b.level {
			s.questAfterBuildLevel(ctx, serverID, playerID, a.cfgID, a.level)
		}
	}
}
