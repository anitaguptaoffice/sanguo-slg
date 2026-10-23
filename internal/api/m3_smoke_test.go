package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
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

// TestM3SocialSmokePath covers选服 → 登录进服 → 世界聊天 → 军团 → 排行刷新与查询 (INTG-003).
func TestM3SocialSmokePath(t *testing.T) {
	const serverID = int32(1)
	fail := func(step string, err error) {
		t.Fatalf("M3 smoke failed at step=%q server_id=%d: %v", step, serverID, err)
	}

	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		fail("apply_specs", err)
	}
	if err := db.SeedDevServer(ctx, pool, serverID, "S1"); err != nil {
		fail("seed_dev_server", err)
	}
	store := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, store, serverID); err != nil {
		fail("init_server_map", err)
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
		TraceId: "m3-list",
		Payload: mustMarshal(&accountv1.ListGameServersRequest{Page: 1}),
	})
	if listResp.Code != 0 {
		fail("list_game_servers", fmt.Errorf("code=%d msg=%s", listResp.Code, listResp.Msg))
	}

	loginName := "m3_" + time.Now().Format("150405.000")
	mustSend(t, c, &commonv1.ClientPacket{
		Route:   account.RouteRegister,
		TraceId: "m3-reg",
		Payload: mustMarshal(&accountv1.RegisterRequest{LoginName: loginName, Password: "secret"}),
	})
	loginResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:   account.RouteLogin,
		TraceId: "m3-login",
		Payload: mustMarshal(&accountv1.LoginRequest{LoginName: loginName, Password: "secret", ServerId: serverID}),
	})
	if loginResp.Code != 0 {
		fail("login", fmt.Errorf("code=%d msg=%s", loginResp.Code, loginResp.Msg))
	}
	var login accountv1.LoginResponse
	if err := proto.Unmarshal(loginResp.Data, &login); err != nil {
		fail("login_unmarshal", err)
	}
	sid := login.GetSessionId()
	playerID := login.GetPlayer().GetPlayerId()

	enterResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     shard.RouteEnterGameServer,
		TraceId:   "m3-enter",
		SessionId: sid,
		ServerId:  serverID,
		Payload:   mustMarshal(&accountv1.EnterGameServerRequest{ServerId: serverID}),
	})
	if enterResp.Code != 0 {
		fail("enter_game_server", fmt.Errorf("code=%d msg=%s", enterResp.Code, enterResp.Msg))
	}

	chatResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     chat.RouteSendChatMessage,
		TraceId:   "m3-chat",
		SessionId: sid,
		ServerId:  serverID,
		Payload: mustMarshal(&chatv1.SendChatMessageRequest{
			ServerId: serverID,
			Channel:  chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
			Content:  "hello m3",
		}),
	})
	if chatResp.Code != 0 {
		fail("send_world_chat", fmt.Errorf("code=%d msg=%s", chatResp.Code, chatResp.Msg))
	}

	guildResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     guild.RouteCreateGuild,
		TraceId:   "m3-guild",
		SessionId: sid,
		ServerId:  serverID,
		Payload: mustMarshal(&guildv1.CreateGuildRequest{
			ServerId: serverID,
			Name:     "SmokeLegion",
		}),
	})
	if guildResp.Code != 0 {
		fail("create_guild", fmt.Errorf("code=%d msg=%s", guildResp.Code, guildResp.Msg))
	}
	var guildOut guildv1.CreateGuildResponse
	if err := proto.Unmarshal(guildResp.Data, &guildOut); err != nil {
		fail("create_guild_unmarshal", err)
	}
	guildID := guildOut.GetGuild().GetGuildId()
	if guildID == 0 {
		fail("create_guild", fmt.Errorf("missing guild_id"))
	}

	_, err := pool.Exec(ctx, `UPDATE player SET power = 1500 WHERE server_id = $1 AND player_id = $2`, serverID, playerID)
	if err != nil {
		fail("set_player_power", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		fail("refresh_ranks", err)
	}

	rankResp := mustSend(t, c, &commonv1.ClientPacket{
		Route:     api.RouteGetLeaderboard,
		TraceId:   "m3-rank",
		SessionId: sid,
		ServerId:  serverID,
		Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
			ServerId: serverID,
			Type:     rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER,
			Page:     1,
		}),
	})
	if rankResp.Code != 0 {
		fail("get_leaderboard", fmt.Errorf("code=%d msg=%s", rankResp.Code, rankResp.Msg))
	}
	var rankOut rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(rankResp.Data, &rankOut); err != nil {
		fail("get_leaderboard_unmarshal", err)
	}
	if rankOut.GetMyRank() == 0 || rankOut.GetTotalCount() < 1 {
		fail("get_leaderboard", fmt.Errorf("not on board my_rank=%d total=%d", rankOut.GetMyRank(), rankOut.GetTotalCount()))
	}
}
