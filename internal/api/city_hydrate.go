package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
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

// SetHeroServiceForTest wires an in-memory hero service (handler unit tests).
func (s *Server) SetHeroServiceForTest(svc *hero.Service) {
	s.heroSvc = svc
	if svc != nil && s.now != nil {
		svc.SetClock(s.now)
	}
}

// SeedCityTroopsForTest sets in-city troop counts for gateway smoke tests (api_test).
func (s *Server) SeedCityTroopsForTest(cityID int64, unitCfgID, count int32) {
	mc := s.military.City(cityID)
	if mc == nil {
		dom := s.cities[cityID]
		if dom == nil {
			return
		}
		s.ensureMilitaryCity(dom)
		mc = s.military.City(cityID)
	}
	if mc == nil {
		return
	}
	if mc.Troops == nil {
		mc.Troops = make(map[int32]int32)
	}
	mc.Troops[unitCfgID] = count
}
