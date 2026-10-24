package api_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG032CfgHint = smokeINTG031CfgHint + "; INTG-032: ListPlayerCities x/y/name; ListMarches march_id+to_x/to_y+phase; ListBattleReports report_id+outcome+location hint; ListPlayerMail unclaimed+mail_id hint; ListPlayerQuests claimable_count+progress; ListPlayerBag item_id+ListShopShelf price/currency"

// TestINTG032Wave35SmokePath extends INTG-031 with world/minimap grid, march sync, battle replay coords, mail claim, daily claim progress, and bag/shop currency readouts for wave:35 CLIENT hints.
func TestINTG032Wave35SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-032 wave:35 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG032Wave35Smoke(t)
}

func runINTG032Wave35Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG032Wave35BeforeRestartGateway)
}

func smokeINTG032Wave35BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG031Wave34BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG032ListPlayerCitiesXYNameGateway(t, c, sid, playerID)
	smokeINTG032ListMarchesToXYPhaseGateway(t, c, sid, cityID, playerID)
	smokeINTG032ListBattleReportsOutcomeCoordinateHintGateway(t, c, sid, playerID)
	smokeINTG032ListPlayerMailUnclaimedMailIDGateway(t, c, sid, playerID)
	smokeINTG032ListPlayerQuestsClaimableProgressGateway(t, c, sid, playerID)
	smokeINTG032ListPlayerBagAndShopPriceCurrencyGateway(t, c, sid, playerID)
}

// smokeINTG032ListPlayerCitiesXYNameGateway logs first city grid cell and name (CLIENT-188 minimap/grid card).
func smokeINTG032ListPlayerCitiesXYNameGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-032 WORLD: gateway ListPlayerCities first x/y/name")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerCities, TraceId: "i32-cities", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&worldv1.ListPlayerCitiesRequest{}),
	})
	if resp.Code != 0 {
		intg032Failf(t, "list player cities", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out worldv1.ListPlayerCitiesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg032Failf(t, "decode list player cities", "player_id=%d err=%v", playerID, err)
	}
	cities := out.GetCities()
	if len(cities) < 1 {
		t.Logf("INTG-032: skip ListPlayerCities x/y/name (no cities; hint create city — see tools/smoke/README.md)")
		return
	}
	first := cities[0]
	t.Logf("INTG-032: ListPlayerCities player_id=%d cities_count=%d first_city_id=%d x=%d y=%d name=%q",
		playerID, len(cities), first.GetCityId(), first.GetX(), first.GetY(), first.GetName())
}

// smokeINTG032ListMarchesToXYPhaseGateway logs first march destination and phase for minimap/military form sync (CLIENT-188/189).
func smokeINTG032ListMarchesToXYPhaseGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-032: skip ListMarches to_x/to_y+phase (no city_id; hint StartMarch — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-032 MIL: gateway ListMarches first march_id+to_x/to_y+phase city_id=%d", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i32-march-sync", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg032Failf(t, "list marches sync", "city_id=%d code=%d msg=%s", cityID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg032Failf(t, "decode list marches sync", "city_id=%d err=%v", cityID, err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 || listOut.GetTotal() < 1 {
		t.Logf("INTG-032: skip ListMarches to_x/to_y+phase (empty list total=%d; hint StartMarch — see tools/smoke/README.md)", listOut.GetTotal())
		return
	}
	first := marches[0]
	t.Logf("INTG-032: ListMarches first march_id=%d to_x=%d to_y=%d phase=%s player_id=%d total=%d",
		first.GetMarchId(), first.GetToX(), first.GetToY(), first.GetPhase().String(), playerID, listOut.GetTotal())
}

// smokeINTG032ListBattleReportsOutcomeCoordinateHintGateway logs first report outcome and summary location hint for replay/minimap jump (CLIENT-190/191).
func smokeINTG032ListBattleReportsOutcomeCoordinateHintGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(10)
	smokeStep(t, fmt.Sprintf("INTG-032 MIL: gateway ListBattleReports first report_id+outcome+location_x/y hint limit=%d", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i32-br-replay", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: 0}),
	})
	if resp.Code != 0 {
		intg032Failf(t, "list battle reports replay", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg032Failf(t, "decode battle reports replay", "player_id=%d err=%v", playerID, err)
	}
	reports := out.GetReports()
	if out.GetTotal() < 1 || len(reports) < 1 {
		t.Logf("INTG-032: ListBattleReports outcome+coordinate hint only (no reports; hint march arrival — see tools/smoke/README.md)")
		return
	}
	first := reports[0]
	coordHint := smokeINTG032BattleReportCoordinateHint(first)
	t.Logf("INTG-032: ListBattleReports player_id=%d first_report_id=%d outcome=%d coordinate_hint=%s total=%d",
		playerID, first.GetReportId(), first.GetOutcome(), coordHint, out.GetTotal())
}

func smokeINTG032BattleReportCoordinateHint(summary *militaryv1.BattleReportSummary) string {
	if summary == nil {
		return "location=missing"
	}
	x, y := summary.GetLocationX(), summary.GetLocationY()
	if x != 0 || y != 0 {
		return fmt.Sprintf("location_x=%d location_y=%d", x, y)
	}
	if summary.GetDefenderCityId() > 0 {
		return fmt.Sprintf("defender_city_id=%d (hint GetBattleReport summary.location_x/y)", summary.GetDefenderCityId())
	}
	return "location_x/y=0 (hint GetBattleReport after march)"
}

// smokeINTG032ListPlayerMailUnclaimedMailIDGateway logs unclaimed attachment count and first mail_id with attachments (CLIENT-192).
func smokeINTG032ListPlayerMailUnclaimedMailIDGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-032 MAIL: gateway ListPlayerMail unclaimed_attachment_count+first mail_id hint page_size=%d", pageSize))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i32-mail-claim", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if resp.Code != 0 {
		intg032Failf(t, "list player mail claim hint", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg032Failf(t, "decode list player mail claim hint", "player_id=%d err=%v", playerID, err)
	}
	if out.GetTotalCount() < 1 && len(out.GetMails()) < 1 {
		t.Logf("INTG-032: skip ListPlayerMail unclaimed+mail_id (empty inbox; hint GM send-mail — see tools/smoke/README.md)")
		return
	}
	mails := out.GetMails()
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(mails)
	var attachMail *contentv1.PlayerMail
	for _, m := range mails {
		if smokeINTG020MailHasAttachments(m) {
			attachMail = m
			break
		}
	}
	if attachMail == nil {
		t.Logf("INTG-032: ListPlayerMail player_id=%d unclaimed_attachment_count=%d (hint only: no mail with attachments on page — see tools/smoke/README.md)",
			playerID, unclaimed)
		return
	}
	t.Logf("INTG-032: ListPlayerMail player_id=%d total_count=%d unclaimed_attachment_count=%d first_attachment_mail_id=%d",
		playerID, out.GetTotalCount(), unclaimed, attachMail.GetMailId())
}

// smokeINTG032ListPlayerQuestsClaimableProgressGateway logs claimable quest count and first claimable progress fields (CLIENT-193).
func smokeINTG032ListPlayerQuestsClaimableProgressGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-032 QUEST: gateway ListPlayerQuests chain_id=%d claimable_count+first progress", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i32-quests-progress", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          smokeDailyQuestChainID,
			IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg032Failf(t, "list player quests claimable progress", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg032Failf(t, "decode list player quests claimable progress", "player_id=%d err=%v", playerID, err)
	}
	quests := out.GetQuests()
	var claimableCount int
	var firstClaimable *questv1.PlayerQuestProgress
	for _, q := range quests {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
			if firstClaimable == nil {
				firstClaimable = q
			}
		}
	}
	if claimableCount < 1 || firstClaimable == nil {
		t.Logf("INTG-032: skip ListPlayerQuests claimable progress (chain_id=%d claimable_count=0; hint quest progress hook — see tools/smoke/README.md)", smokeDailyQuestChainID)
		return
	}
	t.Logf("INTG-032: ListPlayerQuests chain_id=%d claimable_count=%d first_quest_cfg_id=%d progress_current=%d progress_target=%d player_id=%d",
		smokeDailyQuestChainID, claimableCount, firstClaimable.GetQuestCfgId(),
		firstClaimable.GetProgressCurrent(), firstClaimable.GetProgressTarget(), playerID)
}

// smokeINTG032ListPlayerBagAndShopPriceCurrencyGateway logs first bag item_id and shop SKU price/currency for wallet contrast (CLIENT-194).
func smokeINTG032ListPlayerBagAndShopPriceCurrencyGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-032 BAG+SHOP: gateway ListPlayerBag first item_id + ListShopShelf price/currency")
	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i32-bag", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if bagResp.Code != 0 {
		intg032Failf(t, "list player bag", "player_id=%d code=%d msg=%s", playerID, bagResp.Code, bagResp.Msg)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		intg032Failf(t, "decode list player bag", "player_id=%d err=%v", playerID, err)
	}
	items := bagOut.GetItems()
	var bagHint string
	if len(items) < 1 {
		bagHint = "bag_empty"
		t.Logf("INTG-032: skip ListPlayerBag first item_id (empty bag; hint M4 grant — see tools/smoke/README.md)")
	} else {
		first := items[0]
		bagHint = fmt.Sprintf("item_id=%d quantity=%d", first.GetItemCfgId(), first.GetQuantity())
		t.Logf("INTG-032: ListPlayerBag player_id=%d %s entry_count=%d", playerID, bagHint, len(items))
	}

	shopResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "i32-shop", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	if shopResp.Code != 0 {
		intg032Failf(t, "list shop shelf", "player_id=%d code=%d msg=%s", playerID, shopResp.Code, shopResp.Msg)
	}
	var shopOut shopv1.ListShopShelfResponse
	if err := proto.Unmarshal(shopResp.Data, &shopOut); err != nil {
		intg032Failf(t, "decode list shop shelf", "player_id=%d err=%v", playerID, err)
	}
	offers := shopOut.GetOffers()
	if len(offers) < 1 {
		t.Logf("INTG-032: skip ListShopShelf price/currency (empty offers; hint shop catalog — see tools/smoke/README.md)")
		return
	}
	firstOffer := offers[0]
	price, currency := smokeINTG029ShopOfferPriceCurrency(firstOffer)
	t.Logf("INTG-032: ListShopShelf first_offer_id=%d price=%d currency=%s bag_hint=%s player_id=%d",
		firstOffer.GetOfferId(), price, currency, bagHint, playerID)
}

func intg032Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG032CfgHint, step, fmt.Sprintf(format, args...))
}
