package runtime

import (
	"context"
	"net/http"
	"path/filepath"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	platformdb "github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
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
	return nil
}

// HTTPHandler returns health checks and the WebSocket gateway.
func (a *App) HTTPHandler(ctx context.Context, apiSrv *api.Server) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)

	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	validator := account.SessionValidator{Svc: apiSrv.AccountService()}
	gateway.Mount(mux, a.Log, gwCfg, gateway.AccessControl{}, validator, apiSrv.GatewayRouter())
	return mux
}

// NewAPIServer constructs the integration server and starts domestic scheduling.
func (a *App) NewAPIServer(ctx context.Context) *api.Server {
	worldSvc := world.NewService(world.NewPGStore(a.DB))
	hub := domestic.NewHub(time.Now)
	hub.UseStore(domestic.NewPGStore(a.DB), defaultShardID, 30*time.Second)
	militaryHub := march.NewHub(time.Now)
	srv := api.NewServer(a.Log, a.DB, worldSvc, hub, militaryHub)
	go srv.RunDomesticScheduler(ctx)
	go srv.RunMilitaryScheduler(ctx)
	return srv
}
