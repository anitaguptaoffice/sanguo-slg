package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
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
	applyData002CoreSubsetSeeds(t, ctx, pool)
	store := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, store, 1); err != nil {
		t.Fatal(err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	clk := &integrationClock{t: time.Unix(1_700_000_000, 0)}
	domHub := domestic.NewHub(clk.Now)
	domHub.UseStore(domestic.NewPGStore(pool), 1, 0)
	milHub := march.NewHub(clk.Now)
	apiSrv := api.NewServer(log, pool, world.NewService(store), domHub, milHub)
	apiSrv.SetClock(clk.Now)
	if err := apiSrv.WireM4Content(ctx); err != nil {
		t.Fatal(err)
	}

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
		Payload:   mustMarshal(&worldv1.CreateCityRequest{ServerId: 1, Name: "Home", X: smokeBuildableCityTile(t).X, Y: smokeBuildableCityTile(t).Y}),
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
	// At 120 food/hour, two wall-clock seconds need not accrue a whole unit.
	clk.set(clk.Now().Add(time.Minute))
	domHub.Tick()
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

	// Farm level 2 requires hall level 2 under the existing building rules.
	hall := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartBuildingUpgrade, TraceId: "hall1", SessionId: sid,
		Payload: mustMarshal(&domesticv1.StartBuildingUpgradeRequest{
			CityId: cityID, SlotKey: "hall", BuildingCfgId: 1,
		}),
	})
	if hall.Code != 0 {
		t.Fatalf("hall prerequisite upgrade: %+v", hall)
	}
	var hallUpgrade domesticv1.StartBuildingUpgradeResponse
	if err := proto.Unmarshal(hall.Data, &hallUpgrade); err != nil {
		t.Fatal(err)
	}
	if hallUpgrade.GetFinishAtMs() <= clk.Now().UnixMilli() {
		t.Fatal("missing hall upgrade finish")
	}
	clk.set(time.UnixMilli(hallUpgrade.GetFinishAtMs()).Add(time.Second))
	domHub.Tick()

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
	applyData002CoreSubsetSeeds(t, ctx, pool)
	store := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, store, 1); err != nil {
		t.Fatal(err)
	}

	clk := &integrationClock{t: time.Unix(1_700_100_000, 0)}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	domHub := domestic.NewHub(clk.Now)
	domHub.UseStore(domestic.NewPGStore(pool), 1, 0)
	milHub := march.NewHub(clk.Now)
	reportSvc := api.WireM2Combat(1, pool, milHub)
	apiSrv := api.NewServer(log, pool, world.NewService(store), domHub, milHub)
	apiSrv.SetClock(clk.Now)
	apiSrv.AttachBattleReports(reportSvc)
	if err := apiSrv.WireM4Content(ctx); err != nil {
		t.Fatal(err)
	}

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
		Payload:   mustMarshal(&worldv1.CreateCityRequest{ServerId: 1, Name: "Camp", X: smokeBuildableCityTile(t).X, Y: smokeBuildableCityTile(t).Y}),
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

// openDB gives each API test an isolated schema. Reopened pools use the same
// search_path so restart assertions exercise persisted state, not a fresh fixture.
func openDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	admin, err := db.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("api_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		defer admin.Close()
		if _, err := admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("drop isolated test schema: %v", err)
		}
	})
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		u, err := url.Parse(dsn)
		if err != nil {
			t.Fatal(err)
		}
		q := u.Query()
		q.Set("search_path", schema)
		u.RawQuery = q.Encode()
		dsn = u.String()
	} else {
		dsn += " search_path=" + schema
	}
	t.Setenv("DATABASE_URL", dsn)
	pool, err := db.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}

type smokeCityTile struct{ X, Y int32 }

// Match the deterministic production map generator; never mutate terrain just
// to make a fixture pass. Leave room for nearby march targets.
func smokeBuildableCityTile(t *testing.T) smokeCityTile {
	t.Helper()
	for _, cell := range world.GenerateChunk(1, 0, 0) {
		if cell.Buildable() && cell.X >= 10 && cell.Y >= 10 && cell.X < 40 && cell.Y < 40 {
			return smokeCityTile{int32(cell.X), int32(cell.Y)}
		}
	}
	t.Fatal("no buildable city tile in deterministic production map")
	return smokeCityTile{}
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
	// Cumulative wave smokes issue hundreds of requests. Respect the unchanged
	// production gateway rate rather than disabling its limiter or retrying
	// potentially mutating packets after a rate-limit response.
	time.Sleep(time.Duration(float64(time.Second) / gateway.DefaultConfig().MessagesPerSecond))
	if err := c.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if err := c.SetReadDeadline(time.Now().Add(10 * time.Second)); err != nil {
		t.Fatal(err)
	}
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
