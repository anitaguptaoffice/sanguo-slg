package runtime

import (
	"context"
	"encoding/json"
	"fmt"
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
	return nil
}

// HTTPHandler returns health checks and the WebSocket gateway.
func (a *App) HTTPHandler(ctx context.Context, apiSrv *api.Server) http.Handler {
	mux := http.NewServeMux()
	if a.Config.PreparedFirstCity {
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
	} else {
		mux.HandleFunc("/healthz", healthz)
	}

	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	gwCfg.PreparedRecruit = a.Config.PreparedRecruit
	validator := account.SessionValidator{Svc: apiSrv.AccountService()}
	router := apiSrv.GatewayRouter()
	if a.Config.PreparedFirstCity {
		router = router.WithoutRoutes(api.RouteCreateCity, api.RouteRecruitTroop)
		if !a.Config.PreparedMarch {
			router = router.WithoutRoutes(api.RouteStartMarch)
		}
	} else {
		api.MountGmHTTP(mux, apiSrv.Gm())
	}
	gateway.Mount(mux, a.Log, gwCfg, gateway.AccessControl{}, validator, router)
	return mux
}

// NewAPIServer constructs the integration server and starts domestic scheduling.
func (a *App) NewAPIServer(ctx context.Context) (*api.Server, error) {
	return a.newAPIServer(ctx, nil)
}

func (a *App) newAPIServer(ctx context.Context, startup *localMarchStartup) (*api.Server, error) {
	if err := a.validatePreparedFirstCityLocal(); err != nil {
		return nil, err
	}
	if a.Config.PreparedMarch && startup == nil {
		return nil, fmt.Errorf("prepared march requires the local server writer lease")
	}
	worldSvc := world.NewService(world.NewPGStore(a.DB))
	hub := domestic.NewHub(time.Now)
	hub.UseStore(domestic.NewPGStore(a.DB), defaultShardID, 30*time.Second)
	militaryHub := march.NewHub(time.Now)
	reportSvc := api.WireM2Combat(defaultShardID, a.DB, militaryHub)
	srv := api.NewServer(a.Log, a.DB, worldSvc, hub, militaryHub)
	srv.AttachBattleReports(reportSvc)
	var military *api.MilitaryDurable
	var profiles *preparedCityProfiles
	if startup != nil {
		profiles = startup.profiles
		var err error
		military, err = composeMilitary(ctx, a.DB, profiles.military, profiles.catalog)
		if err != nil {
			return nil, fmt.Errorf("compose local prepared military: %w", err)
		}
	} else {
		military, profiles = composeMilitaryStartup(ctx, a.Log, a.DB, a.Config.MILFreshProfileFile)
	}
	srv.AttachMilitaryDurable(military)
	var prepared *api.FirstCityPreparedCreationSource
	if a.Config.PreparedFirstCity {
		var err error
		if prepared, err = composeFirstCityPreparedSource(ctx, military, profiles, a.DB, hub); err != nil {
			return nil, fmt.Errorf("compose prepared first-city: %w", err)
		}
	}
	composeFirstCity(srv, prepared)
	if a.Config.PreparedRecruit && !a.Config.PreparedMarch {
		if profiles == nil || profiles.recruit == nil {
			return nil, fmt.Errorf("prepared recruit requires the complete ACCOUNT, WORLD, DOM and MIL profile")
		}
		if err := srv.WirePreparedRecruit(ctx, *profiles.recruit, profiles.catalog); err != nil {
			return nil, fmt.Errorf("compose prepared recruit: %w", err)
		}
	}
	if a.Config.PreparedFirstCity {
		if err := srv.RestorePreparedMarches(ctx); err != nil {
			return nil, fmt.Errorf("restore prepared march: %w", err)
		}
	}
	if a.Config.PreparedMarch {
		if err := srv.WirePreparedMarch(ctx, *profiles.march, profiles.catalog); err != nil {
			return nil, fmt.Errorf("wire local prepared march: %w", err)
		}
	}
	if err := srv.WireM4Content(ctx); err != nil {
		a.Log.Error("m4 content wire failed", "err", err)
	}
	go srv.RunDomesticScheduler(ctx)
	if !a.Config.PreparedFirstCity {
		go srv.RunMilitaryScheduler(ctx)
	}
	go srv.RunRankScheduler(ctx)
	return srv, nil
}
