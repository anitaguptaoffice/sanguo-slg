package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WireM2Combat attaches PG-backed reports and a world-backed garrison resolver.
func WireM2Combat(shardID int32, pool *pgxpool.Pool, hub *march.Hub, garrisons combat.GarrisonSource) *report.Service {
	if hub == nil || pool == nil {
		return nil
	}
	svc := report.NewService(report.NewPGStore(pool))
	resolver := combat.NewResolver(shardID, svc, garrisons, nil)
	hub.SetMarchArrivalHandler(resolver.HubHandler())
	return svc
}
