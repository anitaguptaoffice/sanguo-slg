package api_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

func seedIdleHeroForTest(t *testing.T, srv *api.Server, serverID int32, playerID int64) int64 {
	t.Helper()
	svc := hero.NewService()
	srv.SetHeroServiceForTest(svc)
	ctx := context.Background()
	h := &hero.Hero{
		ServerID: serverID, HeroID: 501, PlayerID: playerID, TemplateCfgID: 1001,
		Level: 1, Loyalty: hero.LoyaltyDefault, Status: hero.StatusIdle, CreatedAt: time.Now(),
	}
	if err := svc.Store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	return h.HeroID
}

func TestStartMarchRequiresHeroAndRestoresAfterReturn(t *testing.T) {
	clk := &handlerClock{t: time.Unix(1_700_000_000, 0)}
	domHub := domestic.NewHub(clk.Now)
	milHub := march.NewHub(clk.Now)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := api.NewServer(log, nil, world.NewService(handlerOwnershipStore{}), domHub, milHub)
	srv.SetClock(clk.Now)

	const cityID = 42
	const playerID = 99
	domCity := &domestic.CityState{
		ID: cityID, PlayerID: playerID,
		Wallet: domestic.Resources{Food: 10_000, Wood: 10_000, Iron: 5000, Stone: 5000},
	}
	domHub.RegisterCity(domCity)
	srv.RegisterCityForTest(cityID, domCity, 60, 61)
	sid := "test-session"
	srv.BindSessionForTest(sid, api.PlayerContext{ServerID: 1, PlayerID: playerID})
	heroID := seedIdleHeroForTest(t, srv, 1, playerID)
	router := srv.GatewayRouter()
	ctx := context.Background()

	mc := milHub.City(cityID)
	mc.Troops[1] = 50

	missingHero := router.Dispatch(ctx, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "no-hero", SessionId: sid,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 70, ToY: 71, Purpose: 1,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 5}},
		}),
	})
	if missingHero.Code == 0 {
		t.Fatal("expected error without hero_id")
	}

	_ = srv.HeroService().Store.SaveMarchForceState(ctx, hero.MarchForceState{
		ServerID: 1, HeroID: heroID, Current: hero.MarchForceMarchCost - 1,
		LastRegenAt: clk.Now(),
	})
	lowResp := router.Dispatch(ctx, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "low-force", SessionId: sid,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 70, ToY: 71, Purpose: 1, HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 5}},
		}),
	})
	if lowResp.Code == 0 {
		t.Fatal("expected error when march force too low")
	}
	_ = srv.HeroService().Store.SaveMarchForceState(ctx, hero.MarchForceState{
		ServerID: 1, HeroID: heroID, Current: hero.MarchForceMax(1),
		LastRegenAt: clk.Now(),
	})

	marchPkt := &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "march", SessionId: sid,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 70, ToY: 71, Purpose: 1, HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 20}},
		}),
	}
	marchResp := router.Dispatch(ctx, marchPkt)
	if marchResp.Code != 0 {
		t.Fatalf("march: code=%d msg=%s", marchResp.Code, marchResp.Msg)
	}
	var marchOut militaryv1.StartMarchResponse
	if err := proto.Unmarshal(marchResp.Data, &marchOut); err != nil {
		t.Fatal(err)
	}
	got, _ := srv.HeroService().Store.GetHero(ctx, 1, heroID)
	if got.Status != hero.StatusMarch {
		t.Fatalf("expected marching status, got %d", got.Status)
	}

	order := milHub.March(marchOut.GetMarch().GetMarchId())
	clk.t = order.ArriveAt.Add(time.Second)
	milHub.Tick()

	got, _ = srv.HeroService().Store.GetHero(ctx, 1, heroID)
	if got.Status != hero.StatusIdle {
		t.Fatalf("expected idle after march end, got %d", got.Status)
	}
}
