package api_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	accountcommonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG030CfgHint = smokeINTG029CfgHint + "; INTG-030: ListMarches first march_id+phase+from/to+ETA; ListPlayerQuests chain400 in_progress progress+reward hint; ListPlayerBag item_id+quantity+cfg_item_type hint; ListBattleReports first report_id+outcome; ListPlayerMail unclaimed+attachment type hint"

// TestINTG030Wave33SmokePath extends INTG-029 with march info card fields, daily reward readout, bag cfg summary, battle outcome, and mail attachment hints for wave:33 CLIENT readouts.
func TestINTG030Wave33SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-030 wave:33 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG030Wave33Smoke(t)
}

func runINTG030Wave33Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG030Wave33BeforeRestartGateway)
}

func smokeINTG030Wave33BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG029Wave32BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG030ListMarchesFirstMarchInfoCardGateway(t, c, sid, cityID, playerID)
	smokeINTG030ListPlayerQuestsChain400InProgressRewardGateway(t, c, sid, playerID)
	smokeINTG030ListPlayerBagCfgSummaryGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG030ListBattleReportsFirstOutcomeGateway(t, c, sid, playerID)
	smokeINTG030ListPlayerMailUnclaimedAttachmentHintGateway(t, c, sid, playerID)
}

// smokeINTG030ListMarchesFirstMarchInfoCardGateway logs first march phase, endpoints, and ETA fields (CLIENT-172/178).
func smokeINTG030ListMarchesFirstMarchInfoCardGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		t.Logf("INTG-030: skip ListMarches march info card (no city_id; hint StartMarch — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-030 MIL: gateway ListMarches first march_id+phase+from/to+ETA city_id=%d", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i30-march-info", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg030Failf(t, "list marches info card", "city_id=%d code=%d msg=%s", cityID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg030Failf(t, "decode list marches info card", "city_id=%d err=%v", cityID, err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 || listOut.GetTotal() < 1 {
		t.Logf("INTG-030: skip ListMarches march info card (empty list total=%d; hint StartMarch — see tools/smoke/README.md)", listOut.GetTotal())
		return
	}
	first := marches[0]
	t.Logf("INTG-030: ListMarches first march_id=%d phase=%s from_x=%d from_y=%d to_x=%d to_y=%d depart_at_ms=%d arrive_at_ms=%d player_id=%d total=%d",
		first.GetMarchId(), first.GetPhase().String(), first.GetFromX(), first.GetFromY(), first.GetToX(), first.GetToY(),
		first.GetDepartAtMs(), first.GetArriveAtMs(), playerID, listOut.GetTotal())
}

// smokeINTG030ListPlayerQuestsChain400InProgressRewardGateway logs first in-progress quest progress and reward_preview hint (CLIENT-174).
func smokeINTG030ListPlayerQuestsChain400InProgressRewardGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-030 QUEST: gateway ListPlayerQuests chain_id=%d first in_progress progress+reward hint", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i30-quests-reward", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          smokeDailyQuestChainID,
			IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg030Failf(t, "list player quests in progress reward", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg030Failf(t, "decode list player quests in progress reward", "player_id=%d err=%v", playerID, err)
	}
	quests := out.GetQuests()
	if len(quests) < 1 {
		t.Logf("INTG-030: skip ListPlayerQuests chain_id=%d in_progress progress+reward (empty chain; hint seed or accept quest — see tools/smoke/README.md)", smokeDailyQuestChainID)
		return
	}
	var picked *questv1.PlayerQuestProgress
	for _, q := range quests {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_IN_PROGRESS {
			picked = q
			break
		}
	}
	if picked == nil {
		t.Logf("INTG-030: skip ListPlayerQuests chain_id=%d in_progress progress+reward (no in_progress row; hint quest progress hook — see tools/smoke/README.md)", smokeDailyQuestChainID)
		return
	}
	rewardHint := smokeINTG030QuestRewardPreviewHint(picked.GetRewardPreview())
	t.Logf("INTG-030: ListPlayerQuests chain_id=%d quest_cfg_id=%d progress_current=%d progress_target=%d reward_hint=%s player_id=%d",
		smokeDailyQuestChainID, picked.GetQuestCfgId(), picked.GetProgressCurrent(), picked.GetProgressTarget(), rewardHint, playerID)
}

// smokeINTG030ListPlayerBagCfgSummaryGateway logs first bag stack with cfg_item item_type hint (CLIENT-175).
func smokeINTG030ListPlayerBagCfgSummaryGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-030 BAG: gateway ListPlayerBag first item_id+quantity+cfg_item_type hint")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i30-bag-cfg", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg030Failf(t, "list player bag cfg summary", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg030Failf(t, "decode list player bag cfg summary", "player_id=%d err=%v", playerID, err)
	}
	items := out.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-030: skip ListPlayerBag cfg summary (empty bag; hint M4 grant / quest reward — see tools/smoke/README.md)")
		return
	}
	first := items[0]
	cfgHint := smokeINTG030LookupItemCfgTypeHint(ctx, pool, first.GetItemCfgId())
	t.Logf("INTG-030: ListPlayerBag player_id=%d item_id=%d quantity=%d cfg_item_type_hint=%s entry_count=%d",
		playerID, first.GetItemCfgId(), first.GetQuantity(), cfgHint, len(items))
}

// smokeINTG030ListBattleReportsFirstOutcomeGateway logs first battle report id and outcome (CLIENT-176).
func smokeINTG030ListBattleReportsFirstOutcomeGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(10)
	smokeStep(t, fmt.Sprintf("INTG-030 MIL: gateway ListBattleReports first report_id+outcome limit=%d", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i30-br-outcome", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: 0}),
	})
	if resp.Code != 0 {
		intg030Failf(t, "list battle reports outcome", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg030Failf(t, "decode battle reports outcome", "player_id=%d err=%v", playerID, err)
	}
	reports := out.GetReports()
	if out.GetTotal() < 1 || len(reports) < 1 {
		t.Logf("INTG-030: ListBattleReports outcome hint only (no reports; hint march arrival — see tools/smoke/README.md)")
		return
	}
	first := reports[0]
	t.Logf("INTG-030: ListBattleReports player_id=%d first_report_id=%d outcome=%d total=%d page_count=%d",
		playerID, first.GetReportId(), first.GetOutcome(), out.GetTotal(), len(reports))
}

// smokeINTG030ListPlayerMailUnclaimedAttachmentHintGateway logs unclaimed attachment count and first mail attachment type hint (CLIENT-177).
func smokeINTG030ListPlayerMailUnclaimedAttachmentHintGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-030 MAIL: gateway ListPlayerMail unclaimed_attachment+first attachment hint page_size=%d", pageSize))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i30-mail-attach", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if resp.Code != 0 {
		intg030Failf(t, "list player mail attachment hint", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg030Failf(t, "decode list player mail attachment hint", "player_id=%d err=%v", playerID, err)
	}
	if out.GetTotalCount() < 1 && len(out.GetMails()) < 1 {
		t.Logf("INTG-030: skip ListPlayerMail attachment hint (empty inbox; hint GM send-mail — see tools/smoke/README.md)")
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
		t.Logf("INTG-030: ListPlayerMail player_id=%d unclaimed_attachment_count=%d (hint only: no mail with attachments on page — see tools/smoke/README.md)",
			playerID, unclaimed)
		return
	}
	t.Logf("INTG-030: ListPlayerMail player_id=%d total_count=%d unclaimed_attachment_count=%d first_attachment_mail_id=%d mail_type=%d attachment_hint=%s",
		playerID, out.GetTotalCount(), unclaimed, attachMail.GetMailId(), attachMail.GetMailType(),
		smokeINTG030MailAttachmentTypeHint(attachMail))
}

func smokeINTG030QuestRewardPreviewHint(bundle *accountcommonv1.RewardBundle) string {
	if bundle == nil {
		return "reward_preview=empty"
	}
	if pack := bundle.GetRewardPackId(); pack != "" {
		return fmt.Sprintf("reward_pack_id=%s", pack)
	}
	items := bundle.GetItems()
	if len(items) > 0 && items[0].GetItemCfgId() > 0 {
		return fmt.Sprintf("reward_item_cfg_id=%d qty=%d", items[0].GetItemCfgId(), items[0].GetQuantity())
	}
	res := bundle.GetResources()
	if res != nil {
		if res.GetGold() > 0 {
			return fmt.Sprintf("reward_resources gold=%d", res.GetGold())
		}
		if res.GetFood() > 0 {
			return fmt.Sprintf("reward_resources food=%d", res.GetFood())
		}
	}
	return "reward_preview=unspecified"
}

func smokeINTG030MailAttachmentTypeHint(m *contentv1.PlayerMail) string {
	if m == nil {
		return "none"
	}
	att := m.GetAttachments()
	if att == nil {
		return "attachments=empty"
	}
	items := att.GetItems()
	if len(items) > 0 && items[0].GetItemCfgId() > 0 {
		return fmt.Sprintf("item_cfg_id=%d qty=%d", items[0].GetItemCfgId(), items[0].GetQuantity())
	}
	if pack := att.GetRewardPackId(); pack != "" {
		return fmt.Sprintf("reward_pack_id=%s", pack)
	}
	res := att.GetResources()
	if res != nil {
		if res.GetGold() > 0 {
			return fmt.Sprintf("resources gold=%d", res.GetGold())
		}
		if res.GetFood() > 0 {
			return fmt.Sprintf("resources food=%d", res.GetFood())
		}
	}
	return "attachment_type=unspecified"
}

func smokeINTG030LookupItemCfgTypeHint(ctx context.Context, pool *pgxpool.Pool, itemCfgID int32) string {
	if itemCfgID <= 0 {
		return "item_cfg_id=0"
	}
	if pool == nil {
		return smokeINTG030ItemCfgTypeHintHeuristic(itemCfgID)
	}
	var itemType int32
	err := pool.QueryRow(ctx, `SELECT item_type FROM cfg_item WHERE item_cfg_id = $1`, itemCfgID).Scan(&itemType)
	if err != nil {
		return smokeINTG030ItemCfgTypeHintHeuristic(itemCfgID)
	}
	switch itemType {
	case 1:
		return "cfg_item_type=1(resource_pack_or_box)"
	case 2:
		return "cfg_item_type=2(speedup)"
	case 3:
		return "cfg_item_type=3(recruit)"
	case 4:
		return "cfg_item_type=4(train_troop)"
	default:
		return fmt.Sprintf("cfg_item_type=%d", itemType)
	}
}

func smokeINTG030ItemCfgTypeHintHeuristic(itemCfgID int32) string {
	switch {
	case itemCfgID >= 2000 && itemCfgID < 2100:
		return fmt.Sprintf("cfg_item_type_hint=consumable(item_cfg_id=%d)", itemCfgID)
	case itemCfgID >= 2100 && itemCfgID < 2200:
		return fmt.Sprintf("cfg_item_type_hint=speedup(item_cfg_id=%d)", itemCfgID)
	default:
		return fmt.Sprintf("cfg_item_type_hint=unknown(item_cfg_id=%d)", itemCfgID)
	}
}

func intg030Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG030CfgHint, step, fmt.Sprintf(format, args...))
}
