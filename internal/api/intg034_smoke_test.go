package api_test

import (
	"context"
	"fmt"
	"strings"
	"testing"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG034CfgHint = smokeINTG033CfgHint + "; INTG-034: ListMarches multi-row to_x/to_y/phase+first ETA; GetCityState wallet troop_reserve hint; ListBattleReports created_at_ms+outcome+rounds+streak hint; ListPlayerMail tab unread+unclaimed+quest claimable HUD; ListPlayerBag item_id+ListShopShelf price/currency"

// TestINTG034Wave37SmokePath extends INTG-033 with world march stack overlays, military ETA, march form troop reserve, battle report density, mail/daily HUD, and bag/shop return field hints for wave:37 CLIENT readouts.
func TestINTG034Wave37SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-034 wave:37 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG034Wave37Smoke(t)
}

func runINTG034Wave37Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG034Wave37BeforeRestartGateway)
}

func smokeINTG034Wave37BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG033Wave36BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG034ListMarchesMultiRowETAGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG034GetCityStateTroopResourceMarginGateway(t, c, sid, cityID, playerID)
	smokeINTG034ListBattleReportsTimeRoundsStreakGateway(t, c, sid, playerID)
	smokeINTG034ListPlayerMailTabHUDGateway(t, c, sid, playerID)
	smokeINTG034ListPlayerBagShopReturnGateway(t, c, sid, playerID)
}

// smokeINTG034ListMarchesMultiRowETAGateway logs multiple march rows with destination/phase and first-row ETA fields (CLIENT-204/205).
func smokeINTG034ListMarchesMultiRowETAGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-034: skip ListMarches multi-row+ETA (no city_id; hint StartMarch — see tools/smoke/README.md)")
		return
	}
	smokeINTG034OptionalSecondMarchGateway(t, c, apiSrv, sid, cityID, playerID)

	smokeStep(t, fmt.Sprintf("INTG-034 MIL: gateway ListMarches multi-row to_x/to_y/phase+first ETA city_id=%d", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i34-march-multi", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg034Failf(t, "list marches multi-row", "city_id=%d code=%d msg=%s", cityID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg034Failf(t, "decode list marches multi-row", "city_id=%d err=%v", cityID, err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 || listOut.GetTotal() < 1 {
		t.Logf("INTG-034: skip ListMarches multi-row+ETA (empty list total=%d; hint StartMarch — see tools/smoke/README.md)", listOut.GetTotal())
		return
	}
	const maxLog = 3
	var rowParts []string
	for i, m := range marches {
		if i >= maxLog {
			break
		}
		rowParts = append(rowParts, fmt.Sprintf("march_id=%d to_x=%d to_y=%d phase=%s",
			m.GetMarchId(), m.GetToX(), m.GetToY(), m.GetPhase().String()))
	}
	first := marches[0]
	t.Logf("INTG-034: ListMarches player_id=%d total=%d logged_rows=%d rows=[%s] first_eta depart_at_ms=%d arrive_at_ms=%d",
		playerID, listOut.GetTotal(), len(rowParts), strings.Join(rowParts, "; "),
		first.GetDepartAtMs(), first.GetArriveAtMs())
	if listOut.GetTotal() < 2 {
		t.Logf("INTG-034: hint only: multi-march stack overlay wants total>=2 (got %d; optional second StartMarch may have failed — see tools/smoke/README.md)", listOut.GetTotal())
	}
}

func smokeINTG034OptionalSecondMarchGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i34-march-count", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-034 optional: skip second StartMarch (list code=%d msg=%s)", listResp.Code, listResp.Msg)
		return
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Logf("INTG-034 optional: skip second StartMarch (decode err=%v)", err)
		return
	}
	if listOut.GetTotal() >= 2 {
		return
	}
	var toX, toY int32 = 40, 41
	if len(listOut.GetMarches()) > 0 {
		base := listOut.GetMarches()[0]
		toX, toY = base.GetToX()+2, base.GetToY()+2
		if !smokeValidWorldTileCoord(toX) || !smokeValidWorldTileCoord(toY) {
			toX, toY = 40, 41
		}
	}
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 30)
	const marchPurpose = int32(1)
	smokeStep(t, fmt.Sprintf("INTG-034 optional: gateway StartMarch second row to=(%d,%d)", toX, toY))
	marchResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i34-march-2", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: toX, ToY: toY, Purpose: marchPurpose,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5}},
		}),
	})
	if marchResp.Code != 0 {
		t.Logf("INTG-034 optional: second StartMarch code=%d msg=%s (non-blocking)", marchResp.Code, marchResp.Msg)
		return
	}
	var marchOut militaryv1.StartMarchResponse
	if err := proto.Unmarshal(marchResp.Data, &marchOut); err != nil {
		t.Logf("INTG-034 optional: second StartMarch decode err=%v (non-blocking)", err)
		return
	}
	t.Logf("INTG-034 optional: second StartMarch ok march_id=%d to_x=%d to_y=%d player_id=%d",
		marchOut.GetMarch().GetMarchId(), toX, toY, playerID)
}

// smokeINTG034GetCityStateTroopResourceMarginGateway logs wallet resource balances and troop reserve hint for march form contrast (CLIENT-206).
func smokeINTG034GetCityStateTroopResourceMarginGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-034: skip GetCityState troop/resource margin (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-034 DOM: gateway GetCityState city_id=%d wallet+production_rates+troop_reserve hint", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	wallet := st.GetWallet()
	rates := st.GetProductionRates()
	if wallet == nil && rates == nil {
		t.Logf("INTG-034: skip GetCityState margin (missing wallet and production_rates; hint DOM gateway — see tools/smoke/README.md)")
		return
	}
	var resFood, resWood, resIron, resStone int64
	if wallet != nil {
		resFood, resWood, resIron, resStone = wallet.GetFood(), wallet.GetWood(), wallet.GetIron(), wallet.GetStone()
	}
	var rateFood int64
	if rates != nil {
		rateFood = rates.GetFood()
	}
	troopHint := smokeINTG034CityTroopReserveHint(t, c, sid, cityID)
	t.Logf("INTG-034: GetCityState city_id=%d player_id=%d wallet food=%d wood=%d iron=%d stone=%d production_food_per_h=%d troop_reserve_hint=%s",
		cityID, playerID, resFood, resWood, resIron, resStone, rateFood, troopHint)
}

func smokeINTG034CityTroopReserveHint(t *testing.T, c *websocket.Conn, sid string, cityID int64) string {
	t.Helper()
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i34-troop-hint", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 5}),
	})
	if listResp.Code != 0 {
		return fmt.Sprintf("ListMarches code=%d (GetCityState has no garrison field; use StartMarchResponse.city_troops)", listResp.Code)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		return "ListMarches decode err (hint StartMarchResponse.city_troops)"
	}
	for _, m := range listOut.GetMarches() {
		troops := m.GetTroops()
		if len(troops) > 0 {
			return fmt.Sprintf("ListMarches[march_id=%d].troops unit_cfg_id=%d count=%d (marching stack; city garrison via StartMarchResponse.city_troops)",
				m.GetMarchId(), troops[0].GetUnitCfgId(), troops[0].GetCount())
		}
	}
	return "no march troop rows (hint StartMarchResponse.city_troops after StartMarch/RecruitTroop)"
}

// smokeINTG034ListBattleReportsTimeRoundsStreakGateway logs created_at_ms, outcome, GetBattleReport rounds, and first-two outcome streak hint (CLIENT-207/208).
func smokeINTG034ListBattleReportsTimeRoundsStreakGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(20)
	smokeStep(t, fmt.Sprintf("INTG-034 MIL: gateway ListBattleReports created_at_ms+outcome+rounds+streak hint limit=%d", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i34-br-density", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: 0}),
	})
	if resp.Code != 0 {
		intg034Failf(t, "list battle reports density", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg034Failf(t, "decode battle reports density", "player_id=%d err=%v", playerID, err)
	}
	reports := out.GetReports()
	if out.GetTotal() < 1 || len(reports) < 1 {
		t.Logf("INTG-034: ListBattleReports time/round/streak hint only (no reports; hint march arrival — see tools/smoke/README.md)")
		return
	}
	first := reports[0]
	roundsHint := "rounds=skip"
	if first.GetReportId() > 0 {
		detailResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteGetBattleReport, TraceId: "i34-br-rounds", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&militaryv1.GetBattleReportRequest{ReportId: first.GetReportId()}),
		})
		if detailResp.Code == 0 {
			var view militaryv1.GetBattleReportResponse
			if err := proto.Unmarshal(detailResp.Data, &view); err == nil {
				rounds := view.GetReport().GetDetail().GetRounds()
				if len(rounds) > 0 {
					roundsHint = fmt.Sprintf("rounds_count=%d first_round=%d", len(rounds), rounds[0].GetRound())
				} else {
					roundsHint = "rounds_count=0"
				}
			}
		} else {
			roundsHint = fmt.Sprintf("GetBattleReport code=%d", detailResp.Code)
		}
	}
	streakHint := smokeINTG034BattleReportStreakHint(reports)
	t.Logf("INTG-034: ListBattleReports player_id=%d first_report_id=%d created_at_ms=%d outcome=%d %s streak_hint=%s total=%d",
		playerID, first.GetReportId(), first.GetCreatedAtMs(), first.GetOutcome(), roundsHint, streakHint, out.GetTotal())
}

func smokeINTG034BattleReportStreakHint(reports []*militaryv1.BattleReportSummary) string {
	if len(reports) < 2 {
		return "need>=2 reports for streak"
	}
	a, b := reports[0].GetOutcome(), reports[1].GetOutcome()
	if a == b && (a == 1 || a == 2) {
		label := "win"
		if a == 2 {
			label = "lose"
		}
		return fmt.Sprintf("same_outcome_streak=2 %s", label)
	}
	return fmt.Sprintf("outcome_pair=%d,%d", a, b)
}

// smokeINTG034ListPlayerMailTabHUDGateway logs per-tab unread/unclaimed counts and daily claimable quest count for HUD linkage (CLIENT-209).
func smokeINTG034ListPlayerMailTabHUDGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-034 MAIL+HUD: gateway ListPlayerMail tab unread/unclaimed + ListPlayerQuests chain_id=%d claimable", smokeDailyQuestChainID))

	allResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i34-mail-all", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID, Filter: contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize: pageSize, PageOffset: 0,
		}),
	})
	if allResp.Code != 0 {
		intg034Failf(t, "list player mail all tab", "player_id=%d code=%d msg=%s", playerID, allResp.Code, allResp.Msg)
	}
	var allOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(allResp.Data, &allOut); err != nil {
		intg034Failf(t, "decode list player mail all tab", "player_id=%d err=%v", playerID, err)
	}
	unreadFilterTotal := int32(-1)
	unreadResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i34-mail-unread", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID, Filter: contentv1.MailInboxFilter_MAIL_INBOX_FILTER_UNREAD,
			PageSize: pageSize, PageOffset: 0,
		}),
	})
	if unreadResp.Code == 0 {
		var unreadOut contentv1.ListPlayerMailResponse
		if err := proto.Unmarshal(unreadResp.Data, &unreadOut); err == nil {
			unreadFilterTotal = unreadOut.GetTotalCount()
		}
	}
	pageUnread := smokeINTG022CountUnreadMails(allOut.GetMails())
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(allOut.GetMails())

	questResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i34-hud-quests", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		}),
	})
	if questResp.Code != 0 {
		intg034Failf(t, "list player quests hud tab", "player_id=%d code=%d msg=%s", playerID, questResp.Code, questResp.Msg)
	}
	var questOut questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(questResp.Data, &questOut); err != nil {
		intg034Failf(t, "decode list player quests hud tab", "player_id=%d err=%v", playerID, err)
	}
	var claimableCount int
	for _, q := range questOut.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
		}
	}
	if allOut.GetTotalCount() < 1 && claimableCount < 1 && unclaimed < 1 && pageUnread < 1 {
		t.Logf("INTG-034: skip mail tab+HUD hint (empty mail and claimable=0; hint GM send-mail + quest progress — see tools/smoke/README.md)")
		return
	}
	t.Logf("INTG-034: mail_tab HUD player_id=%d mail_total=%d unread_filter_total=%d page_unread_derived=%d unclaimed_attachment=%d quest_chain_id=%d claimable_quest_count=%d",
		playerID, allOut.GetTotalCount(), unreadFilterTotal, pageUnread, unclaimed, smokeDailyQuestChainID, claimableCount)
}

// smokeINTG034ListPlayerBagShopReturnGateway logs first bag item_id and shop SKU price/currency for bag category / shop return contrast (CLIENT-210).
func smokeINTG034ListPlayerBagShopReturnGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-034 BAG+SHOP: gateway ListPlayerBag first item_id + ListShopShelf price/currency (shop.v1.ListShopShelf ≡ ListShopProducts)")
	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i34-bag", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if bagResp.Code != 0 {
		intg034Failf(t, "list player bag", "player_id=%d code=%d msg=%s", playerID, bagResp.Code, bagResp.Msg)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		intg034Failf(t, "decode list player bag", "player_id=%d err=%v", playerID, err)
	}
	items := bagOut.GetItems()
	bagHint := "bag_empty"
	if len(items) > 0 {
		first := items[0]
		bagHint = fmt.Sprintf("first_item_id=%d quantity=%d entry_count=%d", first.GetItemCfgId(), first.GetQuantity(), len(items))
		t.Logf("INTG-034: ListPlayerBag player_id=%d %s", playerID, bagHint)
	} else {
		t.Logf("INTG-034: skip ListPlayerBag first item_id (empty bag; hint M4 grant — see tools/smoke/README.md)")
	}

	shopResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "i34-shop", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	if shopResp.Code != 0 {
		intg034Failf(t, "list shop shelf", "player_id=%d code=%d msg=%s", playerID, shopResp.Code, shopResp.Msg)
	}
	var shopOut shopv1.ListShopShelfResponse
	if err := proto.Unmarshal(shopResp.Data, &shopOut); err != nil {
		intg034Failf(t, "decode list shop shelf", "player_id=%d err=%v", playerID, err)
	}
	offers := shopOut.GetOffers()
	if len(offers) < 1 {
		t.Logf("INTG-034: skip ListShopShelf price/currency (empty offers; bag_hint=%s — see tools/smoke/README.md)", bagHint)
		return
	}
	firstOffer := offers[0]
	price, currency := smokeINTG029ShopOfferPriceCurrency(firstOffer)
	t.Logf("INTG-034: ListShopShelf first_offer_id=%d price=%d currency=%s bag_hint=%s player_id=%d",
		firstOffer.GetOfferId(), price, currency, bagHint, playerID)
}

func intg034Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG034CfgHint, step, fmt.Sprintf(format, args...))
}
