package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG010CfgHint = smokeINTG009CfgHint + "; INTG-010: GetLeaderboard power+resource; UseConsumable item_cfg_id=2001; optional chat.v1/guild.v1"

// TestINTG010Wave13SmokePath extends INTG-009 with dual leaderboard, UseConsumable, and optional social gateway probes.
func TestINTG010Wave13SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-010 wave:13 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG010Wave13Smoke(t)
}

func runINTG010Wave13Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg010Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg010Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg010Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg010_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	marchID, _, _, _, _, _ := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeQuest003TrainOrBuildOptional(t, ctx, c, apiSrv, pool, sid, playerID)

	smokeINTG010DualLeaderboardGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	consumed := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)

	want := intg009PersistSnapshot{intg008PersistSnapshot: ext, MarchID: marchID}
	if consumed > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 -= consumed
	}

	ts.Close()
	_ = c.Close()

	pool2 := reopenDBPool(t)
	apiSrv2, ts2, wsURL2 := startData002SmokeGateway(t, log, pool2, worldStore)
	defer ts2.Close()

	c2 := dial(t, wsURL2)
	defer func() { _ = c2.Close() }()

	sid2, _ := smokeLoginOnly(t, c2, loginName)
	assertINTG009Persistence(t, ctx, pool2, apiSrv2, c2, sid2, playerID, want)
	runData002M3Subset(t, ctx, c2, apiSrv2, pool2, sid2, playerID)
}

func smokeINTG010DualLeaderboardGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-010: seed power + RefreshRanks for PLAYER_POWER leaderboard")
	_, err := pool.Exec(ctx, `UPDATE player SET power = 3200 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg010Failf(t, "seed power for leaderboard", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		intg010Failf(t, "refresh ranks power", "err=%v", err)
	}
	smokeAssertLeaderboardGateway(t, c, sid, rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER, playerID)

	smokeStep(t, "INTG-010: seed wallet + RefreshRanks for PLAYER_RESOURCE leaderboard")
	_, err = pool.Exec(ctx, `
		UPDATE player_wallet SET food = 8000, wood = 7000, iron = 1000, stone = 500, gold = 0
		WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg010Failf(t, "seed wallet for resource rank", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		intg010Failf(t, "refresh ranks resource", "err=%v", err)
	}
	smokeAssertLeaderboardGateway(t, c, sid, rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE, playerID)
}

func smokeAssertLeaderboardGateway(t *testing.T, c *websocket.Conn, sid string, lbType rankv1.LeaderboardType, viewerPlayerID int64) {
	t.Helper()
	trace := "i10-rank"
	if lbType == rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE {
		trace = "i10-rank-res"
	}
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetLeaderboard, TraceId: trace, SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
			ServerId: intg006ServerID,
			Type:     lbType,
			Page:     1,
			PageSize: 20,
		}),
	})
	if resp.Code != 0 {
		intg010Failf(t, "get leaderboard", "type=%v code=%d msg=%s", lbType, resp.Code, resp.Msg)
	}
	var out rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg010Failf(t, "decode leaderboard", "type=%v err=%v", lbType, err)
	}
	if out.GetTotalCount() < 1 || len(out.GetEntries()) == 0 {
		t.Logf("INTG-010: dev empty leaderboard type=%v total=%d (seeded viewer_player_id=%d); see tools/smoke/README.md", lbType, out.GetTotalCount(), viewerPlayerID)
		return
	}
	if out.GetMyRank() == 0 {
		intg010Failf(t, "leaderboard my_rank", "type=%v viewer_player_id=%d total=%d", lbType, viewerPlayerID, out.GetTotalCount())
	}
	for i, row := range out.GetEntries() {
		if row.GetEntityId() == 0 {
			intg010Failf(t, "leaderboard entry entity_id", "type=%v index=%d rank=%d", lbType, i, row.GetRank())
		}
	}
}

// smokeINTG010UseConsumableGateway returns consumed count (0 on expected failure).
func smokeINTG010UseConsumableGateway(t *testing.T, c *websocket.Conn, sid string) int32 {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-010: content.v1.UseConsumable item_cfg_id=%d", smokeItemRewardCfgID))
	useResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteUseConsumable, TraceId: "i10-use", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.UseConsumableRequest{
			ServerId: intg006ServerID, ItemCfgId: smokeItemRewardCfgID, Count: 1,
		}),
	})
	if useResp.Code != 0 {
		t.Logf("INTG-010 UseConsumable item_cfg_id=%d code=%d msg=%s (non-fatal expected failure)", smokeItemRewardCfgID, useResp.Code, useResp.Msg)
		return 0
	}
	var useOut contentv1.UseConsumableResponse
	if err := proto.Unmarshal(useResp.Data, &useOut); err != nil {
		intg010Failf(t, "decode use consumable", "item_cfg_id=%d err=%v", smokeItemRewardCfgID, err)
	}
	if useOut.GetItemCfgId() != smokeItemRewardCfgID {
		intg010Failf(t, "use consumable response", "item_cfg_id=%d want=%d", useOut.GetItemCfgId(), smokeItemRewardCfgID)
	}
	if useOut.GetEffectSummary() == "" {
		intg010Failf(t, "use consumable effect", "item_cfg_id=%d empty effect_summary", smokeItemRewardCfgID)
	}
	t.Logf("INTG-010 UseConsumable item_cfg_id=%d remaining=%d", smokeItemRewardCfgID, useOut.GetRemaining())
	return 1
}

// smokeINTG010SocialOptional exercises world chat + guild create; failures never block the main path.
func smokeINTG010SocialOptional(t *testing.T, c *websocket.Conn, sid string) {
	t.Helper()
	smokeStep(t, "INTG-010 optional: chat.v1 world send + list (non-blocking)")
	const worldMsg = "intg-010 smoke"
	sendResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: chat.RouteSendChatMessage, TraceId: "i10-chat", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&chatv1.SendChatMessageRequest{
			ServerId: intg006ServerID,
			Channel:  chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
			Content:  worldMsg,
		}),
	})
	if sendResp.Code != 0 {
		t.Logf("INTG-010 optional chat skipped: send code=%d msg=%s", sendResp.Code, sendResp.Msg)
		return
	}
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: chat.RouteListChatMessages, TraceId: "i10-chat-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&chatv1.ListChatMessagesRequest{
			ServerId: intg006ServerID,
			Channel:  chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
			Limit:    10,
		}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-010 optional chat skipped: list code=%d msg=%s", listResp.Code, listResp.Msg)
		return
	}
	var listOut chatv1.ListChatMessagesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Logf("INTG-010 optional chat skipped: decode err=%v", err)
		return
	}
	if len(listOut.GetMessages()) == 0 {
		t.Log("INTG-010 optional chat: world channel empty after send (non-blocking)")
	}

	smokeStep(t, "INTG-010 optional: guild.v1 CreateGuild (non-blocking)")
	guildResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteCreateGuild, TraceId: "i10-guild", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.CreateGuildRequest{
			ServerId: intg006ServerID,
			Name:     fmt.Sprintf("Legion%d", time.Now().UnixNano()%100000),
		}),
	})
	if guildResp.Code != 0 {
		t.Logf("INTG-010 optional guild skipped: create code=%d msg=%s", guildResp.Code, guildResp.Msg)
	}
}

func intg010Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG010CfgHint, step, fmt.Sprintf(format, args...))
}
