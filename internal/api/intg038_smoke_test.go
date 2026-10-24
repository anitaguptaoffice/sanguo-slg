package api_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG038CfgHint = smokeINTG037CfgHint + "; INTG-038: ListMarches viewport_anchor+scroll-sync; StartMarch march_id+intel_refresh_stamp; ListBattleReports outcome/coordinate+density/keyboard; ListPlayerMail unclaimed+first mail_id; ListPlayerQuests claimable HUD; ListPlayerBag consumable category+ListPowerRank/ListKillRank+recruit templates length"

const smokeINTG038ViewportRadiusTiles = int32(12)

func TestINTG038Wave41SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-038 wave:41 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG038Wave41Smoke(t)
}

func runINTG038Wave41Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG038Wave41BeforeRestartGateway)
}

func smokeINTG038Wave41BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG037Wave40BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG038ListMarchesViewportScrollSyncGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG038StartMarchFormRefreshStampGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG038ListBattleReportsDensityKeyboardGateway(t, c, sid, playerID)
	smokeINTG038MailQuestHUDSyncGateway(t, c, sid, playerID)
	smokeINTG038BagRankRecruitSkimGateway(t, ctx, c, apiSrv, pool, sid, playerID)
}

func smokeINTG038ListMarchesViewportScrollSyncGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-038: skip ListMarches viewport scroll-sync (no city_id; hint StartMarch — see tools/smoke/README.md)")
		return
	}
	var anchorX, anchorY int32
	cityResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerCities, TraceId: "i38-viewport-anchor", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&worldv1.ListPlayerCitiesRequest{}),
	})
	if cityResp.Code == 0 {
		var cityOut worldv1.ListPlayerCitiesResponse
		if err := proto.Unmarshal(cityResp.Data, &cityOut); err == nil {
			for _, city := range cityOut.GetCities() {
				if city.GetCityId() == cityID {
					anchorX, anchorY = city.GetX(), city.GetY()
					break
				}
			}
			if anchorX == 0 && anchorY == 0 && len(cityOut.GetCities()) > 0 {
				anchorX, anchorY = cityOut.GetCities()[0].GetX(), cityOut.GetCities()[0].GetY()
			}
		}
	}
	smokeINTG034OptionalSecondMarchGateway(t, c, apiSrv, sid, cityID, playerID)

	smokeStep(t, fmt.Sprintf("INTG-038 MIL: gateway ListMarches march_id/phase/to_x/to_y+viewport_anchor scroll-sync city_id=%d", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i38-march-viewport", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg038Failf(t, "list marches viewport scroll-sync", "city_id=%d code=%d msg=%s", cityID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg038Failf(t, "decode list marches viewport scroll-sync", "city_id=%d err=%v", cityID, err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 || listOut.GetTotal() < 1 {
		t.Logf("INTG-038: skip ListMarches viewport scroll-sync (empty list total=%d; hint StartMarch — see tools/smoke/README.md)", listOut.GetTotal())
		return
	}
	const maxLog = 4
	var rowParts []string
	visibleInViewport := 0
	for i, m := range marches {
		dx, dy := m.GetToX()-anchorX, m.GetToY()-anchorY
		if dx < 0 {
			dx = -dx
		}
		if dy < 0 {
			dy = -dy
		}
		if anchorX == 0 && anchorY == 0 || (dx <= smokeINTG038ViewportRadiusTiles && dy <= smokeINTG038ViewportRadiusTiles) {
			visibleInViewport++
		}
		if i < maxLog {
			rowParts = append(rowParts, fmt.Sprintf("march_id=%d phase=%s to_x=%d to_y=%d",
				m.GetMarchId(), m.GetPhase().String(), m.GetToX(), m.GetToY()))
		}
	}
	first := marches[0]
	t.Logf("INTG-038: ListMarches player_id=%d total=%d rows=[%s] viewport_anchor_x=%d viewport_anchor_y=%d visible_in_viewport=%d scroll_sync_visible_row_hint=client_derived first_eta depart_at_ms=%d arrive_at_ms=%d grid_eta_readonly_hint=client_derived",
		playerID, listOut.GetTotal(), strings.Join(rowParts, "; "),
		anchorX, anchorY, visibleInViewport,
		first.GetDepartAtMs(), first.GetArriveAtMs())
}

func smokeINTG038StartMarchFormRefreshStampGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-038: skip StartMarch form refresh stamp (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	listBeforeMs := time.Now().UnixMilli()
	var toX, toY int32 = 46, 47
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i38-form-list-before", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code == 0 {
		var listOut militaryv1.ListMarchesResponse
		if err := proto.Unmarshal(listResp.Data, &listOut); err == nil && len(listOut.GetMarches()) > 0 {
			base := listOut.GetMarches()[0]
			toX, toY = base.GetToX()+5, base.GetToY()+5
			if !smokeValidWorldTileCoord(toX) || !smokeValidWorldTileCoord(toY) {
				toX, toY = 46, 47
			}
		}
	}
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 30)
	heroID := smokeEnsureMarchHeroID(t, context.Background(), c, apiSrv, sid, playerID)
	const marchPurpose = int32(1)
	smokeStep(t, fmt.Sprintf("INTG-038 MIL: gateway StartMarch march_id+intel_refresh_stamp (MarchAttack equiv) to=(%d,%d)", toX, toY))
	marchResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i38-march-refresh", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: toX, ToY: toY, Purpose: marchPurpose, HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5}},
		}),
	})
	refreshStampMs := time.Now().UnixMilli()
	if marchResp.Code != 0 {
		t.Logf("INTG-038: skip StartMarch form refresh stamp (code=%d msg=%s; hint valid target tile — see tools/smoke/README.md)", marchResp.Code, marchResp.Msg)
		return
	}
	var marchOut militaryv1.StartMarchResponse
	if err := proto.Unmarshal(marchResp.Data, &marchOut); err != nil {
		intg038Failf(t, "decode start march form refresh", "player_id=%d err=%v", playerID, err)
	}
	marchID := marchOut.GetMarch().GetMarchId()
	if marchID == 0 {
		t.Logf("INTG-038: skip StartMarch form refresh stamp (empty march_id; hint troop reserve — see tools/smoke/README.md)")
		return
	}
	t.Logf("INTG-038: StartMarch form_feedback ok march_id=%d to_x=%d to_y=%d phase=%s player_id=%d intel_list_refresh_stamp_ms=%d list_before_ms=%d march_form_validation_summary_hint=client_derived",
		marchID, toX, toY, marchOut.GetMarch().GetPhase().String(), playerID, refreshStampMs, listBeforeMs)
}

func smokeINTG038ListBattleReportsDensityKeyboardGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(20)
	smokeStep(t, fmt.Sprintf("INTG-038 MIL: gateway ListBattleReports report_id+outcome+coordinate+density/keyboard hint limit=%d", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i38-br-keyboard", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: 0}),
	})
	if resp.Code != 0 {
		intg038Failf(t, "list battle reports density keyboard", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg038Failf(t, "decode battle reports density keyboard", "player_id=%d err=%v", playerID, err)
	}
	reports := out.GetReports()
	if out.GetTotal() < 1 || len(reports) < 1 {
		t.Logf("INTG-038: skip ListBattleReports density/keyboard (no reports; hint march arrival — see tools/smoke/README.md)")
		return
	}
	first := reports[0]
	coordHint := smokeINTG032BattleReportCoordinateHint(first)
	t.Logf("INTG-038: ListBattleReports player_id=%d first_report_id=%d outcome=%d coordinate_hint=%s detail_summary_copy_bar_hint=client_derived row_density_hint=compact keyboard_focus_j_index=0 total=%d",
		playerID, first.GetReportId(), first.GetOutcome(), coordHint, out.GetTotal())
}

func smokeINTG038MailQuestHUDSyncGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-038 HUD: ListPlayerMail unclaimed+first mail_id + ListPlayerQuests chain_id=%d claimable", smokeDailyQuestChainID))
	mailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i38-mail-hud", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID, Filter: contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize: pageSize, PageOffset: 0,
		}),
	})
	if mailResp.Code != 0 {
		intg038Failf(t, "list player mail hud", "player_id=%d code=%d msg=%s", playerID, mailResp.Code, mailResp.Msg)
	}
	var mailOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(mailResp.Data, &mailOut); err != nil {
		intg038Failf(t, "decode list player mail hud", "player_id=%d err=%v", playerID, err)
	}
	mails := mailOut.GetMails()
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(mails)
	firstMailID := int64(0)
	if len(mails) > 0 {
		firstMailID = mails[0].GetMailId()
	}

	questResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i38-quest-hud", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		}),
	})
	if questResp.Code != 0 {
		intg038Failf(t, "list player quests hud", "player_id=%d code=%d msg=%s", playerID, questResp.Code, questResp.Msg)
	}
	var questOut questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(questResp.Data, &questOut); err != nil {
		intg038Failf(t, "decode list player quests hud", "player_id=%d err=%v", playerID, err)
	}
	var claimableCount int
	for _, q := range questOut.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
		}
	}
	if (mailOut.GetTotalCount() < 1 && len(mails) < 1) && claimableCount < 1 {
		t.Logf("INTG-038: skip mail+quest HUD sync (empty inbox claimable=0; hint GM send-mail + daily progress — see tools/smoke/README.md)")
		return
	}
	t.Logf("INTG-038: HUD mail_quest player_id=%d mail_total=%d unclaimed_attachment_count=%d first_mail_id=%d chain_id=%d claimable_count=%d hud_badge_sync_hint=client_derived",
		playerID, mailOut.GetTotalCount(), unclaimed, firstMailID, smokeDailyQuestChainID, claimableCount)
}

func smokeINTG038BagRankRecruitSkimGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-038 BAG+RANK+HERO: gateway ListPlayerBag consumable category + ListPowerRank/ListKillRank + ListRecruitTemplates length")
	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i38-bag-skim", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if bagResp.Code != 0 {
		intg038Failf(t, "list player bag skim", "player_id=%d code=%d msg=%s", playerID, bagResp.Code, bagResp.Msg)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		intg038Failf(t, "decode list player bag skim", "player_id=%d err=%v", playerID, err)
	}
	items := bagOut.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-038: skip ListPlayerBag consumable category (empty bag; hint grant — see tools/smoke/README.md)")
	} else {
		var picked *contentv1.PlayerItemStack
		for _, it := range items {
			if it.GetQuantity() < 1 {
				continue
			}
			if smokeINTG037ItemLooksConsumable(ctx, pool, it.GetItemCfgId()) {
				picked = it
				break
			}
		}
		if picked == nil {
			t.Logf("INTG-038: skip ListPlayerBag consumable category (no consumable stack; hint item_cfg_id=2001 — see tools/smoke/README.md)")
		} else {
			categoryHint := "consumable_category_hint=client_derived"
			if pool != nil {
				var itemType int32
				if err := pool.QueryRow(ctx, `SELECT item_type FROM cfg_item WHERE item_cfg_id = $1`, picked.GetItemCfgId()).Scan(&itemType); err == nil {
					categoryHint = fmt.Sprintf("item_type=%d consumable_scan_highlight_hint=client_derived", itemType)
				}
			}
			t.Logf("INTG-038: ListPlayerBag player_id=%d consumable item_id=%d count=%d %s",
				playerID, picked.GetItemCfgId(), picked.GetQuantity(), categoryHint)
		}
	}

	if pool != nil {
		if _, err := pool.Exec(ctx, `UPDATE player SET power = 3700 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID); err != nil {
			intg038Failf(t, "seed power for rank skim", "err=%v", err)
		}
		if err := apiSrv.RefreshRanks(ctx); err != nil {
			intg038Failf(t, "refresh ranks skim", "err=%v", err)
		}
	}
	for _, board := range []struct {
		lbType rankv1.LeaderboardType
		alias  string
		trace  string
	}{
		{rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER, "ListPowerRank", "i38-rank-power"},
		{rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE, "ListKillRank", "i38-rank-kill"},
	} {
		resp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteGetLeaderboard, TraceId: board.trace, SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
				ServerId: intg006ServerID, Type: board.lbType, Page: 1, PageSize: 20,
			}),
		})
		if resp.Code != 0 {
			intg038Failf(t, "get leaderboard skim", "alias=%s code=%d msg=%s", board.alias, resp.Code, resp.Msg)
		}
		var lbOut rankv1.GetLeaderboardResponse
		if err := proto.Unmarshal(resp.Data, &lbOut); err != nil {
			intg038Failf(t, "decode leaderboard skim", "alias=%s err=%v", board.alias, err)
		}
		entries := lbOut.GetEntries()
		if lbOut.GetTotalCount() < 1 || len(entries) < 1 {
			t.Logf("INTG-038: skip %s first row (empty; hint RefreshRanks — see tools/smoke/README.md)", board.alias)
			continue
		}
		e := entries[0]
		t.Logf("INTG-038: %s first_player_id=%d first_rank=%d entries_len=%d pin_row_hint=client_derived",
			board.alias, e.GetEntityId(), e.GetRank(), len(entries))
	}

	tplResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListRecruitTemplates, TraceId: "i38-recruit-len", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListRecruitTemplatesRequest{ServerId: intg006ServerID, PageSize: 50}),
	})
	if tplResp.Code != 0 {
		t.Logf("INTG-038: skip ListRecruitTemplates length (code=%d msg=%s — see tools/smoke/README.md)", tplResp.Code, tplResp.Msg)
	} else {
		var tplOut herov1.ListRecruitTemplatesResponse
		if err := proto.Unmarshal(tplResp.Data, &tplOut); err != nil {
			intg038Failf(t, "decode recruit templates length", "player_id=%d err=%v", playerID, err)
		}
		templates := tplOut.GetTemplates()
		if len(templates) < 1 {
			t.Logf("INTG-038: skip ListRecruitTemplates length (empty templates; hint DATA-002 — see tools/smoke/README.md)")
		} else {
			t.Logf("INTG-038: ListRecruitTemplates player_id=%d template_list_length=%d total_count=%d recruit_wallet_contrast_hint=client_derived",
				playerID, len(templates), tplOut.GetTotalCount())
		}
	}

	shopResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "i38-shop-skim", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	if shopResp.Code != 0 {
		t.Logf("INTG-038: skip ListShopShelf shop skim (code=%d msg=%s — see tools/smoke/README.md)", shopResp.Code, shopResp.Msg)
		return
	}
	var shopOut shopv1.ListShopShelfResponse
	if err := proto.Unmarshal(shopResp.Data, &shopOut); err != nil {
		intg038Failf(t, "decode shop shelf skim", "player_id=%d err=%v", playerID, err)
	}
	offers := shopOut.GetOffers()
	if len(offers) < 1 {
		t.Logf("INTG-038: skip ListShopShelf shop skim (empty offers — see tools/smoke/README.md)")
		return
	}
	first := offers[0]
	price, currency := smokeINTG029ShopOfferPriceCurrency(first)
	t.Logf("INTG-038: ListShopShelf player_id=%d first_offer_id=%d price=%d currency=%s bag_shop_scan_highlight_hint=client_derived",
		playerID, first.GetOfferId(), price, currency)
}

func intg038Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG038CfgHint, step, fmt.Sprintf(format, args...))
}
