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
	apiSrv := api.NewServer(log, pool, world.NewService(store), domestic.NewHub(time.Now))
	go apiSrv.RunDomesticScheduler(ctx)

	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	gw := gateway.NewServer(log, gwCfg, gateway.AccessControl{}, account.SessionValidator{Svc: apiSrv.AccountService()}, apiSrv.GatewayRouter())
	ts := httptest.NewServer(gw.Handler())
	defer ts.Close()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")
	c := dial(t, wsURL)
	defer c.Close()

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
}

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
