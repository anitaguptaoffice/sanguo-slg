package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
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
	b, ok := s.takeMarchHero(marchID)
	if !ok || b.heroID == 0 {
		return
	}
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

// registerStartedMarch is called once after successful legacy CreateMarch.
// Finish may already have fired. Snapshot only after releasing the index lock:
// MIL invokes the finish callback while holding its own Hub lock.
func (s *Server) registerStartedMarch(pc PlayerContext, cityID, marchID, heroID int64, troops []march.TroopStack) {
	s.recordPlayerMarch(pc, cityID, marchID, heroID, troops)
	s.reconcileFinishedMarch(marchID)
}

func (s *Server) reconcileFinishedMarch(marchID int64) {
	order, _ := s.military.SnapshotMarch(marchID)
	if order != nil && (order.Phase == march.PhaseArrived || order.Phase == march.PhaseReturned) {
		// Request cancellation must not consume the only valid release attempt.
		s.releaseMarchHeroByMarchID(context.Background(), marchID)
	}
}
