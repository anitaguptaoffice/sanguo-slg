package api

import (
	"context"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
)

type marchHeroBinding struct {
	playerID     int64
	serverID     int32
	heroID       int64
	otherHeroIDs []int64
}

// MarchRestoreReady reports whether the prepared startup snapshot was bound.
// It is published before scheduling or serving any requests.
func (s *Server) MarchRestoreReady() bool { return s != nil && s.marchRestoreReady }

// RestorePreparedMarches runs once on a new server with the isolated local
// source. On failure the caller discards the server and Hub.
func (s *Server) RestorePreparedMarches(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	pool := s.PlayersPool()
	if pool == nil || s.milDurable == nil || s.heroSvc == nil {
		return march.ErrMarchRestore
	}
	heroStore, ok := s.heroSvc.Store.(*hero.PGStore)
	if !ok || heroStore.Pool != pool {
		return fmt.Errorf("%w: HERO source does not match", march.ErrMarchRestore)
	}
	profile := s.milDurable.Profile()
	restore, err := march.NewMarchRestore(ctx, pool, profile)
	if err != nil {
		return err
	}
	// Separate lock connection keeps the pool usable for the snapshot and HERO.
	acquired, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	owner := acquired.Hijack()
	defer func() {
		clean, stop := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer stop()
		_ = owner.Close(clean)
	}()
	err = pgx.BeginTxFunc(ctx, owner, pgx.TxOptions{AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		var locked, sameHero bool
		const lockNamespace = 0x4d415243 // MARCH startup
		heroTable := pgx.Identifier{profile.SchemaName, "player_hero"}.Sanitize()
		if err := tx.QueryRow(ctx, `SELECT pg_catalog.pg_try_advisory_xact_lock($1,$2),
			COALESCE(pg_catalog.to_regclass('player_hero') = pg_catalog.to_regclass($3), false)`,
			lockNamespace, int32(profile.SchemaOID), heroTable).Scan(&locked, &sameHero); err != nil {
			return err
		}
		if !locked || !sameHero {
			return fmt.Errorf("%w: recovery already in progress or HERO relation does not match", march.ErrMarchRestore)
		}
		result, err := restore.Restore(ctx, s.military)
		if err != nil {
			return err
		}
		if err := s.releaseOrphanMarchHeroes(ctx, profile.SchemaName, result.Release); err != nil {
			return err
		}
		for _, restored := range result.Marches {
			_, troops := s.military.SnapshotMarch(restored.MarchID)
			pc := PlayerContext{PlayerID: restored.PlayerID, ServerID: restored.ServerID}
			s.recordPlayerMarchWithHeroes(pc, restored.OriginCityID, restored.MarchID, restored.HeroIDs[0], restored.HeroIDs[1:], troops)
		}
		return nil
	})
	if err != nil {
		return err
	}
	// ActivateRestore belongs to the later durable arrival and return wiring.
	s.marchRestoreReady = true
	return nil
}

func (s *Server) releaseOrphanMarchHeroes(ctx context.Context, schema string, releases []march.HeroRelease) error {
	for _, release := range releases {
		actor := hero.PlayerRef{ServerID: release.ServerID, PlayerID: release.PlayerID}
		if err := s.heroSvc.ReleaseMarchOrphan(ctx, schema, actor, release.HeroID); err != nil {
			return fmt.Errorf("release restored orphan hero %d: %w", release.HeroID, err)
		}
	}
	return ctx.Err()
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
