package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
)

type serverCityOwnership struct {
	s   *Server
	ctx context.Context
	pc  PlayerContext
}

func (o serverCityOwnership) PlayerOwnsCity(_ context.Context, p hero.PlayerRef, cityID int64) (bool, error) {
	return o.s.playerOwnsCity(o.ctx, PlayerContext{ServerID: p.ServerID, PlayerID: p.PlayerID}, cityID), nil
}

func (s *Server) heroCityOwnership(ctx context.Context, pc PlayerContext) hero.CityOwnershipPort {
	return serverCityOwnership{s: s, ctx: ctx, pc: pc}
}

func (s *Server) playerOwnsCity(ctx context.Context, pc PlayerContext, cityID int64) bool {
	if !s.ownsCity(ctx, pc, cityID) {
		return false
	}
	if city := s.citySnapshot(cityID); city != nil && city.PlayerID == pc.PlayerID {
		return true
	}
	if s.domestic != nil {
		c, err := s.domestic.LoadCity(ctx, cityID, pc.PlayerID)
		return err == nil && c != nil && c.PlayerID == pc.PlayerID
	}
	return false
}
