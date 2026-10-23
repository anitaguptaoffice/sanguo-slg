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
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

const smokeINTG023CfgHint = smokeINTG022CfgHint + "; INTG-023: ListPlayerBag total+stack; UseConsumable bag delta; optional PurchaseShopOffer; GetHeroDetail hero_id+level+loyalty; optional RecruitTroop code/msg; ListMarches phase+arrive_at_ms"

// TestINTG023Wave26SmokePath extends INTG-022 with bag stack, shop purchase feedback, hero detail, recruit troop, and march phase+ETA fields.
func TestINTG023Wave26SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-023 wave:26 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG023Wave26Smoke(t)
}

func runINTG023Wave26Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg023Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg023Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg023Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg023_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeINTG023ListPlayerBagGateway(t, c, sid, playerID)
	smokeINTG020ListShopShelfOfferPricesGateway(t, c, sid, playerID)
	smokeINTG018GetHeroDetailLevelLoyaltyGateway(t, c, sid, playerID)
	smokeINTG023GetHeroDetailFirstHeroGateway(t, c, sid, playerID)

	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG017ListMarchesGridGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	smokeINTG023ListMarchesPhaseArriveAtGateway(t, c, sid, cityID, marchID)
	smokeINTG017ListBattleReportsTimeOutcomeGateway(t, c, sid, playerID)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
	smokeINTG014GetBattleReportGateway(t, c, sid, playerID, reportID)
	smokeINTG018GetBattleReportRoundsGateway(t, c, sid, playerID, reportID)

	smokeINTG016ListPlayerMailPaginationGateway(t, c, sid, playerID)
	smokeINTG016GetCityStateBuildingsGateway(t, c, sid, playerID)
	smokeINTG020GetCityStateBuildingLevelGateway(t, c, sid, playerID)
	smokeINTG019GetCityStateResourcesProductionRatesGateway(t, c, sid, playerID)
	smokeINTG022ListPlayerCitiesXYNameGateway(t, c, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG022GetCityStateInProgressBuildSlotsGateway(t, c, sid, playerID)
	smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG022ListPlayerQuestsChain400TodoGateway(t, c, sid, playerID)

	smokeINTG021DualLeaderboardMyRankScoreGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	bagBeforeUse := smokeINTG023ListPlayerBagGateway(t, c, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG023VerifyBagStackAfterUseOptional(t, c, sid, playerID, smokeItemRewardCfgID, bagBeforeUse, consumed2001)
	smokeINTG023PurchaseShopOfferOptional(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG021ListGuildMembersRoleGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG021RecruitHeroOptional(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG012MailMarkReadGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG020ListPlayerMailUnclaimedAttachmentGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG022ListPlayerMailUnreadCountGateway(t, c, sid, playerID)
	mailGranted := smokeINTG013MailClaimAttachmentsGateway(t, ctx, c, pool, apiSrv, sid, playerID)
	smokeINTG023RecruitTroopOptional(t, c, sid, cityID, marchID)

	want := intg009PersistSnapshot{intg008PersistSnapshot: ext, MarchID: marchID}
	if consumed2001 > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 -= consumed2001
	}
	if speedupUsed > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Base.Bag2003 -= speedupUsed
	}
	if mailGranted > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 += mailGranted
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

// smokeINTG023ListPlayerBagGateway logs total_count (len items) and first stack item_cfg_id + stack_count (quantity).
func smokeINTG023ListPlayerBagGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) map[int32]int32 {
	t.Helper()
	smokeStep(t, "INTG-023 BAG: gateway ListPlayerBag total_count + first item_cfg_id/stack_count")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i23-bag", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg023Failf(t, "list player bag", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg023Failf(t, "decode list player bag", "player_id=%d err=%v", playerID, err)
	}
	items := out.GetItems()
	total := int32(len(items))
	if total < 1 {
		intg023Failf(t, "list player bag", "player_id=%d total_count=0 want>=1", playerID)
	}
	first := items[0]
	t.Logf("INTG-023: ListPlayerBag player_id=%d total_count=%d first_item_cfg_id=%d stack_count=%d",
		playerID, total, first.GetItemCfgId(), first.GetQuantity())
	if first.GetItemCfgId() == 0 {
		intg023Failf(t, "list player bag", "player_id=%d first item_cfg_id=0", playerID)
	}
	if first.GetQuantity() < 1 {
		intg023Failf(t, "list player bag", "player_id=%d first stack_count=%d want>=1", playerID, first.GetQuantity())
	}
	qtyByCfg := make(map[int32]int32, len(items))
	for _, it := range items {
		qtyByCfg[it.GetItemCfgId()] = it.GetQuantity()
	}
	return qtyByCfg
}

// smokeINTG023VerifyBagStackAfterUseOptional re-lists the bag after UseConsumable and logs stack delta; failures are non-fatal.
func smokeINTG023VerifyBagStackAfterUseOptional(t *testing.T, c *websocket.Conn, sid string, playerID int64, itemCfgID int32, before map[int32]int32, consumed int32) {
	t.Helper()
	if consumed < 1 {
		t.Logf("INTG-023: skip bag stack delta (UseConsumable item_cfg_id=%d did not consume; see INTG-010 log)", itemCfgID)
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-023 BAG: ListPlayerBag after UseConsumable item_cfg_id=%d (non-blocking stack check)", itemCfgID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i23-bag-after-use", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		t.Logf("INTG-023: bag after use skipped: code=%d msg=%s (non-blocking)", resp.Code, resp.Msg)
		return
	}
	var out contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		t.Logf("INTG-023: bag after use skipped: decode err=%v (non-blocking)", err)
		return
	}
	var after int32
	for _, it := range out.GetItems() {
		if it.GetItemCfgId() == itemCfgID {
			after = it.GetQuantity()
			break
		}
	}
	beforeQty := before[itemCfgID]
	wantAfter := beforeQty - consumed
	if wantAfter < 0 {
		wantAfter = 0
	}
	if after != wantAfter {
		t.Logf("INTG-023: bag stack delta mismatch item_cfg_id=%d before=%d after=%d want=%d consumed=%d (non-blocking)",
			itemCfgID, beforeQty, after, wantAfter, consumed)
		return
	}
	t.Logf("INTG-023: ListPlayerBag after UseConsumable item_cfg_id=%d stack_count %d -> %d (delta -%d)",
		itemCfgID, beforeQty, after, consumed)
}

// smokeINTG023PurchaseShopOfferOptional grants wallet gold then attempts one purchase; failures are non-fatal.
func smokeINTG023PurchaseShopOfferOptional(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-023 optional: shop.v1.PurchaseShopOffer after GM wallet grant (non-blocking)")
	const seedGold = int64(200)
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-023", TicketID: "T-i23-shop"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Resources: map[string]int64{"gold": seedGold},
	}, "intg-023-shop-wallet")
	if err != nil {
		t.Logf("INTG-023 optional PurchaseShopOffer skipped: gm grant wallet err=%v", err)
		return
	}
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "i23-shop-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	var offerCfgID int32
	if listResp.Code == 0 {
		var listOut shopv1.ListShopShelfResponse
		if err := proto.Unmarshal(listResp.Data, &listOut); err == nil && len(listOut.GetOffers()) > 0 {
			offerCfgID = listOut.GetOffers()[0].GetOfferId()
		}
	}
	if offerCfgID == 0 {
		offerCfgID = smokeShopOfferCfgID
	}
	buyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RoutePurchaseShopOffer, TraceId: "i23-shop-buy", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.PurchaseShopOfferRequest{
			ServerId: intg006ServerID, OfferId: offerCfgID, PurchaseCount: 1,
		}),
	})
	t.Logf("INTG-023: PurchaseShopOffer offer_cfg_id=%d code=%d msg=%s", offerCfgID, buyResp.Code, buyResp.Msg)
	if buyResp.Code != 0 {
		t.Logf("INTG-023 optional PurchaseShopOffer failed (non-blocking); see offer_cfg_id=%d", offerCfgID)
	}
}

// smokeINTG023GetHeroDetailFirstHeroGateway logs hero_id, level, and loyalty for CLIENT-114/115; skips when no heroes.
func smokeINTG023GetHeroDetailFirstHeroGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-023 HERO: gateway GetHeroDetail first hero_id+level+loyalty")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i23-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-023: skip GetHeroDetail (list heroes code=%d msg=%s); hint recruit via INTG-008/021 optional", listResp.Code, listResp.Msg)
		return
	}
	var listOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Logf("INTG-023: skip GetHeroDetail decode list err=%v", err)
		return
	}
	if len(listOut.GetHeroes()) == 0 {
		t.Logf("INTG-023: skip GetHeroDetail (no heroes — recruit via hero.v1.RecruitHero; see tools/smoke/README.md)")
		return
	}
	heroID := listOut.GetHeroes()[0].GetHeroId()
	detailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetHeroDetail, TraceId: "i23-hero-detail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.GetHeroDetailRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if detailResp.Code != 0 {
		intg023Failf(t, "get hero detail", "hero_id=%d code=%d msg=%s", heroID, detailResp.Code, detailResp.Msg)
	}
	var detailOut herov1.GetHeroDetailResponse
	if err := proto.Unmarshal(detailResp.Data, &detailOut); err != nil {
		intg023Failf(t, "decode hero detail", "hero_id=%d err=%v", heroID, err)
	}
	t.Logf("INTG-023: GetHeroDetail hero_id=%d level=%d loyalty=%d",
		heroID, detailOut.GetLevel(), detailOut.GetLoyalty())
}

// smokeINTG023ListMarchesPhaseArriveAtGateway logs march_id, phase, and arrive_at_ms (CLIENT-116).
func smokeINTG023ListMarchesPhaseArriveAtGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, marchID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-023 MIL: gateway ListMarches phase+arrive_at_ms march_id=%d", marchID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i23-march-phase", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg023Failf(t, "list marches phase arrive", "march_id=%d code=%d msg=%s", marchID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg023Failf(t, "decode list marches phase arrive", "err=%v", err)
	}
	if len(listOut.GetMarches()) < 1 {
		intg023Failf(t, "list marches phase arrive", "march_id=%d empty list total=%d", marchID, listOut.GetTotal())
	}
	first := listOut.GetMarches()[0]
	if first.GetMarchId() != marchID {
		intg023Failf(t, "list marches phase arrive", "first march_id=%d want=%d", first.GetMarchId(), marchID)
	}
	phase := first.GetPhase()
	arriveAt := first.GetArriveAtMs()
	t.Logf("INTG-023: ListMarches march_id=%d phase=%s arrive_at_ms=%d", first.GetMarchId(), phase.String(), arriveAt)
	if phase == militaryv1.MarchPhase_MARCH_PHASE_UNSPECIFIED {
		intg023Failf(t, "list marches phase", "march_id=%d phase unspecified", marchID)
	}
	if arriveAt <= 0 {
		intg023Failf(t, "list marches arrive_at_ms", "march_id=%d arrive_at_ms=%d want>0", marchID, arriveAt)
	}
}

// smokeINTG023RecruitTroopOptional logs RecruitTroop code/msg and checks ListMarches unchanged; failures are non-fatal.
func smokeINTG023RecruitTroopOptional(t *testing.T, c *websocket.Conn, sid string, cityID int64, marchID int64) {
	t.Helper()
	if cityID == 0 {
		t.Log("INTG-023 optional: RecruitTroop skipped (no march city_id)")
		return
	}
	smokeStep(t, "INTG-023 optional: military.v1.RecruitTroop code/msg (non-blocking)")
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitTroop, TraceId: "i23-recruit", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5,
		}),
	})
	t.Logf("INTG-023: RecruitTroop code=%d msg=%s", recruitResp.Code, recruitResp.Msg)
	if recruitResp.Code != 0 {
		return
	}
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i23-list-after-recruit", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-023 optional: ListMarches after recruit code=%d msg=%s (non-blocking)", listResp.Code, listResp.Msg)
		return
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Logf("INTG-023 optional: decode ListMarches err=%v (non-blocking)", err)
		return
	}
	for _, row := range listOut.GetMarches() {
		if row.GetMarchId() != marchID {
			t.Logf("INTG-023 optional: ListMarches unexpected march_id=%d (expected only %d); total=%d (non-blocking)",
				row.GetMarchId(), marchID, listOut.GetTotal())
			return
		}
	}
	t.Logf("INTG-023 optional: ListMarches after RecruitTroop ok total=%d march_id=%d only", listOut.GetTotal(), marchID)
}

func intg023Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG023CfgHint, step, fmt.Sprintf(format, args...))
}
