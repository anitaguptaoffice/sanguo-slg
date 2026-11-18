package runtime

import (
	"context"
	"io"
	"log/slog"
	"maps"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/config"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func TestPGPreparedMarchLoopbackWriter(t *testing.T) {
	pool, profile := preparedProfilePG(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	cfg := config.Config{HTTPAddr: "127.0.0.1:0", PreparedFirstCity: true, PreparedRecruit: true, PreparedMarch: true}
	cfg.MILFreshProfileFile = writeMilProfile(t, milFile(profile))
	app := &App{Config: cfg, DB: pool, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	if startup, err := app.acquireLocalMarchStartup(ctx); startup != nil || err == nil {
		t.Fatal("incomplete inventory obtained the writer lease", err)
	}
	names := strings.Fields(`account account_pkey uq_account_login_name account_account_id_seq account_session account_session_pkey
		idx_account_session_account player player_pkey uq_player_account_per_server idx_player_account
		march_order march_order_pkey idx_march_arrive idx_march_return field_army field_army_pkey idx_field_army_owner army_troop army_troop_pkey`)
	for _, name := range names {
		var identity freshsource.ObjectIdentity
		preparedCheck(t, pool.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2",
			profile.SchemaOID, name).Scan(&identity.OID, &identity.OwnerOID))
		profile.Objects[name] = identity
	}
	wrong := profile
	wrong.Objects = maps.Clone(profile.Objects)
	drift := wrong.Objects["city_troop"]
	drift.OID++
	wrong.Objects["city_troop"] = drift
	app.Config.MILFreshProfileFile = writeMilProfile(t, milFile(wrong))
	if startup, err := app.acquireLocalMarchStartup(ctx); startup != nil || err == nil || !strings.Contains(err.Error(), "city_troop") {
		t.Fatal("live object drift obtained the writer lease", err)
	}
	app.Config.MILFreshProfileFile = writeMilProfile(t, milFile(profile))
	if srv, err := app.NewAPIServer(ctx); srv != nil || err == nil {
		t.Fatal("prepared API server bypassed writer lease", err)
	}
	for _, invalid := range []config.Config{
		{PreparedMarch: true, PreparedFirstCity: true, HTTPAddr: cfg.HTTPAddr, MILFreshProfileFile: app.Config.MILFreshProfileFile},
		{PreparedMarch: true, PreparedRecruit: true, HTTPAddr: cfg.HTTPAddr, MILFreshProfileFile: app.Config.MILFreshProfileFile},
		{PreparedMarch: true, PreparedRecruit: true, PreparedFirstCity: true, HTTPAddr: "0.0.0.0:0", MILFreshProfileFile: app.Config.MILFreshProfileFile},
	} {
		if err := (&App{Config: invalid, DB: pool}).validatePreparedFirstCityLocal(); err == nil {
			t.Fatal("invalid local-only flags reached startup", invalid)
		}
	}
	owner, err := app.acquireLocalMarchStartup(ctx)
	preparedCheck(t, err)
	t.Cleanup(func() { _ = owner.close() })
	p := owner.profiles
	if len(p.military.Objects) != 14 || len(p.recruit.Objects) != 34 || len(p.march.Objects) != 43 || len(profile.Objects) != 49 {
		t.Fatal("startup assembled the wrong reviewed source inventories")
	}
	other := &App{Config: app.Config, DB: pool, Log: app.Log}
	if competing, err := other.acquireLocalMarchStartup(ctx); competing != nil || err == nil || !strings.Contains(err.Error(), "already active") {
		t.Fatal("another owner acquired the same live namespace", err)
	}
	preparedCheck(t, owner.close())
	restarted, err := other.acquireLocalMarchStartup(ctx)
	preparedCheck(t, err)
	t.Cleanup(func() { _ = restarted.close() })
	runCtx, stop := context.WithCancel(ctx)
	srv, err := other.newAPIServer(runCtx, restarted)
	t.Cleanup(stop)
	preparedCheck(t, err)
	stopWorker := startPreparedWorker(runCtx, srv.RunPreparedMarchScheduler, "prepared march")
	preparedCheck(t, stopWorker())
}
