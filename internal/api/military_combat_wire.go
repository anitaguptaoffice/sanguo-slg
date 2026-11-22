package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WireM2Combat attaches PG-backed reports and a world-backed garrison resolver.
func WireM2Combat(shardID int32, pool *pgxpool.Pool, hub *march.Hub, garrisons combat.GarrisonSource) *report.Service {
	if hub == nil || pool == nil {
		return nil
	}
	svc := report.NewService(report.NewPGStore(pool))
	resolver := combat.NewResolver(shardID, svc, garrisons, nil)
	resolver.Tactics = combat.TacticsPG(pool)
	resolver.ScoutSink = combat.ScoutSinkPG(pool, shardID)
	prestige := rank.NewPrestigeService(pool, nil)
	resolver.Prestige = func(ctx context.Context, serverID int32, playerID int64, amount int64) error {
		return prestige.Add(ctx, serverID, playerID, amount)
	}
	historical := hero.NewHistorical(pool, hero.NewPGStore(pool), nil)
	resolver.HistoricalCapture = func(ctx context.Context, serverID int32, playerID, cityID int64, x, y int32, roll int) error {
		_, err := historical.Capture(ctx, serverID, playerID, cityID, x, y, roll)
		return err
	}
	hub.SetMarchArrivalHandler(resolver.HubHandler())
	return svc
}
