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
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

type handlerClock struct {
	t time.Time
}

func (c *handlerClock) Now() time.Time { return c.t }

func TestRecruitTroopDebitsWalletAndStartMarchCreatesOrder(t *testing.T) {
	clk := &handlerClock{t: time.Unix(1_700_000_000, 0)}
	domHub := domestic.NewHub(clk.Now)
	milHub := march.NewHub(clk.Now)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := api.NewServer(log, nil, world.NewService(handlerOwnershipStore{}), domHub, milHub)
	srv.SetClock(clk.Now)

	const cityID = 42
	const playerID = 99
	domCity := &domestic.CityState{
		ID:       cityID,
		PlayerID: playerID,
		Wallet:   domestic.Resources{Food: 10_000, Wood: 10_000, Iron: 5000, Stone: 5000},
		Buildings: map[string]*domestic.BuildingInstance{
			"hall": {CfgID: 1, Level: 1},
		},
	}
	domHub.RegisterCity(domCity)
	srv.RegisterCityForTest(cityID, domCity, 60, 61)
	heroID := seedIdleHeroForTest(t, srv, 1, playerID)

	sid := "test-session"
	srv.BindSessionForTest(sid, api.PlayerContext{ServerID: 1, PlayerID: playerID})

	router := srv.GatewayRouter()
	ctx := context.Background()

	beforeFood := domCity.Wallet.Food
	recruitPkt := &commonv1.ClientPacket{
		Route:     api.RouteRecruitTroop,
		TraceId:   "recruit",
		SessionId: sid,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: 1, Count: 10,
		}),
	}
	recruitResp := router.Dispatch(ctx, recruitPkt)
	if recruitResp.Code != 0 {
		t.Fatalf("recruit: code=%d msg=%s", recruitResp.Code, recruitResp.Msg)
	}
	var recruitOut militaryv1.RecruitTroopResponse
	if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
		t.Fatal(err)
	}
	if domCity.Wallet.Food >= beforeFood {
		t.Fatalf("expected food debit, before=%d after=%d", beforeFood, domCity.Wallet.Food)
	}
	if recruitOut.GetWallet().GetFood() != domCity.Wallet.Food {
		t.Fatalf("wallet mismatch resp=%d dom=%d", recruitOut.GetWallet().GetFood(), domCity.Wallet.Food)
	}

	mc := milHub.City(cityID)
	mc.Troops[1] = 50

	marchPkt := &commonv1.ClientPacket{
		Route:     api.RouteStartMarch,
		TraceId:   "march",
		SessionId: sid,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId:  cityID,
			ToX:     70,
			ToY:     71,
			Purpose: 1,
			HeroId:  heroID,
			Troops:  []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 20}},
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
	if marchOut.GetMarch().GetMarchId() == 0 {
		t.Fatal("expected march id")
	}
	if mc.Troops[1] != 30 {
		t.Fatalf("troops left %d", mc.Troops[1])
	}

	listPkt := &commonv1.ClientPacket{
		Route:     api.RouteListMarches,
		TraceId:   "list",
		SessionId: sid,
		Payload:   mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID}),
	}
	listResp := router.Dispatch(ctx, listPkt)
	if listResp.Code != 0 {
		t.Fatalf("list marches: code=%d msg=%s", listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Fatal(err)
	}
	wantID := marchOut.GetMarch().GetMarchId()
	var found bool
	for _, m := range listOut.GetMarches() {
		if m.GetMarchId() == wantID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("list marches missing march_id=%d total=%d", wantID, listOut.GetTotal())
	}
}

// Explicit shard-scoped ownership for the in-memory handler fixture.
type handlerOwnershipStore struct{ world.Store }

func (handlerOwnershipStore) PlayerCities(_ context.Context, sid int32, pid int64) ([]world.City, error) {
	if sid == 1 && pid == 99 {
		return []world.City{{ServerID: 1, CityID: 42, PlayerID: 99}}, nil
	}
	return nil, nil
}
