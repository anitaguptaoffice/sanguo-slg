package runtime

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
)

func (a *App) validatePreparedFirstCityLocal() error {
	if !a.Config.PreparedFirstCity {
		return nil
	}
	host, _, err := net.SplitHostPort(a.Config.HTTPAddr)
	if err != nil || !net.ParseIP(host).IsLoopback() {
		return fmt.Errorf("prepared first-city requires a loopback HTTP listener")
	}
	if a.DB == nil {
		return fmt.Errorf("prepared first-city requires a local PostgreSQL source")
	}
	conn := a.DB.Config().ConnConfig
	if conn.Host != "localhost" && !net.ParseIP(conn.Host).IsLoopback() {
		return fmt.Errorf("prepared first-city requires a loopback PostgreSQL source")
	}
	for _, fallback := range conn.Fallbacks {
		if fallback.Host != "localhost" && !net.ParseIP(fallback.Host).IsLoopback() {
			return fmt.Errorf("prepared first-city requires loopback PostgreSQL fallbacks")
		}
	}
	return nil
}

func composeFirstCityPreparedSource(ctx context.Context, md *api.MilitaryDurable, profiles *preparedCityProfiles, pool *pgxpool.Pool, hub *domestic.Hub) (source *api.FirstCityPreparedCreationSource, err error) {
	if md == nil || profiles == nil || !hub.SupportsAtomicCityCreation(pool, defaultShardID) {
		return nil, fmt.Errorf("prepared first-city requires the reviewed WORLD, DOM and MIL profile")
	}
	binding := md.Binding()
	txCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	owner, err := binding.Begin(txCtx)
	if err != nil {
		return nil, err
	}
	defer func() {
		clean, stop := context.WithTimeout(context.WithoutCancel(txCtx), 5*time.Second)
		defer stop()
		if endErr := owner.Rollback(clean); endErr != nil && err == nil {
			source, err = nil, endErr
		}
		if err == nil && txCtx.Err() != nil {
			source, err = nil, txCtx.Err()
		}
	}()
	access := owner.Access()
	_, err = access.Exec(txCtx, binding, "SELECT pg_catalog.set_config('search_path', $1, true)", "pg_catalog,"+profiles.world.SchemaName)
	if err != nil {
		return nil, err
	}
	wFresh, err := world.NewFreshCityParticipant(txCtx, binding, access, profiles.world)
	if err != nil {
		return nil, err
	}
	domFresh, err := domestic.NewFreshCityParticipant(txCtx, binding, access, profiles.domestic, hub)
	if err != nil {
		return nil, err
	}
	milFresh := md.FreshCity()
	if err := wFresh.Pin(txCtx, access); err != nil {
		return nil, err
	}
	if err := milFresh.Pin(txCtx, access); err != nil {
		return nil, err
	}
	return &api.FirstCityPreparedCreationSource{
		Dom: domFresh, World: wFresh, Mil: milFresh, Binding: binding, Profile: profiles.military,
	}, nil
}
