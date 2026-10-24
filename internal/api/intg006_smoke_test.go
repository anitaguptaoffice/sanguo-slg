package api_test

import (
	"context"
	"fmt"
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
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/shard"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const intg006ServerID = int32(1)

// Fixed DATA-002 / INTG-005 ids — failures should be checked against spec/data/CORE_SUBSET.md.
const (
	smokeQuestCfgID      = int32(1001)
	smokeQuestChainID    = int32(100)
	smokeShopOfferCfgID  = int32(1001)
	smokeShopShelfCfgID  = int32(1)
	smokeItemRewardCfgID = int32(2001)
	smokeItemGrantCfgID  = int32(2003)
)

const smokeData002CfgHint = "DATA-002 cfg: quest_cfg_id=1001 chain_id=100; offer_cfg_id=1001 shelf_cfg_id=1; item_cfg_id 2001 (quest+shop), 2003 (gm); seeds spec/data/generated/*.sql"

type data002PersistSnapshot struct {
	QuestState      int16
	Bag2001         int32
	Bag2003         int32
	Gold            int64
	ShopDailyBought int32
	MuteUntilMS     int64
}

// TestINTG006Data002SmokePath: DATA-002 子集下 M4 闭环 + 进程重启持久化 + M3 选服/排行子集（INTG-006）。
func TestINTG006Data002SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-006 DATA-002 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTGData002Smoke(t)
}

func runINTGData002Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		smokeFailf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		smokeFailf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		smokeFailf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg006_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	snap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)

	smokeStep(t, "simulate process restart (new api.Server + PG pool)")
	ts.Close()
	_ = c.Close()

	pool2 := reopenDBPool(t)
	apiSrv2, ts2, wsURL2 := startData002SmokeGateway(t, log, pool2, worldStore)
	defer ts2.Close()

	c2 := dial(t, wsURL2)
	defer func() { _ = c2.Close() }()

	sid2, _ := smokeLoginOnly(t, c2, loginName)
	assertData002Persistence(t, ctx, pool2, apiSrv2, c2, sid2, playerID, snap)
	runData002M3Subset(t, ctx, c2, apiSrv2, pool2, sid2, playerID)
	optionalMailGatewaySmoke(t, c2, sid2)
}

func reopenDBPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Fatal("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	return pool
}

func smokeRegisterLogin(t *testing.T, c *websocket.Conn, loginName string) (sessionID string, playerID int64) {
	t.Helper()
	smokeStep(t, "register")
	mustSend(t, c, &commonv1.ClientPacket{
		Route: account.RouteRegister, TraceId: "d2-reg",
		Payload: mustMarshal(&accountv1.RegisterRequest{LoginName: loginName, Password: "secret"}),
	})
	smokeStep(t, "login")
	return smokeLoginOnly(t, c, loginName)
}

func smokeLoginOnly(t *testing.T, c *websocket.Conn, loginName string) (sessionID string, playerID int64) {
	t.Helper()
	loginResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: account.RouteLogin, TraceId: "d2-login",
		Payload: mustMarshal(&accountv1.LoginRequest{LoginName: loginName, Password: "secret", ServerId: intg006ServerID}),
	})
	if loginResp.Code != 0 {
		smokeFailf(t, "login", "code=%d msg=%s", loginResp.Code, loginResp.Msg)
	}
	var loginOut accountv1.LoginResponse
	if err := proto.Unmarshal(loginResp.Data, &loginOut); err != nil {
		smokeFailf(t, "login decode", "err=%v", err)
	}
	return loginOut.GetSessionId(), loginOut.GetPlayer().GetPlayerId()
}

func smokeFailf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeData002CfgHint, step, fmt.Sprintf(format, args...))
}

func startData002SmokeGateway(t *testing.T, log *slog.Logger, pool *pgxpool.Pool, worldStore *world.PGStore) (*api.Server, *httptest.Server, string) {
	t.Helper()
	ctx := context.Background()
	syncClk := &api.SmokeSyncClock{T: time.Now()}
	domHub := domestic.NewHub(syncClk.Now)
	domHub.UseStore(domestic.NewPGStore(pool), intg006ServerID, 0)
	apiSrv := api.NewServer(log, pool, world.NewService(worldStore), domHub, march.NewHub(syncClk.Now))
	apiSrv.SetClock(syncClk.Now)
	apiSrv.BindSmokeSyncClock(syncClk)
	if err := apiSrv.WireM4Content(ctx); err != nil {
		t.Fatal(err)
	}
	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	gw := gateway.NewServer(log, gwCfg, gateway.AccessControl{}, account.SessionValidator{Svc: apiSrv.AccountService()}, apiSrv.GatewayRouter())
	ts := httptest.NewServer(gw.Handler())
	return apiSrv, ts, "ws" + strings.TrimPrefix(ts.URL, "http")
}

func runData002M4Steps(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) data002PersistSnapshot {
	smokeStep(t, fmt.Sprintf("accept quest %d (DATA-002 cfg_quest)", smokeQuestCfgID))
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "d2-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		smokeFailf(t, "accept quest", "code=%d msg=%s", acceptResp.Code, acceptResp.Msg)
	}

	smokeStep(t, "report quest progress")
	progResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteReportQuestProgress, TraceId: "d2-p", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ReportQuestProgressRequest{
			ServerId: intg006ServerID, QuestCfgId: smokeQuestCfgID, Absolute: true, ProgressValue: 2,
		}),
	})
	if progResp.Code != 0 {
		smokeFailf(t, "report progress", "code=%d msg=%s", progResp.Code, progResp.Msg)
	}

	smokeStep(t, "claim quest reward into bag (PG player_item)")
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "d2-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeQuestCfgID}),
	})
	if claimResp.Code != 0 {
		smokeFailf(t, "claim quest", "code=%d msg=%s", claimResp.Code, claimResp.Msg)
	}

	smokeStep(t, "seed player_wallet gold for shop (ECON-001 real debit; offer price silver→gold wallet)")
	const seedGold = int64(100)
	const shopCost = int64(10)
	_, err := pool.Exec(ctx, `
		UPDATE player_wallet SET gold = $3
		WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID, seedGold)
	if err != nil {
		smokeFailf(t, "seed wallet", "err=%v", err)
	}

	smokeStep(t, "list shop shelf")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "d2-s1", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		smokeFailf(t, "list shop shelf", "code=%d msg=%s", listResp.Code, listResp.Msg)
	}

	smokeStep(t, fmt.Sprintf("purchase offer %d (wallet + PG shop counter)", smokeShopOfferCfgID))
	buyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RoutePurchaseShopOffer, TraceId: "d2-s2", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.PurchaseShopOfferRequest{
			ServerId: intg006ServerID, OfferId: smokeShopOfferCfgID, PurchaseCount: 1,
		}),
	})
	if buyResp.Code != 0 {
		smokeFailf(t, "purchase shop offer", "code=%d msg=%s", buyResp.Code, buyResp.Msg)
	}

	smokeStep(t, fmt.Sprintf("gm grant bonus item %d", smokeItemGrantCfgID))
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-006", TicketID: "T-d2"}
	_, grantRes, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID,
		content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: smokeItemGrantCfgID, Qty: 1}}}, "smoke-intg006-grant")
	if err != nil {
		smokeFailf(t, "gm grant", "err=%v", err)
	}
	if grantRes.Duplicate {
		smokeFailf(t, "gm grant", "unexpected duplicate grant")
	}

	smokeStep(t, "gm mute player (PERSIST-001 chat PG)")
	muteUntil := time.Now().Add(2 * time.Hour).UnixMilli()
	_, muted, err := apiSrv.Gm().MutePlayer(ctx, "", audit, intg006ServerID, playerID, muteUntil)
	if err != nil || muted != muteUntil {
		smokeFailf(t, "gm mute", "until=%d err=%v", muted, err)
	}

	snap, err := readData002Snapshot(ctx, pool, playerID)
	if err != nil {
		smokeFailf(t, "read pg snapshot", "err=%v", err)
	}
	snap.MuteUntilMS = muteUntil
	if snap.Gold != seedGold-shopCost {
		smokeFailf(t, "wallet after shop", "gold=%d want %d", snap.Gold, seedGold-shopCost)
	}
	if snap.Bag2001 != 2 || snap.Bag2003 != 1 {
		smokeFailf(t, "bag before restart", "item_%d=%d item_%d=%d", smokeItemRewardCfgID, snap.Bag2001, smokeItemGrantCfgID, snap.Bag2003)
	}
	if snap.QuestState != 3 {
		smokeFailf(t, "quest state before restart", "state=%d quest_cfg_id=%d", snap.QuestState, smokeQuestCfgID)
	}
	if snap.ShopDailyBought != 1 {
		smokeFailf(t, "shop counter before restart", "daily_bought=%d offer_cfg_id=%d", snap.ShopDailyBought, smokeShopOfferCfgID)
	}
	return snap
}

func readData002Snapshot(ctx context.Context, pool *pgxpool.Pool, playerID int64) (data002PersistSnapshot, error) {
	var snap data002PersistSnapshot
	err := pool.QueryRow(ctx, `
		SELECT state FROM player_quest
		WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=$3`,
		intg006ServerID, playerID, smokeQuestCfgID).Scan(&snap.QuestState)
	if err != nil {
		return snap, err
	}
	err = pool.QueryRow(ctx, `
		SELECT COALESCE((SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=$3), 0),
		       COALESCE((SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=$4), 0),
		       gold,
		       COALESCE((SELECT daily_bought FROM player_shop_offer_counter
		                 WHERE server_id=$1 AND player_id=$2 AND offer_cfg_id=$5), 0)
		FROM player_wallet WHERE server_id=$1 AND player_id=$2`,
		intg006ServerID, playerID, smokeItemRewardCfgID, smokeItemGrantCfgID, smokeShopOfferCfgID).
		Scan(&snap.Bag2001, &snap.Bag2003, &snap.Gold, &snap.ShopDailyBought)
	return snap, err
}

func assertData002Persistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, apiSrv *api.Server, c *websocket.Conn, sid string, playerID int64, want data002PersistSnapshot) {
	t.Helper()
	smokeStep(t, "verify PG state after restart")
	got, err := readData002Snapshot(ctx, pool, playerID)
	if err != nil {
		smokeFailf(t, "read pg after restart", "err=%v", err)
	}
	if got.QuestState != want.QuestState || got.Bag2001 != want.Bag2001 || got.Bag2003 != want.Bag2003 ||
		got.Gold != want.Gold || got.ShopDailyBought != want.ShopDailyBought {
		smokeFailf(t, "pg snapshot after restart", "got %+v want %+v", got, want)
	}

	smokeStep(t, "verify quest progress via gateway")
	qResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "d2-q", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{ServerId: intg006ServerID, ChainId: smokeQuestChainID}),
	})
	if qResp.Code != 0 {
		smokeFailf(t, "list quests", "code=%d msg=%s", qResp.Code, qResp.Msg)
	}

	smokeStep(t, "verify bag via content.v1.ListPlayerBag")
	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "d2-bag", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if bagResp.Code != 0 {
		smokeFailf(t, "list bag", "code=%d msg=%s", bagResp.Code, bagResp.Msg)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		smokeFailf(t, "decode bag", "err=%v", err)
	}
	var q2001, q2003 int32
	for _, it := range bagOut.GetItems() {
		switch it.GetItemCfgId() {
		case smokeItemRewardCfgID:
			q2001 = it.GetQuantity()
		case smokeItemGrantCfgID:
			q2003 = it.GetQuantity()
		}
	}
	if q2001 != want.Bag2001 || q2003 != want.Bag2003 {
		smokeFailf(t, "gateway bag", "item_%d=%d item_%d=%d", smokeItemRewardCfgID, q2001, smokeItemGrantCfgID, q2003)
	}

	smokeStep(t, "verify gm mute deadline after restart")
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-006", TicketID: "T-d2-r"}
	_, info, err := apiSrv.Gm().LookupPlayer(ctx, "", audit, intg006ServerID, playerID, "")
	if err != nil || info.ChatMutedUntilMS != want.MuteUntilMS {
		smokeFailf(t, "mute after restart", "until=%d want=%d err=%v", info.ChatMutedUntilMS, want.MuteUntilMS, err)
	}
}

func runData002M3Subset(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	smokeStep(t, "m3 subset: list game servers")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: shard.RouteListGameServers, TraceId: "d2-m3-list",
		Payload: mustMarshal(&accountv1.ListGameServersRequest{Page: 1}),
	})
	if listResp.Code != 0 {
		smokeFailf(t, "m3 list servers", "code=%d", listResp.Code)
	}

	smokeStep(t, "m3 subset: enter game server")
	enterResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: shard.RouteEnterGameServer, TraceId: "d2-m3-enter", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&accountv1.EnterGameServerRequest{ServerId: intg006ServerID}),
	})
	if enterResp.Code != 0 {
		smokeFailf(t, "m3 enter server", "code=%d msg=%s", enterResp.Code, enterResp.Msg)
	}

	smokeStep(t, "m3 subset: rank refresh + query (PERSIST-001 rank PG)")
	_, err := pool.Exec(ctx, `UPDATE player SET power = 2500 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		smokeFailf(t, "m3 seed power", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		smokeFailf(t, "m3 refresh ranks", "err=%v", err)
	}
	rankResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetLeaderboard, TraceId: "d2-m3-rank", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
			ServerId: intg006ServerID,
			Type:     rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER,
			Page:     1,
		}),
	})
	if rankResp.Code != 0 {
		smokeFailf(t, "m3 leaderboard", "code=%d", rankResp.Code)
	}
	var rankOut rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(rankResp.Data, &rankOut); err != nil {
		smokeFailf(t, "m3 decode leaderboard", "err=%v", err)
	}
	if rankOut.GetMyRank() == 0 {
		smokeFailf(t, "m3 leaderboard", "not listed my_rank=%d total=%d", rankOut.GetMyRank(), rankOut.GetTotalCount())
	}
}

// optionalMailGatewaySmoke exercises MAIL-001 gateway routes; failures are logged only.
func optionalMailGatewaySmoke(t *testing.T, c *websocket.Conn, sid string) {
	smokeStep(t, "optional MAIL-001: list player mail (non-blocking)")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "d2-mail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID,
			Filter:   contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
		}),
	})
	if listResp.Code != 0 {
		t.Logf("optional MAIL-001 skipped: list mail code=%d msg=%s (use cmd/gm send-mail to deepen)", listResp.Code, listResp.Msg)
	}
}
