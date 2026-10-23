package api

import (
	"context"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
)

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

func (s *Server) accrueCityWithQuest(ctx context.Context, serverID int32, city *domestic.CityState, cat map[int32]domestic.BuildingSpec, now time.Time) {
	if city == nil {
		return
	}
	before := city.Wallet
	accrue(city, cat, now)
	s.questAfterResourceGain(ctx, serverID, city.PlayerID, before, city.Wallet)
}
