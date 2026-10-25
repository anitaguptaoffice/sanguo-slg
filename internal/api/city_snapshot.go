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
