package api_test

import (
	"context"
	"io"
	"log/slog"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

func TestLoginCreateCityUpgradeFlow(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		t.Fatal(err)
	}
	if err := db.SeedDevServer(ctx, pool, 1, "S1"); err != nil {
		t.Fatal(err)
	}
	store := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, store, 1); err != nil {
		t.Fatal(err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	domHub := domestic.NewHub(time.Now)
	milHub := march.NewHub(time.Now)
	apiSrv := api.NewServer(log, pool, world.NewService(store), domHub, milHub)
	go apiSrv.RunDomesticScheduler(ctx)
	go apiSrv.RunMilitaryScheduler(ctx)

	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	gw := gateway.NewServer(log, gwCfg, gateway.AccessControl{}, account.SessionValidator{Svc: apiSrv.AccountService()}, apiSrv.GatewayRouter())
	ts := httptest.NewServer(gw.Handler())
	defer ts.Close()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")
	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := "intg_" + time.Now().Format("150405")
	mustSend(t, c, &commonv1.ClientPacket{
		Route:   account.RouteRegister,
		TraceId: "r1",
		Payload: mustMarshal(&accountv1.RegisterRequest{LoginName: loginName, Password: "secret"}),
	})

	loginResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:   account.RouteLogin,
		TraceId: "l1",
		Payload: mustMarshal(&accountv1.LoginRequest{LoginName: loginName, Password: "secret", ServerId: 1}),
	})
	if loginResp.Code != 0 {
		t.Fatalf("login: %+v", loginResp)
	}
	var login accountv1.LoginResponse
	if err := proto.Unmarshal(loginResp.Data, &login); err != nil {
		t.Fatal(err)
	}
	sid := login.GetSessionId()
	playerID := login.GetPlayer().GetPlayerId()

	createResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteCreateCity,
		TraceId:   "c1",
		SessionId: sid,
		Payload:   mustMarshal(&worldv1.CreateCityRequest{ServerId: 1, Name: "Home", X: 60, Y: 60}),
	})
	if createResp.Code != 0 {
		t.Fatalf("create city: %+v", createResp)
	}
	var created worldv1.CreateCityResponse
	if err := proto.Unmarshal(createResp.Data, &created); err != nil {
		t.Fatal(err)
	}
	cityID := created.GetCity().GetCityId()

	before := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteGetCityState,
		TraceId:   "g1",
		SessionId: sid,
		Payload:   mustMarshal(&domesticv1.GetCityStateRequest{CityId: cityID}),
	})
	var st0 domesticv1.GetCityStateResponse
	_ = proto.Unmarshal(before.Data, &st0)
	time.Sleep(2 * time.Second)
	after := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteGetCityState,
		TraceId:   "g2",
		SessionId: sid,
		Payload:   mustMarshal(&domesticv1.GetCityStateRequest{CityId: cityID}),
	})
	var st1 domesticv1.GetCityStateResponse
	_ = proto.Unmarshal(after.Data, &st1)
	if st1.GetWallet().GetFood() <= st0.GetWallet().GetFood() {
		t.Fatalf("expected food accrual, before=%d after=%d", st0.GetWallet().GetFood(), st1.GetWallet().GetFood())
	}

	up := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteStartBuildingUpgrade,
		TraceId:   "u1",
		SessionId: sid,
		Payload: mustMarshal(&domesticv1.StartBuildingUpgradeRequest{
			CityId: cityID, SlotKey: "farm", BuildingCfgId: 2,
		}),
	})
	if up.Code != 0 {
		t.Fatalf("upgrade: %+v", up)
	}

	beforeRecruit := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteGetCityState,
		TraceId:   "g3",
		SessionId: sid,
		Payload:   mustMarshal(&domesticv1.GetCityStateRequest{CityId: cityID}),
	})
	var stBefore domesticv1.GetCityStateResponse
	_ = proto.Unmarshal(beforeRecruit.Data, &stBefore)

	recruit := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteRecruitTroop,
		TraceId:   "rt1",
		SessionId: sid,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: 1, Count: 5,
		}),
	})
	if recruit.Code != 0 {
		t.Fatalf("recruit: %+v", recruit)
	}
	var recruitOut militaryv1.RecruitTroopResponse
	_ = proto.Unmarshal(recruit.Data, &recruitOut)
	if recruitOut.GetWallet().GetFood() >= stBefore.GetWallet().GetFood() {
		t.Fatalf("recruit should debit food")
	}

	milHub.City(cityID).Troops[1] = 30
	heroID := smokeEnsureMarchHeroID(t, ctx, c, apiSrv, sid, playerID)
	marchResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteStartMarch,
		TraceId:   "sm1",
		SessionId: sid,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 65, ToY: 65, Purpose: 1, HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 10}},
		}),
	})
	if marchResp.Code != 0 {
		t.Fatalf("start march: %+v", marchResp)
	}
	var marchOut militaryv1.StartMarchResponse
	_ = proto.Unmarshal(marchResp.Data, &marchOut)
	if marchOut.GetMarch().GetMarchId() == 0 {
		t.Fatal("expected march id")
	}
}

func TestM2BattleReportSmokePath(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		t.Fatal(err)
	}
	if err := db.SeedDevServer(ctx, pool, 1, "S1"); err != nil {
		t.Fatal(err)
	}
	store := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, store, 1); err != nil {
		t.Fatal(err)
	}

	clk := &integrationClock{t: time.Unix(1_700_100_000, 0)}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	domHub := domestic.NewHub(clk.Now)
	milHub := march.NewHub(clk.Now)
	reportSvc := api.WireM2Combat(1, pool, milHub)
	apiSrv := api.NewServer(log, pool, world.NewService(store), domHub, milHub)
	apiSrv.SetClock(clk.Now)
	apiSrv.AttachBattleReports(reportSvc)
	go apiSrv.RunDomesticScheduler(ctx)
	go apiSrv.RunMilitaryScheduler(ctx)

	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	gw := gateway.NewServer(log, gwCfg, gateway.AccessControl{}, account.SessionValidator{Svc: apiSrv.AccountService()}, apiSrv.GatewayRouter())
	ts := httptest.NewServer(gw.Handler())
	defer ts.Close()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")
	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := "m2_" + time.Now().Format("150405.000")
	mustSend(t, c, &commonv1.ClientPacket{
		Route:   account.RouteRegister,
		TraceId: "r1",
		Payload: mustMarshal(&accountv1.RegisterRequest{LoginName: loginName, Password: "secret"}),
	})
	loginResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:   account.RouteLogin,
		TraceId: "l1",
		Payload: mustMarshal(&accountv1.LoginRequest{LoginName: loginName, Password: "secret", ServerId: 1}),
	})
	if loginResp.Code != 0 {
		t.Fatalf("login: %+v", loginResp)
	}
	var login accountv1.LoginResponse
	if err := proto.Unmarshal(loginResp.Data, &login); err != nil {
		t.Fatal(err)
	}
	sid := login.GetSessionId()
	playerID := login.GetPlayer().GetPlayerId()

	createResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteCreateCity,
		TraceId:   "c1",
		SessionId: sid,
		Payload:   mustMarshal(&worldv1.CreateCityRequest{ServerId: 1, Name: "Camp", X: 3, Y: 3}),
	})
	if createResp.Code != 0 {
		t.Fatalf("create city: %+v", createResp)
	}
	var created worldv1.CreateCityResponse
	if err := proto.Unmarshal(createResp.Data, &created); err != nil {
		t.Fatal(err)
	}
	cityID := created.GetCity().GetCityId()

	mc := milHub.City(cityID)
	if mc == nil {
		t.Fatal("military city missing")
	}
	mc.Troops[1] = 200
	mc.Troops[2] = 50

	heroID := smokeEnsureMarchHeroID(t, ctx, c, apiSrv, sid, playerID)
	marchResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteStartMarch,
		TraceId:   "sm1",
		SessionId: sid,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 5, ToY: 5, Purpose: int32(combat.PurposeAttack), HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{
				{UnitCfgId: 1, Count: 150},
				{UnitCfgId: 2, Count: 40},
			},
		}),
	})
	if marchResp.Code != 0 {
		t.Fatalf("start march: %+v", marchResp)
	}
	var marchOut militaryv1.StartMarchResponse
	if err := proto.Unmarshal(marchResp.Data, &marchOut); err != nil {
		t.Fatal(err)
	}
	arriveMS := marchOut.GetMarch().GetArriveAtMs()
	if arriveMS == 0 {
		t.Fatal("missing arrive time")
	}
	clk.set(time.UnixMilli(arriveMS).Add(2 * time.Second))
	milHub.Tick()

	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteListBattleReports,
		TraceId:   "br1",
		SessionId: sid,
		Payload:   mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: 5}),
	})
	if listResp.Code != 0 {
		t.Fatalf("list reports: %+v", listResp)
	}
	var listOut militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Fatal(err)
	}
	if listOut.GetTotal() < 1 || len(listOut.GetReports()) == 0 {
		t.Fatal("expected battle report after march arrive")
	}
	reportID := listOut.GetReports()[0].GetReportId()
	if reportID == 0 {
		t.Fatal("missing report id")
	}

	getResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteGetBattleReport,
		TraceId:   "br2",
		SessionId: sid,
		Payload:   mustMarshal(&militaryv1.GetBattleReportRequest{ReportId: reportID}),
	})
	if getResp.Code != 0 {
		t.Fatalf("get report: %+v", getResp)
	}
	var getOut militaryv1.GetBattleReportResponse
	if err := proto.Unmarshal(getResp.Data, &getOut); err != nil {
		t.Fatal(err)
	}
	if getOut.GetReport().GetDetail().GetResult() == "" {
		t.Fatal("expected battle detail")
	}
}

type integrationClock struct {
	t time.Time
}

func (c *integrationClock) Now() time.Time { return c.t }

func (c *integrationClock) set(nt time.Time) { c.t = nt }

func openDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	return pool
}

func dial(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func mustSend(t *testing.T, c *websocket.Conn, pkt *commonv1.ClientPacket) *commonv1.ServerPacket {
	t.Helper()
	frame, err := proto.Marshal(pkt)
	if err != nil {
		t.Fatal(err)
	}
	if err := c.WriteMessage(websocket.BinaryMessage, frame); err != nil {
		t.Fatal(err)
	}
	_, data, err := c.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var resp commonv1.ServerPacket
	if err := proto.Unmarshal(data, &resp); err != nil {
		t.Fatal(err)
	}
	return &resp
}

func mustMarshal(msg proto.Message) []byte {
	b, err := proto.Marshal(msg)
	if err != nil {
		panic(err)
	}
	return b
}
