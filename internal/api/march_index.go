package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

type playerMarchRef struct {
	marchID int64
	cityID  int64
	heroID  int64
	troops  []march.TroopStack
}

func (s *Server) recordPlayerMarch(pc PlayerContext, cityID int64, marchID int64, heroID int64, troops []march.TroopStack) {
	s.marchIndexMu.Lock()
	defer s.marchIndexMu.Unlock()
	if s.playerMarches == nil {
		s.playerMarches = make(map[int64][]playerMarchRef)
	}
	if s.marchHeroByID == nil {
		s.marchHeroByID = make(map[int64]marchHeroBinding)
	}
	s.playerMarches[pc.PlayerID] = append(s.playerMarches[pc.PlayerID], playerMarchRef{
		marchID: marchID,
		cityID:  cityID,
		heroID:  heroID,
		troops:  append([]march.TroopStack(nil), troops...),
	})
	s.marchHeroByID[marchID] = marchHeroBinding{playerID: pc.PlayerID, serverID: pc.ServerID, heroID: heroID}
}

func (s *Server) lookupMarchHero(marchID int64) (marchHeroBinding, bool) {
	s.marchIndexMu.RLock()
	defer s.marchIndexMu.RUnlock()
	if s.marchHeroByID == nil {
		return marchHeroBinding{}, false
	}
	b, ok := s.marchHeroByID[marchID]
	return b, ok
}

// takeMarchHero grants one release attempt without holding the lock in HERO.
func (s *Server) takeMarchHero(marchID int64) (marchHeroBinding, bool) {
	s.marchIndexMu.Lock()
	defer s.marchIndexMu.Unlock()
	b, ok := s.marchHeroByID[marchID]
	delete(s.marchHeroByID, marchID)
	return b, ok
}

func (s *Server) listPlayerMarches(playerID int64, cityID int64, limit, offset int32) ([]playerMarchRef, int32) {
	s.marchIndexMu.RLock()
	defer s.marchIndexMu.RUnlock()
	refs := s.playerMarches[playerID]
	filtered := make([]playerMarchRef, 0, len(refs))
	for _, ref := range refs {
		if cityID != 0 && ref.cityID != cityID {
			continue
		}
		ref.troops = append([]march.TroopStack(nil), ref.troops...)
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

// allocateMarchArmyID returns this process's legacy ID while still locked.
// It is not a durable allocator; no domain call may execute under this lock.
func (s *Server) allocateMarchArmyID() int64 {
	s.marchIndexMu.Lock()
	defer s.marchIndexMu.Unlock()
	s.nextArmyID++
	return s.nextArmyID
}
