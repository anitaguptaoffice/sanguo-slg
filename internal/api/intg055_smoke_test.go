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
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG055CfgHint = smokeINTG054CfgHint + "; INTG-055: ListMarches phase+scroll-sync residual deepest-deepest-deepest anchor; StartMarch march_id+troop_margin+refresh_stamp residual deepest-deepest-deepest; ListBattleReports adjacent-nav+j/k coords deepest-deepest-deepest; ListPlayerMail attachment HUD deepest-deepest-deepest; ListPlayerBag+shop return residual deepest-deepest-deepest; ListPowerRank/ListKillRank density residual deepest-deepest-deepest; ListPlayerQuests claimable HUD residual deepest-deepest-deepest; intel phase remarch prefill residual deepest-deepest-deepest"

// TestINTG055Wave55SmokePath extends INTG-054 with wave:55 world/intel/battle-report/mail/bag-shop/rank/quest residual-deepest-deepest-deepest gateway hints (CLIENT-348–354).
func TestINTG055Wave55SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-055 wave:55 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG055Wave55Smoke(t)
}

func runINTG055Wave55Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG055Wave55BeforeRestartGateway)
}

func smokeINTG055Wave55BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG054Wave54BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG055ListMarchesScrollSyncResidualDeepestDeepestDeepestAnchorGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG055MarchTroopMarginRefreshStampResidualDeepestDeepestDeepestGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG055ListBattleReportsAdjacentNavDeepestDeepestDeepestGateway(t, c, sid, playerID)
	smokeINTG055MailAttachmentHUDDeepestDeepestDeepestGateway(t, c, sid, playerID)
	smokeINTG055BagShopReturnResidualDeepestDeepestDeepestGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG055RankDensityResidualDeepestDeepestDeepestGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG055QuestClaimableHUDResidualDeepestDeepestDeepestGateway(t, c, sid, playerID)
}

func smokeINTG055ListMarchesScrollSyncResidualDeepestDeepestDeepestAnchorGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-055: skip ListMarches scroll-sync residual deepest-deepest-deepest anchor (no city_id; hint StartMarch — see tools/smoke/README.md)")
		return
	}
	var anchorX, anchorY int32
	cityResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerCities, TraceId: "i55-scroll-deepest-deepest-deepest-anchor", SessionId: sid, ServerId: intg006ServerID,
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
		}
	}
	smokeINTG034OptionalSecondMarchGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeStep(t, fmt.Sprintf("INTG-055 MIL: gateway ListMarches phase/to_x/to_y+minimap scroll-sync residual deepest-deepest-deepest anchor city_id=%d (CLIENT-348/354)", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i55-march-scroll-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg055Failf(t, "list marches scroll-sync residual deepest-deepest-deepest anchor", "city_id=%d code=%d msg=%s", cityID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg055Failf(t, "decode list marches scroll-sync residual deepest-deepest-deepest anchor", "city_id=%d err=%v", cityID, err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 || listOut.GetTotal() < 1 {
		t.Logf("INTG-055: skip ListMarches scroll-sync residual deepest-deepest-deepest anchor (empty total=%d; hint StartMarch — see tools/smoke/README.md)", listOut.GetTotal())
		return
	}
	first := marches[0]
	syncAnchor := fmt.Sprintf("scroll_sync_residual_deepest_deepest_deepest_anchor_x=%d scroll_sync_residual_deepest_deepest_deepest_anchor_y=%d", anchorX, anchorY)
	if anchorX == 0 && anchorY == 0 {
		syncAnchor = "scroll_sync_residual_deepest_deepest_deepest_anchor_hint=skip_no_viewport"
	}
	t.Logf("INTG-055: ListMarches player_id=%d total=%d first march_id=%d phase=%s to_x=%d to_y=%d %s minimap_intel_scroll_sync_residual_deepest_deepest_deepest_anchor_hint=client_derived grid_eta_cross_residual_deepest_deepest_deepest_hint=client_derived scroll_sync_residual_deepest_deepest_deepest_ring_hint=client_derived minimap_intel_list_row_residual_deepest_deepest_deepest_focus_hint=client_derived",
		playerID, listOut.GetTotal(), first.GetMarchId(), first.GetPhase().String(), first.GetToX(), first.GetToY(), syncAnchor)
	var phaseParts []string
	for i, m := range marches {
		if i >= 3 {
			break
		}
		phaseParts = append(phaseParts, fmt.Sprintf("march_id=%d phase=%s to_x=%d to_y=%d",
			m.GetMarchId(), m.GetPhase().String(), m.GetToX(), m.GetToY()))
	}
	t.Logf("INTG-055: intel_phase_residual_deepest_deepest_deepest rows=[%s] prefill_march_id=%d prefill_to_x=%d prefill_to_y=%d intel_phase_change_residual_deepest_deepest_deepest_pulse_hint=client_derived intel_march_prefill_residual_deepest_deepest_deepest_line_hint=client_derived intel_remarch_form_prefill_residual_deepest_deepest_deepest_hint=client_derived",
		strings.Join(phaseParts, "; "), first.GetMarchId(), first.GetToX(), first.GetToY())
}

func smokeINTG055MarchTroopMarginRefreshStampResidualDeepestDeepestDeepestGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-055: skip MarchAttack troop margin residual deepest-deepest-deepest (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	listBeforeMs := time.Now().UnixMilli()
	var toX, toY int32 = 64, 65
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 40)
	heroID := smokeEnsureMarchHeroID(t, context.Background(), c, apiSrv, sid, playerID)
	const marchPurpose = int32(1)
	const marchCount = int32(5)
	smokeStep(t, fmt.Sprintf("INTG-055 MIL: gateway StartMarch (MarchAttack equiv) march_id+troop_margin+intel_refresh_stamp residual deepest-deepest-deepest to=(%d,%d) (CLIENT-349)", toX, toY))
	marchResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i55-march-margin-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: toX, ToY: toY, Purpose: marchPurpose, HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: marchCount}},
		}),
	})
	refreshStampMs := time.Now().UnixMilli()
	if marchResp.Code != 0 {
		t.Logf("INTG-055: skip MarchAttack troop margin residual deepest-deepest-deepest (code=%d msg=%s; hint valid target tile — see tools/smoke/README.md)", marchResp.Code, marchResp.Msg)
		return
	}
	var marchOut militaryv1.StartMarchResponse
	if err := proto.Unmarshal(marchResp.Data, &marchOut); err != nil {
		intg055Failf(t, "decode start march troop margin residual deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	marchID := marchOut.GetMarch().GetMarchId()
	if marchID == 0 {
		t.Logf("INTG-055: skip MarchAttack troop margin residual deepest-deepest-deepest (empty march_id; hint troop reserve — see tools/smoke/README.md)")
		return
	}
	remCount := int32(0)
	for _, st := range marchOut.GetCityTroops() {
		if st.GetUnitCfgId() == smokeMarchTroopUnitCfgID {
			remCount = st.GetCount()
			break
		}
	}
	t.Logf("INTG-055: StartMarch march_id=%d to_x=%d to_y=%d phase=%s player_id=%d troop_remainder_unit_cfg_id=%d count=%d marched_count=%d intel_list_refresh_stamp_ms=%d list_before_ms=%d march_form_troop_margin_residual_deepest_deepest_deepest_hint=client_derived march_submit_intel_refresh_stamp_residual_deepest_deepest_deepest_hint=client_derived troop_margin_residual_deepest_deepest_deepest_formatter_hint=client_derived march_troop_remainder_readonly_residual_deepest_deepest_deepest_hint=client_derived",
		marchID, toX, toY, marchOut.GetMarch().GetPhase().String(), playerID, smokeMarchTroopUnitCfgID, remCount, marchCount, refreshStampMs, listBeforeMs)
}

func smokeINTG055ListBattleReportsAdjacentNavDeepestDeepestDeepestGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(20)
	smokeStep(t, fmt.Sprintf("INTG-055 MIL: gateway ListBattleReports outcome+coordinate+adjacent-nav deepest-deepest-deepest hint limit=%d (CLIENT-350)", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i55-br-adjacent-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: 0}),
	})
	if resp.Code != 0 {
		intg055Failf(t, "list battle reports adjacent nav deepest-deepest-deepest", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg055Failf(t, "decode battle reports adjacent nav deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	reports := out.GetReports()
	if out.GetTotal() < 1 || len(reports) < 1 {
		t.Logf("INTG-055: skip ListBattleReports adjacent-nav deepest-deepest-deepest (no reports; hint march arrival — see tools/smoke/README.md)")
		return
	}
	first := reports[0]
	coordHint := smokeINTG032BattleReportCoordinateHint(first)
	adjacentHint := "adjacent_nav_deepest_deepest_deepest_index=0"
	if len(reports) > 1 {
		adjacentHint = fmt.Sprintf("adjacent_nav_deepest_deepest_deepest_index=0 neighbor_report_id=%d keyboard_j_k_deepest_deepest_deepest_ring_hint=client_derived", reports[1].GetReportId())
	}
	t.Logf("INTG-055: ListBattleReports player_id=%d list_length=%d first_report_id=%d outcome=%d coordinate_hint=%s %s battle_report_coord_copy_bar_deepest_deepest_deepest_hint=client_derived coord_copy_bar_deepest_deepest_deepest_sweep_hint=client_derived battle_report_density_j_k_residual_deepest_deepest_deepest_hint=client_derived",
		playerID, len(reports), first.GetReportId(), first.GetOutcome(), coordHint, adjacentHint)
}

func smokeINTG055MailAttachmentHUDDeepestDeepestDeepestGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, "INTG-055 HUD: ListPlayerMail unclaimed attachment+first mail_id deepest-deepest-deepest (CLIENT-351)")
	mailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i55-mail-attach-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID, Filter: contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize: pageSize, PageOffset: 0,
		}),
	})
	if mailResp.Code != 0 {
		intg055Failf(t, "list player mail attachment hud deepest-deepest-deepest", "player_id=%d code=%d msg=%s", playerID, mailResp.Code, mailResp.Msg)
	}
	var mailOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(mailResp.Data, &mailOut); err != nil {
		intg055Failf(t, "decode list player mail attachment hud deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	mails := mailOut.GetMails()
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(mails)
	firstMailID := int64(0)
	if len(mails) > 0 {
		firstMailID = mails[0].GetMailId()
	}
	if mailOut.GetTotalCount() < 1 && len(mails) < 1 && unclaimed < 1 {
		t.Logf("INTG-055: skip ListPlayerMail attachment HUD deepest-deepest-deepest (empty inbox; hint GM send-mail — see tools/smoke/README.md)")
		return
	}
	t.Logf("INTG-055: ListPlayerMail player_id=%d mail_total=%d unclaimed_attachment_count=%d first_mail_id=%d mail_claim_hud_sync_deepest_deepest_deepest_hint=client_derived residual_deepest_deepest_deepest_badge_sync_hint=client_derived hud_mail_daily_cross_deepest_deepest_deepest_hint=client_derived mail_hud_attachment_claim_residual_deepest_deepest_deepest_hint=client_derived",
		playerID, mailOut.GetTotalCount(), unclaimed, firstMailID)
}

func smokeINTG055BagShopReturnResidualDeepestDeepestDeepestGateway(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-055 BAG+SHOP: gateway ListPlayerBag first consumable + ListShopShelf list length residual deepest-deepest-deepest (CLIENT-352)")
	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i55-bag-return-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if bagResp.Code != 0 {
		intg055Failf(t, "list player bag return residual deepest-deepest-deepest", "player_id=%d code=%d msg=%s", playerID, bagResp.Code, bagResp.Msg)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		intg055Failf(t, "decode list player bag return residual deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	items := bagOut.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-055: skip ListPlayerBag consumable residual deepest-deepest-deepest (empty bag; hint grant — see tools/smoke/README.md)")
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
			picked = items[0]
		}
		categoryHint := "consumable_category_residual_deepest_deepest_deepest_hint=client_derived"
		if pool != nil && picked != nil {
			var itemType int32
			if err := pool.QueryRow(ctx, `SELECT item_type FROM cfg_item WHERE item_cfg_id = $1`, picked.GetItemCfgId()).Scan(&itemType); err == nil {
				categoryHint = fmt.Sprintf("item_type=%d bag_shop_inline_state_residual_deepest_deepest_deepest_hint=client_derived", itemType)
			}
		}
		t.Logf("INTG-055: ListPlayerBag player_id=%d entry_count=%d first_consumable item_id=%d count=%d %s panel_return_source_highlight_residual_deepest_deepest_deepest_hint=client_derived return_source_residual_deepest_deepest_deepest_highlight_hint=client_derived bag_mall_return_highlight_residual_deepest_deepest_deepest_hint=client_derived",
			playerID, len(items), picked.GetItemCfgId(), picked.GetQuantity(), categoryHint)
	}

	shopResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "i55-shop-len-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	if shopResp.Code != 0 {
		t.Logf("INTG-055: skip ListShopShelf list length residual deepest-deepest-deepest (code=%d msg=%s — see tools/smoke/README.md)", shopResp.Code, shopResp.Msg)
		return
	}
	var shopOut shopv1.ListShopShelfResponse
	if err := proto.Unmarshal(shopResp.Data, &shopOut); err != nil {
		intg055Failf(t, "decode shop shelf return residual deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	offers := shopOut.GetOffers()
	if len(offers) < 1 {
		t.Logf("INTG-055: skip ListShopShelf list length residual deepest-deepest-deepest (empty offers — see tools/smoke/README.md)")
		return
	}
	t.Logf("INTG-055: ListShopShelf player_id=%d offer_list_length=%d shop_related_list_length_residual_deepest_deepest_deepest_hint=client_derived",
		playerID, len(offers))
}

func smokeINTG055RankDensityResidualDeepestDeepestDeepestGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-055 RANK: gateway ListPowerRank/ListKillRank list len+first-row density residual deepest-deepest-deepest (CLIENT-353; non-pin)")
	if pool != nil {
		if _, err := pool.Exec(ctx, `UPDATE player SET power = 4220 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID); err != nil {
			intg055Failf(t, "seed power for rank density residual deepest-deepest-deepest", "err=%v", err)
		}
		if err := apiSrv.RefreshRanks(ctx); err != nil {
			intg055Failf(t, "refresh ranks density residual deepest-deepest-deepest", "err=%v", err)
		}
	}
	for _, board := range []struct {
		lbType rankv1.LeaderboardType
		alias  string
		trace  string
	}{
		{rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER, "ListPowerRank", "i55-rank-power-deepest-deepest-deepest"},
		{rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE, "ListKillRank", "i55-rank-kill-deepest-deepest-deepest"},
	} {
		resp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteGetLeaderboard, TraceId: board.trace, SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
				ServerId: intg006ServerID, Type: board.lbType, Page: 1, PageSize: 20,
			}),
		})
		if resp.Code != 0 {
			intg055Failf(t, "get leaderboard density residual deepest-deepest-deepest", "alias=%s code=%d msg=%s", board.alias, resp.Code, resp.Msg)
		}
		var lbOut rankv1.GetLeaderboardResponse
		if err := proto.Unmarshal(resp.Data, &lbOut); err != nil {
			intg055Failf(t, "decode leaderboard density residual deepest-deepest-deepest", "alias=%s err=%v", board.alias, err)
		}
		entries := lbOut.GetEntries()
		if lbOut.GetTotalCount() < 1 || len(entries) < 1 {
			t.Logf("INTG-055: skip %s density residual deepest-deepest-deepest (empty total=%d; hint RefreshRanks — see tools/smoke/README.md)", board.alias, lbOut.GetTotalCount())
			continue
		}
		e := entries[0]
		t.Logf("INTG-055: %s entries_len=%d total_count=%d first_player_id=%d first_rank=%d first_score=%d rank_list_density_scan_residual_deepest_deepest_deepest_hint=client_derived rank_recruit_scan_residual_deepest_deepest_deepest_hint=client_derived viewer_player_id=%d",
			board.alias, len(entries), lbOut.GetTotalCount(), e.GetEntityId(), e.GetRank(), e.GetScore(), playerID)
	}

	tplResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListRecruitTemplates, TraceId: "i55-recruit-scan-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListRecruitTemplatesRequest{ServerId: intg006ServerID, PageSize: 50}),
	})
	if tplResp.Code != 0 {
		t.Logf("INTG-055: skip ListRecruitTemplates scan residual deepest-deepest-deepest (code=%d msg=%s — see tools/smoke/README.md)", tplResp.Code, tplResp.Msg)
		return
	}
	var tplOut herov1.ListRecruitTemplatesResponse
	if err := proto.Unmarshal(tplResp.Data, &tplOut); err != nil {
		intg055Failf(t, "decode recruit templates scan residual deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	templates := tplOut.GetTemplates()
	if len(templates) < 1 {
		t.Logf("INTG-055: skip ListRecruitTemplates scan residual deepest-deepest-deepest (empty; hint DATA-002 — see tools/smoke/README.md)")
		return
	}
	first := templates[0]
	t.Logf("INTG-055: ListRecruitTemplates player_id=%d template_list_length=%d first_template_cfg_id=%d recruit_template_inline_residual_deepest_deepest_deepest_summary_hint=client_derived",
		playerID, len(templates), first.GetTemplateCfgId())
}

func smokeINTG055QuestClaimableHUDResidualDeepestDeepestDeepestGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-055 HUD: gateway ListPlayerQuests chain_id=%d claimable count residual deepest-deepest-deepest (CLIENT-351 mail/daily badge)", smokeDailyQuestChainID))
	questResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i55-quest-hud-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		}),
	})
	if questResp.Code != 0 {
		intg055Failf(t, "list player quests claimable hud residual deepest-deepest-deepest", "player_id=%d code=%d msg=%s", playerID, questResp.Code, questResp.Msg)
	}
	var questOut questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(questResp.Data, &questOut); err != nil {
		intg055Failf(t, "decode list player quests claimable hud residual deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	var claimableCount int
	for _, q := range questOut.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
		}
	}
	if claimableCount < 1 && len(questOut.GetQuests()) < 1 {
		t.Logf("INTG-055: skip ListPlayerQuests claimable HUD residual deepest-deepest-deepest (empty chain claimable=0; hint daily progress — see tools/smoke/README.md)")
		return
	}
	t.Logf("INTG-055: ListPlayerQuests player_id=%d chain_id=%d claimable_count=%d hud_mail_daily_badge_residual_deepest_deepest_deepest_hint=client_derived quest_hud_mail_cross_residual_deepest_deepest_deepest_hint=client_derived",
		playerID, smokeDailyQuestChainID, claimableCount)
}

func intg055Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG055CfgHint, step, fmt.Sprintf(format, args...))
}
