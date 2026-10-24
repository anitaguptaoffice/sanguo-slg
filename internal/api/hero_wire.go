package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/jackc/pgx/v5/pgxpool"
)

// wireHeroService attaches the hero domain service (HERO-002). PG store when pool is set.
func (s *Server) wireHeroService(pool *pgxpool.Pool) {
	if s == nil || s.heroSvc != nil {
		return
	}
	svc := hero.NewService()
	if pool != nil {
		svc.UseStore(hero.NewPGStore(pool))
		svc.CaptiveStore = hero.NewPGCaptiveStore(pool)
		svc.HotelStore = hero.NewPGHotelStore(pool)
	}
	s.heroSvc = svc
}

// HeroService exposes the hero domain for smoke tests.
func (s *Server) HeroService() *hero.Service {
	return s.heroSvc
}
