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
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

func smokeStep(t *testing.T, name string) {
	t.Logf("smoke step: %s (server_id=1)", name)
}

// TestM4ContentSmokePath: 接任务 → 推进 → 领奖入背包 → 商城购买 → GM 发奖（INTG-004 / DATA-002 cfg 子集）。
func TestM4ContentSmokePath(t *testing.T) {
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
	apiSrv := api.NewServer(log, pool, world.NewService(store), domestic.NewHub(time.Now), march.NewHub(time.Now))
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

	loginName := fmt.Sprintf("m4_%d", time.Now().UnixNano())
	smokeStep(t, "register")
	mustSend(t, c, &commonv1.ClientPacket{
		Route: account.RouteRegister, TraceId: "m4-r",
		Payload: mustMarshal(&accountv1.RegisterRequest{LoginName: loginName, Password: "secret"}),
	})
	smokeStep(t, "login")
	loginResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: account.RouteLogin, TraceId: "m4-l",
		Payload: mustMarshal(&accountv1.LoginRequest{LoginName: loginName, Password: "secret", ServerId: 1}),
	})
	if loginResp.Code != 0 {
		t.Fatalf("login: %+v", loginResp)
	}
	var loginOut accountv1.LoginResponse
	if err := proto.Unmarshal(loginResp.Data, &loginOut); err != nil {
		t.Fatal(err)
	}
	sid := loginOut.GetSessionId()
	playerID := loginOut.GetPlayer().GetPlayerId()

	smokeStep(t, "accept quest 1001")
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "m4-a", SessionId: sid, ServerId: 1,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: 1, QuestCfgId: 1001}),
	})
	if acceptResp.Code != 0 {
		t.Fatalf("accept quest: code=%d msg=%s", acceptResp.Code, acceptResp.Msg)
	}

	smokeStep(t, "report quest progress")
	progResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteReportQuestProgress, TraceId: "m4-p", SessionId: sid, ServerId: 1,
		Payload: mustMarshal(&questv1.ReportQuestProgressRequest{
			ServerId: 1, QuestCfgId: 1001, Absolute: true, ProgressValue: 2,
		}),
	})
	if progResp.Code != 0 {
		t.Fatalf("report progress: %+v", progResp)
	}

	smokeStep(t, "claim quest reward")
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "m4-c", SessionId: sid, ServerId: 1,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: 1, QuestCfgId: 1001}),
	})
	if claimResp.Code != 0 {
		t.Fatalf("claim: %+v", claimResp)
	}
	p := content.PlayerRef{ServerID: 1, PlayerID: playerID}
	qty, err := apiSrv.ContentService().Get(p, 2001)
	if err != nil || qty != 1 {
		t.Fatalf("bag after claim: qty=%d err=%v", qty, err)
	}

	smokeStep(t, "seed player_wallet gold for shop")
	_, err = pool.Exec(ctx, `
		UPDATE player_wallet SET gold = gold + 100
		WHERE server_id = 1 AND player_id = $1`, playerID)
	if err != nil {
		t.Fatal(err)
	}

	smokeStep(t, "list shop shelf")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "m4-s1", SessionId: sid, ServerId: 1,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: 1}),
	})
	if listResp.Code != 0 {
		t.Fatalf("list shelf: %+v", listResp)
	}
	var listOut shopv1.ListShopShelfResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Fatal(err)
	}
	if len(listOut.GetOffers()) == 0 {
		t.Fatal("expected shop offers")
	}

	smokeStep(t, "purchase offer 1001")
	buyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RoutePurchaseShopOffer, TraceId: "m4-s2", SessionId: sid, ServerId: 1,
		Payload: mustMarshal(&shopv1.PurchaseShopOfferRequest{ServerId: 1, OfferId: 1001, PurchaseCount: 1}),
	})
	if buyResp.Code != 0 {
		t.Fatalf("purchase: code=%d msg=%s", buyResp.Code, buyResp.Msg)
	}
	qty, err = apiSrv.ContentService().Get(p, 2001)
	if err != nil || qty != 2 {
		t.Fatalf("bag after shop: qty=%d err=%v", qty, err)
	}

	smokeStep(t, "gm grant bonus item")
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-004", TicketID: "T-m4"}
	_, grantRes, err := apiSrv.Gm().GrantReward(ctx, "", audit, 1, playerID,
		content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2003, Qty: 1}}}, "smoke-gm-grant")
	if err != nil {
		t.Fatal(err)
	}
	if grantRes.Duplicate {
		t.Fatal("unexpected duplicate gm grant")
	}
	speedQty, err := apiSrv.ContentService().Get(p, 2003)
	if err != nil || speedQty != 1 {
		t.Fatalf("bag after gm: qty=%d err=%v", speedQty, err)
	}

	smokeStep(t, "list player bag via gateway")
	bagListResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "m4-bag", SessionId: sid, ServerId: 1,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: 1}),
	})
	if bagListResp.Code != 0 {
		t.Fatalf("list bag: code=%d msg=%s", bagListResp.Code, bagListResp.Msg)
	}
	var bagList contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagListResp.Data, &bagList); err != nil {
		t.Fatal(err)
	}
	var qty2001 int32
	for _, it := range bagList.GetItems() {
		if it.GetItemCfgId() == 2001 {
			qty2001 = it.GetQuantity()
		}
	}
	if qty2001 != 2 {
		t.Fatalf("gateway bag 2001=%d", qty2001)
	}

	smokeStep(t, "use consumable via gateway")
	useResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteUseConsumable, TraceId: "m4-use", SessionId: sid, ServerId: 1,
		Payload: mustMarshal(&contentv1.UseConsumableRequest{ServerId: 1, ItemCfgId: 2003, Count: 1}),
	})
	if useResp.Code != 0 {
		t.Fatalf("use consumable: code=%d msg=%s", useResp.Code, useResp.Msg)
	}
	var useOut contentv1.UseConsumableResponse
	if err := proto.Unmarshal(useResp.Data, &useOut); err != nil {
		t.Fatal(err)
	}
	if useOut.GetRemaining() != 0 || useOut.GetSpeedupSeconds() != 300 {
		t.Fatalf("use remaining=%d speedup=%d", useOut.GetRemaining(), useOut.GetSpeedupSeconds())
	}
}
