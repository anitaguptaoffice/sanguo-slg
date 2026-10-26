package api

import "github.com/anitaguptaoffice/sanguo-slg/internal/domestic"

// citySnapshot is the only handler read boundary for mutable domestic state.
func (s *Server) citySnapshot(id int64) *domestic.CityState {
	if s.domestic == nil {
		return nil
	}
	c, err := s.domestic.SnapshotCity(id)
	if err != nil {
		return nil
	}
	return c
}

func (s *Server) cacheCity(id int64, c *domestic.CityState) {
	s.citiesMu.Lock()
	defer s.citiesMu.Unlock()
	s.cities[id] = c
}

func (s *Server) cachedCityIDs() []int64 {
	s.citiesMu.RLock()
	defer s.citiesMu.RUnlock()
	ids := make([]int64, 0, len(s.cities))
	for id := range s.cities {
		ids = append(ids, id)
	}
	return ids
}

func (s *Server) cacheCityCoord(id int64, x, y int) {
	s.citiesMu.Lock()
	defer s.citiesMu.Unlock()
	s.cityCoords[id] = cityCoord{x: x, y: y}
}

func (s *Server) cityCoordinate(id int64) (cityCoord, bool) {
	s.citiesMu.RLock()
	defer s.citiesMu.RUnlock()
	coord, ok := s.cityCoords[id]
	return coord, ok
}

// domesticCityScope prevents shard-less Hub/cache IDs from crossing persistence
// boundaries. Nil API persistence is reserved for explicitly local memory fixtures;
// production wiring is immutable and this does not provide multi-shard Hub routing.
func (s *Server) domesticCityScope(serverID int32) bool {
	if s == nil || s.domestic == nil || serverID <= 0 {
		return false
	}
	if s.players == nil || s.players.Pool == nil {
		return true
	}
	return s.domestic.SupportsAtomicCityCreation(s.players.Pool, serverID)
}
