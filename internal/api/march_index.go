package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

type playerMarchRef struct {
	marchID int64
	cityID  int64
	troops  []march.TroopStack
}

func (s *Server) recordPlayerMarch(playerID int64, cityID int64, marchID int64, troops []march.TroopStack) {
	if s.playerMarches == nil {
		s.playerMarches = make(map[int64][]playerMarchRef)
	}
	s.playerMarches[playerID] = append(s.playerMarches[playerID], playerMarchRef{
		marchID: marchID,
		cityID:  cityID,
		troops:  append([]march.TroopStack(nil), troops...),
	})
}

func (s *Server) listPlayerMarches(playerID int64, cityID int64, limit, offset int32) ([]playerMarchRef, int32) {
	refs := s.playerMarches[playerID]
	filtered := make([]playerMarchRef, 0, len(refs))
	for _, ref := range refs {
		if cityID != 0 && ref.cityID != cityID {
			continue
		}
		filtered = append(filtered, ref)
	}
	total := int32(len(filtered))
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	start := int(offset)
	if start > len(filtered) {
		return nil, total
	}
	end := start + int(limit)
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[start:end], total
}
