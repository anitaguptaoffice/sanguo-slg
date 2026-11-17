package runtime

import (
	"context"
	"os"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
)

// maybeFirstCityPreparedSource composes startup fresh participants when
// SANGUO_FIRST_CITY_USE_PREPARED_CITY=1 and military durable + DOM hub are ready.
func maybeFirstCityPreparedSource(ctx context.Context, srv *api.Server, pool *pgxpool.Pool, hub *domestic.Hub) *api.FirstCityPreparedCreationSource {
	if os.Getenv("SANGUO_FIRST_CITY_USE_PREPARED_CITY") != "1" {
		return nil
	}
	md := srv.MilitaryDurable()
	if md == nil || pool == nil || hub == nil || !hub.SupportsAtomicCityCreation(pool, defaultShardID) {
		return nil
	}
	profile := md.Profile()
	binding := md.Binding()
	txCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	owner, err := binding.Begin(txCtx)
	if err != nil {
		return nil
	}
	defer func() { _ = owner.Rollback(context.Background()) }()
	access := owner.Access()
	wFresh, err := world.NewFreshCityParticipant(txCtx, binding, access, profile)
	if err != nil {
		return nil
	}
	domFresh, err := domestic.NewFreshCityParticipant(txCtx, binding, access, profile, hub)
	if err != nil {
		return nil
	}
	milFresh := md.FreshCity()
	if milFresh == nil {
		return nil
	}
	if err := wFresh.Pin(txCtx, access); err != nil {
		return nil
	}
	if err := milFresh.Pin(txCtx, access); err != nil {
		return nil
	}
	return &api.FirstCityPreparedCreationSource{
		Dom: domFresh, World: wFresh, Mil: milFresh, Binding: binding, Profile: profile,
	}
}