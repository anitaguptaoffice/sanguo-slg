package api_test

import (
	"context"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/shard"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

func TestListGameServersAndServerIDBinding(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		t.Fatal(err)
	}
	if err := db.SeedDevServer(ctx, pool, 1, "S1"); err != nil {
		t.Fatal(err)
	}
	_, err := pool.Exec(ctx, `
		INSERT INTO game_server (server_id, display_name, status, opened_at)
		VALUES (2, 'S2', 1, now())
		ON CONFLICT (server_id) DO UPDATE SET display_name = EXCLUDED.display_name`)
	if err != nil {
		t.Fatal(err)
	}
	store := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, store, 1); err != nil {
		t.Fatal(err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv := api.NewServer(log, pool, world.NewService(store), domestic.NewHub(time.Now), march.NewHub(time.Now))
	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	gw := gateway.NewServer(log, gwCfg, gateway.AccessControl{}, account.SessionValidator{Svc: apiSrv.AccountService()}, apiSrv.GatewayRouter())
	ts := httptest.NewServer(gw.Handler())
	defer ts.Close()
	c := dial(t, "ws"+strings.TrimPrefix(ts.URL, "http"))
	defer func() { _ = c.Close() }()

	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:   shard.RouteListGameServers,
		TraceId: "list1",
		Payload: mustMarshal(&accountv1.ListGameServersRequest{Page: 1}),
	})
	if listResp.Code != 0 {
		t.Fatalf("list servers: %+v", listResp)
	}
	var list accountv1.ListGameServersResponse
	if err := proto.Unmarshal(listResp.Data, &list); err != nil {
		t.Fatal(err)
	}
	if list.GetTotalCount() < 2 || len(list.GetServers()) < 2 {
		t.Fatalf("expected >=2 servers, got total=%d len=%d", list.GetTotalCount(), len(list.GetServers()))
	}

	loginName := "shard_" + time.Now().Format("150405")
	mustSend(t, c, &commonv1.ClientPacket{
		Route:   account.RouteRegister,
		TraceId: "reg",
		Payload: mustMarshal(&accountv1.RegisterRequest{LoginName: loginName, Password: "secret"}),
	})
	loginResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:   account.RouteLogin,
		TraceId: "login",
		Payload: mustMarshal(&accountv1.LoginRequest{LoginName: loginName, Password: "secret", ServerId: 1}),
	})
	if loginResp.Code != 0 {
		t.Fatalf("login: %+v", loginResp)
	}
	var login accountv1.LoginResponse
	_ = proto.Unmarshal(loginResp.Data, &login)
	sid := login.GetSessionId()

	bad := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteListPlayerCities,
		TraceId:   "bad",
		SessionId: sid,
		ServerId:  2,
		Payload:   mustMarshal(&worldv1.ListPlayerCitiesRequest{}),
	})
	if bad.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
		t.Fatalf("expected server_id mismatch, got %+v", bad)
	}

	m3 := mustSend(t, c, &commonv1.ClientPacket{
		Route:     "chat.v1.SendChatMessage",
		TraceId:   "m3",
		SessionId: sid,
		ServerId:  1,
	})
	if m3.Code != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatalf("expected m3 assembly stub, got %+v", m3)
	}
	if m3.Msg == "" || !strings.Contains(m3.Msg, "chat.v1.SendChatMessage") {
		t.Fatalf("unexpected stub msg: %q", m3.Msg)
	}

	enter := mustSend(t, c, &commonv1.ClientPacket{
		Route:     shard.RouteEnterGameServer,
		TraceId:   "enter",
		SessionId: sid,
		ServerId:  1,
		Payload:   mustMarshal(&accountv1.EnterGameServerRequest{ServerId: 1}),
	})
	if enter.Code != 0 {
		t.Fatalf("enter server: %+v", enter)
	}
	var entered accountv1.EnterGameServerResponse
	if err := proto.Unmarshal(enter.Data, &entered); err != nil {
		t.Fatal(err)
	}
	if entered.GetServerId() != 1 || entered.GetPlayer().GetPlayerId() == 0 {
		t.Fatalf("unexpected enter response: %+v", &entered)
	}
}
