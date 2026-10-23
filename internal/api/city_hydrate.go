package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
)

// hydratePlayerCities loads world/domestic snapshots and registers military cities for the session.
func (s *Server) hydratePlayerCities(ctx context.Context, pc PlayerContext) {
	cities, err := s.world.Store.PlayerCities(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return
	}
	for _, wc := range cities {
		s.cityCoords[wc.CityID] = cityCoord{x: wc.X, y: wc.Y}
		if s.cities[wc.CityID] != nil {
			s.ensureMilitaryCity(s.cities[wc.CityID])
			continue
		}
		cs, err := s.domestic.LoadCity(ctx, wc.CityID, pc.PlayerID)
		if err != nil {
			continue
		}
		s.cities[wc.CityID] = cs
		s.ensureMilitaryCity(cs)
	}
}

func (s *Server) registerNewCity(dom *domestic.CityState, x, y int) {
	s.cityCoords[dom.ID] = cityCoord{x: x, y: y}
	s.ensureMilitaryCity(dom)
}

// RegisterCityForTest exposes in-memory city wiring for handler tests.
func (s *Server) RegisterCityForTest(cityID int64, c *domestic.CityState, x, y int) {
	s.cities[cityID] = c
	s.registerNewCity(c, x, y)
}

// BindSessionForTest binds a player context without going through login.
func (s *Server) BindSessionForTest(sessionID string, pc PlayerContext) {
	s.sessions.Bind(sessionID, pc)
}
