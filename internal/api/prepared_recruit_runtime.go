package api

import (
	"context"
	"reflect"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

// WirePreparedRecruit runs once during startup, before publishing routes or
// starting schedulers. The caller must own the isolated prepared runtime and
// fence outside writers for the lifetime of the bound source.
func (s *Server) WirePreparedRecruit(ctx context.Context, profile freshsource.Profile, catalog *march.RecruitCatalog) error {
	if s == nil || ctx == nil || s.preparedRecruit != nil || s.firstCityPrepared == nil ||
		s.milDurable == nil || s.firstCityPrepared.Binding != s.milDurable.Binding() {
		return errRecruitGeneration
	}
	names := recruitSourceInventories()[3]
	prepared := recruitSourceProjection(s.firstCityPrepared.Profile, names)
	if !reflect.DeepEqual(prepared, s.milDurable.Profile()) ||
		!reflect.DeepEqual(prepared, recruitSourceProjection(profile, names)) {
		return errRecruitGeneration
	}
	source, err := newRecruitGeneration(s.firstCityPrepared.Binding, profile, catalog)
	if err != nil {
		return err
	}
	startup, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if err = source.initialize(startup); err != nil {
		return err
	}
	if err = startup.Err(); err != nil {
		_ = source.close()
		return err
	}
	s.preparedRecruit = source
	return nil
}

// RunPreparedRecruitScheduler owns the worker lifetime for the prepared source.
func (s *Server) RunPreparedRecruitScheduler(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	s.runPreparedRecruitScheduler(ctx, func() bool {
		select {
		case <-ctx.Done():
			return false
		case <-ticker.C:
			return true
		}
	})
}

func (s *Server) runPreparedRecruitScheduler(ctx context.Context, waitNext func() bool) {
	g := s.preparedRecruit
	if g == nil {
		return
	}
	defer func() {
		_ = g.close()
		drain, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if err := g.s.admission.waitDrained(drain); err != nil {
			s.log.Warn("prepared recruit source did not drain", "error", err)
		}
	}()
	for ctx.Err() == nil {
		batch, cancel := context.WithTimeout(ctx, 5*time.Second)
		_, err := g.completeDuePage(batch, 64)
		cancel()
		if err != nil {
			if ctx.Err() == nil {
				s.log.Error("prepared recruit scheduler stopped", "error", err)
			}
			return
		}
		if !waitNext() {
			return
		}
	}
}
