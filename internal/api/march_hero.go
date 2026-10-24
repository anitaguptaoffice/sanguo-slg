package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
)

type marchHeroBinding struct {
	playerID int64
	serverID int32
	heroID   int64
}

func (s *Server) wireMarchHeroLifecycle() {
	if s.military == nil {
		return
	}
	s.military.SetMarchFinishedHandler(func(marchID int64) {
		s.releaseMarchHeroByMarchID(context.Background(), marchID)
	})
}

func (s *Server) releaseMarchHeroByMarchID(ctx context.Context, marchID int64) {
	b, ok := s.lookupMarchHero(marchID)
	if !ok || b.heroID == 0 {
		return
	}
	s.clearMarchHero(marchID)
	if s.heroSvc == nil || b.serverID == 0 {
		return
	}
	_ = s.heroSvc.ReleaseFromMarch(ctx, hero.PlayerRef{ServerID: b.serverID, PlayerID: b.playerID}, b.heroID)
}

func (s *Server) claimMarchHero(ctx context.Context, pc PlayerContext, heroID int64) error {
	if s.heroSvc == nil {
		return hero.ErrHeroNotFound
	}
	return s.heroSvc.ClaimForMarch(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, heroID)
}
