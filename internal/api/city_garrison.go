package api

import (
	"fmt"
	"sort"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

// readyGarrison is called only after authoritative shard/city authorization.
// Missing Hub state is unknown, not an authoritative empty garrison. In
// particular, this read must not register a missing city or complete a job.
func (s *Server) readyGarrison(cityID, playerID int64) (*domesticv1.CityGarrisonSnapshot, error) {
	if s.military == nil {
		return nil, nil
	}
	city := s.military.SnapshotCity(cityID)
	if city == nil {
		return nil, nil
	}
	if city.ID != cityID || city.PlayerID != playerID {
		return nil, fmt.Errorf("garrison snapshot owner mismatch for city %d", cityID)
	}
	catalog := march.DefaultUnitCatalog()
	ids := make([]int32, 0, len(city.Troops))
	for id, count := range city.Troops {
		if _, ok := catalog[id]; id <= 0 || !ok || count < 0 {
			return nil, fmt.Errorf("invalid garrison row for city %d", cityID)
		}
		if count > 0 {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	out := &domesticv1.CityGarrisonSnapshot{}
	for _, id := range ids {
		out.Troops = append(out.Troops, &domesticv1.ReadyTroopCount{UnitCfgId: id, Count: city.Troops[id]})
	}
	return out, nil
}
