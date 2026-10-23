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

const intg005ServerID = int32(1)

type wave7PersistSnapshot struct {
	QuestState      int16
	Bag2001         int32
	Bag2003         int32
	Gold            int64
	ShopDailyBought int32
	MuteUntilMS     int64
}

// TestINTG005Wave7SmokePath: DATA-001 子集下 M4 闭环 + 进程重启持久化 + M3 选服/排行子集（INTG-005）。
func TestINTG005Wave7SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-005 wave7 smoke skipped in -short mode (see tools/smoke/README.md)")
	}

	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		t.Fatal(err)
	}
	if err := db.SeedDevServer(ctx, pool, intg005ServerID, "S1"); err != nil {
		t.Fatal(err)
	}
	applyWave7CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg005ServerID); err != nil {
		t.Fatal(err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startSmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg005_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	snap := runWave7M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)

	smokeStep(t, "simulate process restart (new api.Server + PG pool)")
	ts.Close()
	_ = c.Close()

	pool2 := reopenDBPool(t)
	apiSrv2, ts2, wsURL2 := startSmokeGateway(t, log, pool2, worldStore)
	defer ts2.Close()

	c2 := dial(t, wsURL2)
	defer func() { _ = c2.Close() }()

	sid2, _ := smokeLoginOnly(t, c2, loginName)
	assertWave7Persistence(t, ctx, pool2, apiSrv2, c2, sid2, playerID, snap)
	runWave7M3Subset(t, ctx, c2, apiSrv2, pool2, sid2, playerID)
}

func startSmokeGateway(t *testing.T, log *slog.Logger, pool *pgxpool.Pool, worldStore *world.PGStore) (*api.Server, *httptest.Server, string) {
	t.Helper()
	ctx := context.Background()
	domHub := domestic.NewHub(time.Now)
	domHub.UseStore(domestic.NewPGStore(pool), intg005ServerID, 0)
	apiSrv := api.NewServer(log, pool, world.NewService(worldStore), domHub, march.NewHub(time.Now))
	if err := apiSrv.WireM4Content(ctx); err != nil {
		t.Fatal(err)
	}
	gwCfg := gateway.DefaultConfig()
	gwCfg.PublicRoutes = apiSrv.PublicRoutes()
	gw := gateway.NewServer(log, gwCfg, gateway.AccessControl{}, account.SessionValidator{Svc: apiSrv.AccountService()}, apiSrv.GatewayRouter())
	ts := httptest.NewServer(gw.Handler())
	return apiSrv, ts, "ws" + strings.TrimPrefix(ts.URL, "http")
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
		Route: account.RouteRegister, TraceId: "w7-reg",
		Payload: mustMarshal(&accountv1.RegisterRequest{LoginName: loginName, Password: "secret"}),
	})
	smokeStep(t, "login")
	return smokeLoginOnly(t, c, loginName)
}

func smokeLoginOnly(t *testing.T, c *websocket.Conn, loginName string) (sessionID string, playerID int64) {
	t.Helper()
	loginResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: account.RouteLogin, TraceId: "w7-login",
		Payload: mustMarshal(&accountv1.LoginRequest{LoginName: loginName, Password: "secret", ServerId: intg005ServerID}),
	})
	if loginResp.Code != 0 {
		t.Fatalf("login: code=%d msg=%s", loginResp.Code, loginResp.Msg)
	}
	var loginOut accountv1.LoginResponse
	if err := proto.Unmarshal(loginResp.Data, &loginOut); err != nil {
		t.Fatal(err)
	}
	return loginOut.GetSessionId(), loginOut.GetPlayer().GetPlayerId()
}

func runWave7M4Steps(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) wave7PersistSnapshot {
	smokeStep(t, "accept quest 1001 (DATA-001 cfg_quest)")
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "w7-a", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg005ServerID, QuestCfgId: 1001}),
	})
	if acceptResp.Code != 0 {
		t.Fatalf("accept quest: code=%d msg=%s", acceptResp.Code, acceptResp.Msg)
	}

	smokeStep(t, "report quest progress")
	progResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteReportQuestProgress, TraceId: "w7-p", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&questv1.ReportQuestProgressRequest{
			ServerId: intg005ServerID, QuestCfgId: 1001, Absolute: true, ProgressValue: 2,
		}),
	})
	if progResp.Code != 0 {
		t.Fatalf("report progress: %+v", progResp)
	}

	smokeStep(t, "claim quest reward into bag (PG player_item)")
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "w7-c", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg005ServerID, QuestCfgId: 1001}),
	})
	if claimResp.Code != 0 {
		t.Fatalf("claim: %+v", claimResp)
	}

	smokeStep(t, "seed player_wallet gold for shop (ECON-001 real debit)")
	const seedGold = int64(100)
	const shopCost = int64(10)
	_, err := pool.Exec(ctx, `
		UPDATE player_wallet SET gold = $3
		WHERE server_id = $1 AND player_id = $2`, intg005ServerID, playerID, seedGold)
	if err != nil {
		t.Fatal(err)
	}

	smokeStep(t, "list shop shelf")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "w7-s1", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg005ServerID}),
	})
	if listResp.Code != 0 {
		t.Fatalf("list shelf: %+v", listResp)
	}

	smokeStep(t, "purchase offer 1001 (wallet + PG shop counter)")
	buyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RoutePurchaseShopOffer, TraceId: "w7-s2", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&shopv1.PurchaseShopOfferRequest{ServerId: intg005ServerID, OfferId: 1001, PurchaseCount: 1}),
	})
	if buyResp.Code != 0 {
		t.Fatalf("purchase: code=%d msg=%s", buyResp.Code, buyResp.Msg)
	}

	smokeStep(t, "gm grant bonus item")
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-005", TicketID: "T-w7"}
	_, grantRes, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg005ServerID, playerID,
		content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2003, Qty: 1}}}, "smoke-intg005-grant")
	if err != nil {
		t.Fatal(err)
	}
	if grantRes.Duplicate {
		t.Fatal("unexpected duplicate gm grant")
	}

	smokeStep(t, "gm mute player (PERSIST-001 chat PG)")
	muteUntil := time.Now().Add(2 * time.Hour).UnixMilli()
	_, muted, err := apiSrv.Gm().MutePlayer(ctx, "", audit, intg005ServerID, playerID, muteUntil)
	if err != nil || muted != muteUntil {
		t.Fatalf("mute: until=%d err=%v", muted, err)
	}

	snap, err := readWave7Snapshot(ctx, pool, playerID)
	if err != nil {
		t.Fatal(err)
	}
	snap.MuteUntilMS = muteUntil
	if snap.Gold != seedGold-shopCost {
		t.Fatalf("wallet after shop: gold=%d want %d", snap.Gold, seedGold-shopCost)
	}
	if snap.Bag2001 != 2 || snap.Bag2003 != 1 {
		t.Fatalf("bag before restart: 2001=%d 2003=%d", snap.Bag2001, snap.Bag2003)
	}
	if snap.QuestState != 3 {
		t.Fatalf("quest state before restart: %d", snap.QuestState)
	}
	if snap.ShopDailyBought != 1 {
		t.Fatalf("shop daily bought before restart: %d", snap.ShopDailyBought)
	}
	return snap
}

func readWave7Snapshot(ctx context.Context, pool *pgxpool.Pool, playerID int64) (wave7PersistSnapshot, error) {
	var snap wave7PersistSnapshot
	err := pool.QueryRow(ctx, `
		SELECT state FROM player_quest
		WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=1001`,
		intg005ServerID, playerID).Scan(&snap.QuestState)
	if err != nil {
		return snap, err
	}
	err = pool.QueryRow(ctx, `
		SELECT COALESCE((SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=2001), 0),
		       COALESCE((SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=2003), 0),
		       gold,
		       COALESCE((SELECT daily_bought FROM player_shop_offer_counter
		                 WHERE server_id=$1 AND player_id=$2 AND offer_cfg_id=1001), 0)
		FROM player_wallet WHERE server_id=$1 AND player_id=$2`,
		intg005ServerID, playerID).Scan(&snap.Bag2001, &snap.Bag2003, &snap.Gold, &snap.ShopDailyBought)
	return snap, err
}

func assertWave7Persistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, apiSrv *api.Server, c *websocket.Conn, sid string, playerID int64, want wave7PersistSnapshot) {
	t.Helper()
	smokeStep(t, "verify PG state after restart")
	got, err := readWave7Snapshot(ctx, pool, playerID)
	if err != nil {
		t.Fatal(err)
	}
	if got.QuestState != want.QuestState || got.Bag2001 != want.Bag2001 || got.Bag2003 != want.Bag2003 ||
		got.Gold != want.Gold || got.ShopDailyBought != want.ShopDailyBought {
		t.Fatalf("pg snapshot mismatch: got %+v want %+v", got, want)
	}

	smokeStep(t, "verify quest progress via gateway")
	qResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "w7-q", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{ServerId: intg005ServerID, ChainId: 100}),
	})
	if qResp.Code != 0 {
		t.Fatalf("list quests: %+v", qResp)
	}

	smokeStep(t, "verify bag via content.v1.ListPlayerBag")
	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "w7-bag", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg005ServerID}),
	})
	if bagResp.Code != 0 {
		t.Fatalf("list bag: %+v", bagResp)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		t.Fatal(err)
	}
	var q2001, q2003 int32
	for _, it := range bagOut.GetItems() {
		switch it.GetItemCfgId() {
		case 2001:
			q2001 = it.GetQuantity()
		case 2003:
			q2003 = it.GetQuantity()
		}
	}
	if q2001 != want.Bag2001 || q2003 != want.Bag2003 {
		t.Fatalf("gateway bag: 2001=%d 2003=%d", q2001, q2003)
	}

	smokeStep(t, "verify gm mute deadline after restart")
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-005", TicketID: "T-w7-r"}
	_, info, err := apiSrv.Gm().LookupPlayer(ctx, "", audit, intg005ServerID, playerID, "")
	if err != nil || info.ChatMutedUntilMS != want.MuteUntilMS {
		t.Fatalf("mute after restart: until=%d want=%d err=%v", info.ChatMutedUntilMS, want.MuteUntilMS, err)
	}
}

func runWave7M3Subset(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	smokeStep(t, "m3 subset: list game servers")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: shard.RouteListGameServers, TraceId: "w7-m3-list",
		Payload: mustMarshal(&accountv1.ListGameServersRequest{Page: 1}),
	})
	if listResp.Code != 0 {
		t.Fatalf("list servers: code=%d", listResp.Code)
	}

	smokeStep(t, "m3 subset: enter game server")
	enterResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: shard.RouteEnterGameServer, TraceId: "w7-m3-enter", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&accountv1.EnterGameServerRequest{ServerId: intg005ServerID}),
	})
	if enterResp.Code != 0 {
		t.Fatalf("enter server: code=%d msg=%s", enterResp.Code, enterResp.Msg)
	}

	smokeStep(t, "m3 subset: rank refresh + query (PERSIST-001 rank PG)")
	_, err := pool.Exec(ctx, `UPDATE player SET power = 2500 WHERE server_id = $1 AND player_id = $2`, intg005ServerID, playerID)
	if err != nil {
		t.Fatal(err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		t.Fatal(err)
	}
	rankResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetLeaderboard, TraceId: "w7-m3-rank", SessionId: sid, ServerId: intg005ServerID,
		Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
			ServerId: intg005ServerID,
			Type:     rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER,
			Page:     1,
		}),
	})
	if rankResp.Code != 0 {
		t.Fatalf("leaderboard: code=%d", rankResp.Code)
	}
	var rankOut rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(rankResp.Data, &rankOut); err != nil {
		t.Fatal(err)
	}
	if rankOut.GetMyRank() == 0 {
		t.Fatalf("not on leaderboard: my_rank=%d total=%d", rankOut.GetMyRank(), rankOut.GetTotalCount())
	}
}
