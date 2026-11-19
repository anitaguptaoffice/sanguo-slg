package runtime

import (
	"context"
	"encoding/json"
	"net/http"
	"path/filepath"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	platformdb "github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

const defaultShardID = 1

// PrepareGame applies DDL, seeds the dev shard, and initializes the world map.
func (a *App) PrepareGame(ctx context.Context, repoRoot string) error {
	specDir := filepath.Join(repoRoot, "spec", "db")
	if err := platformdb.ApplySpecs(ctx, a.DB, specDir); err != nil {
		return err
	}
	if err := platformdb.SeedDevServer(ctx, a.DB, defaultShardID, "Dev-1"); err != nil {
		return err
	}
	store := world.NewPGStore(a.DB)
	if err := world.InitServerMap(ctx, store, defaultShardID); err != nil {
		return err
	}
	return ensureCityOrigins(ctx, a.DB)
}

// HTTPHandler returns health checks and the WebSocket gateway.
func (a *App) HTTPHandler(ctx context.Context, apiSrv *api.Server) http.Handler {
	mux := http.NewServeMux()
	ready := apiSrv.MarchRestoreReady()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		status, restore := "ok", "ready"
		if !ready {
			status, restore = "unavailable", "unavailable"
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": status, "march_restore": restore})
	})
	if !ready {
		return mux
	}

	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	validator := account.SessionValidator{Svc: apiSrv.AccountService()}
	api.MountGmHTTP(mux, apiSrv.Gm())
	gateway.Mount(mux, a.Log, gwCfg, gateway.AccessControl{}, validator, apiSrv.GatewayRouter())
	return mux
}

// NewAPIServer constructs the integration server and starts domestic scheduling.
func (a *App) NewAPIServer(ctx context.Context) (*api.Server, error) {
	return a.newAPIServer(ctx)
}

func (a *App) newAPIServer(ctx context.Context) (*api.Server, error) {
	worldSvc := world.NewService(world.NewPGStore(a.DB))
	hub := domestic.NewHub(time.Now)
	hub.UseStore(domestic.NewPGStore(a.DB), defaultShardID, 30*time.Second)
	militaryHub := march.NewHub(time.Now)
	reportSvc := api.WireM2Combat(defaultShardID, a.DB, militaryHub)
	srv := api.NewServer(a.Log, a.DB, worldSvc, hub, militaryHub)
	srv.AttachBattleReports(reportSvc)

	military, profiles, err := composeRuntimeMilitary(ctx, a.DB)
	if err != nil {
		return nil, err
	}
	srv.AttachMilitaryDurable(military)
	prepared, err := composeFirstCityPreparedSource(ctx, military, profiles, a.DB, hub)
	if err != nil {
		return nil, err
	}
	composeFirstCity(srv, prepared)
	if err := srv.RestorePreparedMarches(ctx); err != nil {
		return nil, err
	}
	if err := srv.WirePreparedMarch(ctx, *profiles.march, profiles.catalog); err != nil {
		return nil, err
	}
	if err := srv.WireM4Content(ctx); err != nil {
		a.Log.Error("m4 content wire failed", "err", err)
	}
	go srv.RunDomesticScheduler(ctx)
	go srv.RunRankScheduler(ctx)
	return srv, nil
}
