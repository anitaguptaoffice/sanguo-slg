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
		ServerID: serverID, PlayerID: playerID, TemplateCfgID: 1001,
		Level: 1, Loyalty: hero.LoyaltyDefault, Status: hero.StatusIdle, CreatedAt: time.Now(),
	}
	if err := svc.Store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	return h.HeroID
}

// Engineering integration fixture: bounded synthetic time and a battle outcome,
// not natural-time acceptance or a cross-domain atomic hero-release guarantee.
func TestStartMarchRequiresHeroAndReleasesAfterBattleReturn(t *testing.T) {
	clk := &handlerClock{t: time.Unix(1_700_000_000, 0)}
	domHub := domestic.NewHub(clk.Now)
	milHub := march.NewHub(clk.Now)
	milHub.SetMarchArrivalHandler(func(context.Context, march.MarchArrivalEvent) (march.MarchArrivalOutcome, error) {
		return march.MarchArrivalOutcome{BattleRan: true, ReportID: 17, RemainingTroops: []march.TroopStack{{UnitCfgID: 1, Count: 16}}}, nil
	})
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := api.NewServer(log, nil, world.NewService(handlerOwnershipStore{}), domHub, milHub)
	srv.SetClock(clk.Now)

	const cityID = 42
	const playerID = 99
	domCity := &domestic.CityState{
		ID: cityID, PlayerID: playerID,
		Wallet: domestic.Resources{Food: 10_000, Wood: 10_000, Iron: 5000, Stone: 5000},
	}
	if err := domHub.RegisterCity(domCity); err != nil {
		t.Fatal(err)
	}
	if err := srv.RegisterCityForTest(cityID, domCity, 60, 61); err != nil {
		t.Fatal(err)
	}
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
	list := func() *militaryv1.MarchSummary {
		t.Helper()
		resp := router.Dispatch(ctx, &commonv1.ClientPacket{Route: api.RouteListMarches, SessionId: sid, ServerId: 1,
			Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID})})
		var out militaryv1.ListMarchesResponse
		if resp.Code != 0 || proto.Unmarshal(resp.Data, &out) != nil || out.Total != 1 || len(out.Marches) != 1 {
			t.Fatalf("list: %v", resp)
		}
		return out.Marches[0]
	}
	check := func(phase militaryv1.MarchPhase, status int16, ready int32) *militaryv1.MarchSummary {
		t.Helper()
		row := list()
		h, err := srv.HeroService().Store.GetHero(ctx, 1, heroID)
		if err != nil || h.Status != status || row.Phase != phase || milHub.SnapshotCity(cityID).Troops[1] != ready {
			t.Fatalf("lifecycle: row=%v hero=%v err=%v ready=%v", row, h, err, milHub.SnapshotCity(cityID).Troops)
		}
		return row
	}
	check(militaryv1.MarchPhase_MARCH_PHASE_MARCHING, hero.StatusMarch, 30)
	clk.t = order.ArriveAt
	if milHub.Tick() != 1 {
		t.Fatal("arrival not processed")
	}
	returning := check(militaryv1.MarchPhase_MARCH_PHASE_RETURNING, hero.StatusMarch, 30)
	if len(returning.Troops) != 1 || returning.Troops[0].Count != 16 || returning.ReturnFinishAtMs <= clk.Now().UnixMilli() {
		t.Fatalf("survivors/deadline: %v", returning)
	}
	clk.t = time.UnixMilli(returning.ReturnFinishAtMs)
	// Passing the deadline or reading the list cannot settle troops/release the hero.
	check(militaryv1.MarchPhase_MARCH_PHASE_RETURNING, hero.StatusMarch, 30)
	if milHub.Tick() != 1 {
		t.Fatal("return not processed")
	}
	home := check(militaryv1.MarchPhase_MARCH_PHASE_RETURNED, hero.StatusIdle, 46)
	want := proto.Clone(returning).(*militaryv1.MarchSummary)
	want.Phase, want.ReturnFinishAtMs = militaryv1.MarchPhase_MARCH_PHASE_RETURNED, 0
	if !proto.Equal(home, want) || milHub.March(order.ID).LastReportID != 17 {
		t.Fatalf("returned identity/survivors/report changed: %v", home)
	}
	for i := 0; i < 3; i++ {
		clk.t = clk.t.Add(time.Hour)
		if milHub.Tick() != 0 || !proto.Equal(check(militaryv1.MarchPhase_MARCH_PHASE_RETURNED, hero.StatusIdle, 46), home) {
			t.Fatal("repeat tick/read changed completed return")
		}
	}
	// Preserve the distinct legacy no-battle arrival callback: idle, not returned.
	milHub.SetMarchArrivalHandler(nil)
	resp := router.Dispatch(ctx, marchPkt)
	var noBattle militaryv1.StartMarchResponse
	if resp.Code != 0 || proto.Unmarshal(resp.Data, &noBattle) != nil {
		t.Fatalf("no-battle dispatch: %v", resp)
	}
	second := milHub.March(noBattle.GetMarch().GetMarchId())
	clk.t = second.ArriveAt
	if milHub.Tick() != 1 {
		t.Fatal("no-battle arrival not processed")
	}
	got, err := srv.HeroService().Store.GetHero(ctx, 1, heroID)
	if err != nil || got.Status != hero.StatusIdle || milHub.March(second.ID).Phase != march.PhaseArrived || milHub.SnapshotCity(cityID).Troops[1] != 26 {
		t.Fatalf("no-battle arrival changed: hero=%v err=%v", got, err)
	}
}
