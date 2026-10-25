package api

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

type domesticTestClock struct {
	t time.Time
}

func (c *domesticTestClock) Now() time.Time { return c.t }

func TestUseSpeedupShortensBuildAndGetCityState(t *testing.T) {
	clk := &domesticTestClock{t: time.Unix(1_700_000_000, 0)}
	domHub := domestic.NewHub(clk.Now)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := NewServer(log, nil, nil, domHub, march.NewHub(clk.Now))
	srv.now = clk.Now

	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	srv.contentSvc = content.NewService(cat)

	const cityID = 7
	const playerID = 55
	domCity := &domestic.CityState{
		ID:       cityID,
		PlayerID: playerID,
		Wallet:   domestic.Resources{Food: 50_000, Wood: 50_000, Iron: 50_000, Stone: 50_000},
		Buildings: map[string]*domestic.BuildingInstance{
			"hall": {CfgID: 1, Level: 3},
			"farm": {CfgID: 2, Level: 1},
		},
		LastSettleAt: clk.t,
	}
	domHub.RegisterCity(domCity)
	srv.RegisterCityForTest(cityID, domCity, 10, 11)
	srv.world = ownershipWorld(world.City{ServerID: 1, CityID: cityID, PlayerID: playerID})

	p := content.PlayerRef{ServerID: 1, PlayerID: playerID}
	if _, err := srv.contentSvc.Add(p, 2003, 1); err != nil {
		t.Fatal(err)
	}

	sid := "speedup-session"
	srv.BindSessionForTest(sid, PlayerContext{ServerID: 1, PlayerID: playerID})
	ctx := context.Background()

	upResp, err := srv.handleStartBuildingUpgrade(ctx, &commonv1.ClientPacket{
		TraceId: "upgrade", SessionId: sid,
		Payload: mustProto(&domesticv1.StartBuildingUpgradeRequest{
			CityId: cityID, SlotKey: "farm", BuildingCfgId: 2,
		}),
	})
	if err != nil || upResp.Code != 0 {
		t.Fatalf("upgrade: err=%v code=%d", err, upResp.Code)
	}
	var beforeFinish time.Time
	for _, j := range domCity.BuildJobs {
		if j.Status == domestic.QueueActive {
			beforeFinish = j.FinishAt
		}
	}
	if beforeFinish.IsZero() {
		t.Fatal("expected active build job")
	}
	for _, j := range domCity.BuildJobs {
		if j.Status == domestic.QueueActive {
			j.FinishAt = clk.t.Add(10 * time.Minute)
			beforeFinish = j.FinishAt
		}
	}

	useResp, err := srv.handleUseConsumable(ctx, &commonv1.ClientPacket{
		TraceId: "use-speed", SessionId: sid, ServerId: 1,
		Payload: mustProto(&contentv1.UseConsumableRequest{ServerId: 1, ItemCfgId: 2003, Count: 1}),
	})
	if err != nil || useResp.Code != 0 {
		t.Fatalf("use: err=%v code=%d", err, useResp.Code)
	}
	var useOut contentv1.UseConsumableResponse
	if err := proto.Unmarshal(useResp.Data, &useOut); err != nil {
		t.Fatal(err)
	}
	if useOut.GetSpeedupSeconds() != 300 {
		t.Fatalf("speedup_seconds=%d", useOut.GetSpeedupSeconds())
	}

	var afterFinish time.Time
	for _, j := range domCity.BuildJobs {
		if j.Status == domestic.QueueActive {
			afterFinish = j.FinishAt
		}
	}
	if !afterFinish.Equal(beforeFinish.Add(-300 * time.Second)) {
		t.Fatalf("finish before=%v after=%v", beforeFinish, afterFinish)
	}
	if afterFinish.Before(clk.t) {
		t.Fatal("finish before now")
	}

	stateResp, err := srv.handleGetCityState(ctx, &commonv1.ClientPacket{
		TraceId: "state", SessionId: sid,
		Payload: mustProto(&domesticv1.GetCityStateRequest{CityId: cityID}),
	})
	if err != nil || stateResp.Code != 0 {
		t.Fatalf("state: err=%v code=%d", err, stateResp.Code)
	}
	var st domesticv1.GetCityStateResponse
	if err := proto.Unmarshal(stateResp.Data, &st); err != nil {
		t.Fatal(err)
	}
	var farmFinish int64
	for _, b := range st.GetBuildings() {
		if b.GetSlotKey() == "farm" {
			farmFinish = b.GetUpgradeFinishAtMs()
		}
	}
	if farmFinish != afterFinish.UnixMilli() {
		t.Fatalf("upgrade_finish_at_ms=%d want=%d", farmFinish, afterFinish.UnixMilli())
	}
	pr := st.GetProductionRates()
	if pr == nil {
		t.Fatal("missing production_rates")
	}
	if pr.GetFood() < 1 {
		t.Fatalf("production_rates food=%d", pr.GetFood())
	}
}

func TestUseSpeedupWithoutActiveBuildStillConsumes(t *testing.T) {
	clk := &domesticTestClock{t: time.Unix(1_700_000_000, 0)}
	domHub := domestic.NewHub(clk.Now)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := NewServer(log, nil, nil, domHub, march.NewHub(clk.Now))
	srv.now = clk.Now

	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	srv.contentSvc = content.NewService(cat)

	const cityID = 8
	const playerID = 56
	domCity := &domestic.CityState{
		ID: cityID, PlayerID: playerID,
		Wallet: domestic.Resources{Food: 1e4, Wood: 1e4, Iron: 1e4, Stone: 1e4},
		Buildings: map[string]*domestic.BuildingInstance{
			"hall": {CfgID: 1, Level: 1},
		},
		LastSettleAt: clk.t,
	}
	domHub.RegisterCity(domCity)
	srv.RegisterCityForTest(cityID, domCity, 12, 13)

	p := content.PlayerRef{ServerID: 1, PlayerID: playerID}
	if _, err := srv.contentSvc.Add(p, 2003, 1); err != nil {
		t.Fatal(err)
	}
	sid := "speedup-idle"
	srv.BindSessionForTest(sid, PlayerContext{ServerID: 1, PlayerID: playerID})

	useResp, err := srv.handleUseConsumable(context.Background(), &commonv1.ClientPacket{
		TraceId: "use-idle", SessionId: sid, ServerId: 1,
		Payload: mustProto(&contentv1.UseConsumableRequest{ServerId: 1, ItemCfgId: 2003, Count: 1}),
	})
	if err != nil || useResp.Code != 0 {
		t.Fatalf("use: err=%v code=%d", err, useResp.Code)
	}
	var useOut contentv1.UseConsumableResponse
	if err := proto.Unmarshal(useResp.Data, &useOut); err != nil {
		t.Fatal(err)
	}
	if useOut.GetRemaining() != 0 || useOut.GetSpeedupSeconds() != 300 {
		t.Fatalf("remaining=%d speedup=%d", useOut.GetRemaining(), useOut.GetSpeedupSeconds())
	}
}
