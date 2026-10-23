package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WireM2Combat attaches PG-backed reports and the M2 garrison resolver to the march hub.
func WireM2Combat(shardID int32, pool *pgxpool.Pool, hub *march.Hub) *report.Service {
	if hub == nil || pool == nil {
		return nil
	}
	svc := report.NewService(report.NewPGStore(pool))
	resolver := combat.NewResolver(shardID, svc, combat.M2FixtureGarrisons(), nil)
	hub.SetMarchArrivalHandler(resolver.HubHandler())
	return svc
}
