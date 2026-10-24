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
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG036CfgHint = smokeINTG035CfgHint + "; INTG-036: ListMarches multi-row march_id/phase/to_x/to_y+first ETA; StartMarch march_id handoff (MarchAttack equiv); ListBattleReports report_id+outcome+coordinate; ListPlayerMail tab/type+battle-report mail_id; ListPlayerQuests military chain in_progress"

// smokeINTG036MilitaryQuestChainID is DATA-002 chain 300 (train_troops military training).
const smokeINTG036MilitaryQuestChainID = int32(300)

// smokeINTG036DailyMilitaryTrainQuestCfgID is daily_train_1 on chain 400 (军事类日常).
const smokeINTG036DailyMilitaryTrainQuestCfgID = int32(1014)

// TestINTG036Wave39SmokePath extends INTG-035 with minimap/intel march sync, march submit handoff, battle report coordinate/outcome, battle-report mail tab, and military HUD quest hints for wave:39 CLIENT readouts.
func TestINTG036Wave39SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-036 wave:39 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG036Wave39Smoke(t)
}

func runINTG036Wave39Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG036Wave39BeforeRestartGateway)
}

func smokeINTG036Wave39BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG035Wave38BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG036ListMarchesMinimapPhaseGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG036StartMarchIntelHandoffGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG036ListBattleReportsCoordinateOutcomeGateway(t, c, sid, playerID)
	smokeINTG036ListPlayerMailBattleReportTabGateway(t, c, sid, playerID)
	smokeINTG036ListPlayerQuestsMilitaryInProgressGateway(t, c, sid, playerID)
}

// smokeINTG036ListMarchesMinimapPhaseGateway logs multiple march rows with march_id/phase/destination for minimap↔intel sync (CLIENT-220/221).
func smokeINTG036ListMarchesMinimapPhaseGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-036: skip ListMarches march_id/phase/to_x/to_y (no city_id; hint StartMarch — see tools/smoke/README.md)")
		return
	}
	smokeINTG034OptionalSecondMarchGateway(t, c, apiSrv, sid, cityID, playerID)

	smokeStep(t, fmt.Sprintf("INTG-036 MIL: gateway ListMarches multi-row march_id/phase/to_x/to_y+first ETA city_id=%d", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i36-march-sync", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg036Failf(t, "list marches minimap sync", "city_id=%d code=%d msg=%s", cityID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg036Failf(t, "decode list marches minimap sync", "city_id=%d err=%v", cityID, err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 || listOut.GetTotal() < 1 {
		t.Logf("INTG-036: skip ListMarches march_id/phase/to_x/to_y (empty list total=%d; hint StartMarch — see tools/smoke/README.md)", listOut.GetTotal())
		return
	}
	const maxLog = 4
	var rowParts []string
	for i, m := range marches {
		if i >= maxLog {
			break
		}
		rowParts = append(rowParts, fmt.Sprintf("march_id=%d phase=%s to_x=%d to_y=%d",
			m.GetMarchId(), m.GetPhase().String(), m.GetToX(), m.GetToY()))
	}
	first := marches[0]
	t.Logf("INTG-036: ListMarches player_id=%d total=%d logged_rows=%d rows=[%s] first_eta depart_at_ms=%d arrive_at_ms=%d phase_pulse_hint=client_derived",
		playerID, listOut.GetTotal(), len(rowParts), strings.Join(rowParts, "; "),
		first.GetDepartAtMs(), first.GetArriveAtMs())
}

// smokeINTG036StartMarchIntelHandoffGateway logs StartMarch response march_id (MarchAttack RPC not in proto; CLIENT-222 intel handoff).
func smokeINTG036StartMarchIntelHandoffGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-036: skip StartMarch march_id handoff (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	var toX, toY int32 = 44, 45
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i36-handoff-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code == 0 {
		var listOut militaryv1.ListMarchesResponse
		if err := proto.Unmarshal(listResp.Data, &listOut); err == nil && len(listOut.GetMarches()) > 0 {
			base := listOut.GetMarches()[0]
			toX, toY = base.GetToX()+4, base.GetToY()+4
			if !smokeValidWorldTileCoord(toX) || !smokeValidWorldTileCoord(toY) {
				toX, toY = 44, 45
			}
		}
	}
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 30)
	const marchPurpose = int32(1)
	smokeStep(t, fmt.Sprintf("INTG-036 MIL: gateway StartMarch march_id handoff (MarchAttack equiv) to=(%d,%d)", toX, toY))
	marchResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i36-march-handoff", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: toX, ToY: toY, Purpose: marchPurpose,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5}},
		}),
	})
	if marchResp.Code != 0 {
		t.Logf("INTG-036: skip StartMarch march_id handoff (code=%d msg=%s; hint valid target tile — see tools/smoke/README.md)", marchResp.Code, marchResp.Msg)
		return
	}
	var marchOut militaryv1.StartMarchResponse
	if err := proto.Unmarshal(marchResp.Data, &marchOut); err != nil {
		intg036Failf(t, "decode start march handoff", "player_id=%d err=%v", playerID, err)
	}
	marchID := marchOut.GetMarch().GetMarchId()
	if marchID == 0 {
		t.Logf("INTG-036: skip StartMarch march_id handoff (empty march_id; hint troop reserve — see tools/smoke/README.md)")
		return
	}
	t.Logf("INTG-036: StartMarch handoff ok march_id=%d to_x=%d to_y=%d phase=%s player_id=%d intel_new_march_highlight_hint=client_derived",
		marchID, toX, toY, marchOut.GetMarch().GetPhase().String(), playerID)
}

// smokeINTG036ListBattleReportsCoordinateOutcomeGateway logs first report_id with outcome and coordinate hint for intel/minimap replay (CLIENT-223/224/225).
func smokeINTG036ListBattleReportsCoordinateOutcomeGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(20)
	smokeStep(t, fmt.Sprintf("INTG-036 MIL: gateway ListBattleReports first report_id+outcome+coordinate hint limit=%d", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i36-br-coord", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: 0}),
	})
	if resp.Code != 0 {
		intg036Failf(t, "list battle reports coordinate", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg036Failf(t, "decode battle reports coordinate", "player_id=%d err=%v", playerID, err)
	}
	reports := out.GetReports()
	if out.GetTotal() < 1 || len(reports) < 1 {
		t.Logf("INTG-036: skip ListBattleReports coordinate+outcome (no reports; hint march arrival — see tools/smoke/README.md)")
		return
	}
	first := reports[0]
	coordHint := smokeINTG032BattleReportCoordinateHint(first)
	t.Logf("INTG-036: ListBattleReports player_id=%d first_report_id=%d outcome=%d coordinate_hint=%s outcome_filter_session_hint=client_derived total=%d",
		playerID, first.GetReportId(), first.GetOutcome(), coordHint, out.GetTotal())
}

// smokeINTG036ListPlayerMailBattleReportTabGateway logs per-tab counts, attachment-type summary, and first battle-report mail id (CLIENT-225).
func smokeINTG036ListPlayerMailBattleReportTabGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-036 MAIL: gateway ListPlayerMail tab/type counts+battle-report mail_id hint page_size=%d", pageSize))
	allResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i36-mail-battle-tab", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID, Filter: contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize: pageSize, PageOffset: 0,
		}),
	})
	if allResp.Code != 0 {
		intg036Failf(t, "list player mail battle tab", "player_id=%d code=%d msg=%s", playerID, allResp.Code, allResp.Msg)
	}
	var allOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(allResp.Data, &allOut); err != nil {
		intg036Failf(t, "decode list player mail battle tab", "player_id=%d err=%v", playerID, err)
	}
	mails := allOut.GetMails()
	if allOut.GetTotalCount() < 1 && len(mails) < 1 {
		t.Logf("INTG-036: skip ListPlayerMail battle-report tab (empty inbox; hint GM send-mail or march battle — see tools/smoke/README.md)")
		return
	}
	var typeCounts = map[int32]int{}
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(mails)
	for _, m := range mails {
		typeCounts[m.GetMailType()]++
	}
	typeHint := smokeINTG036MailTypeCountHint(typeCounts)
	var battleMail *contentv1.PlayerMail
	for _, m := range mails {
		if smokeINTG036MailLooksBattleReport(m) {
			battleMail = m
			break
		}
	}
	if battleMail == nil {
		t.Logf("INTG-036: ListPlayerMail player_id=%d mail_total=%d unclaimed_attachment=%d %s battle_report_mail_id=skip (hint march arrival mail — see tools/smoke/README.md)",
			playerID, allOut.GetTotalCount(), unclaimed, typeHint)
		return
	}
	t.Logf("INTG-036: ListPlayerMail player_id=%d mail_total=%d unclaimed_attachment=%d %s first_battle_report_mail_id=%d mail_type=%d",
		playerID, allOut.GetTotalCount(), unclaimed, typeHint, battleMail.GetMailId(), battleMail.GetMailType())
}

func smokeINTG036MailTypeCountHint(typeCounts map[int32]int) string {
	if len(typeCounts) == 0 {
		return "mail_type_counts=empty"
	}
	parts := make([]string, 0, len(typeCounts))
	for mt, n := range typeCounts {
		parts = append(parts, fmt.Sprintf("type_%d=%d", mt, n))
	}
	return "mail_type_counts=" + strings.Join(parts, ",")
}

func smokeINTG036MailLooksBattleReport(m *contentv1.PlayerMail) bool {
	if m == nil {
		return false
	}
	title := m.GetTitle()
	body := m.GetBody()
	if strings.Contains(title, "战报") {
		return true
	}
	lower := strings.ToLower(body)
	return strings.Contains(lower, "report_id") || strings.Contains(lower, "battle_report")
}

// smokeINTG036ListPlayerQuestsMilitaryInProgressGateway logs in-progress counts on military chain 300 and daily train quest on chain 400 (CLIENT-226 HUD military todo).
func smokeINTG036ListPlayerQuestsMilitaryInProgressGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeINTG036LogQuestChainInProgress(t, c, sid, playerID, smokeINTG036MilitaryQuestChainID, "military_chain")
	smokeINTG036LogDailyMilitaryTrainInProgress(t, c, sid, playerID)
}

func smokeINTG036LogQuestChainInProgress(t *testing.T, c *websocket.Conn, sid string, playerID int64, chainID int32, label string) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-036 HUD: gateway ListPlayerQuests chain_id=%d %s in_progress_count", chainID, label))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: fmt.Sprintf("i36-quest-%d", chainID), SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: chainID, IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg036Failf(t, "list player quests military", "chain_id=%d player_id=%d code=%d msg=%s", chainID, playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg036Failf(t, "decode list player quests military", "chain_id=%d player_id=%d err=%v", chainID, playerID, err)
	}
	quests := out.GetQuests()
	if len(quests) < 1 {
		t.Logf("INTG-036: skip ListPlayerQuests %s chain_id=%d (empty chain; hint accept quest — see tools/smoke/README.md)", label, chainID)
		return
	}
	var inProgress int
	for _, q := range quests {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_IN_PROGRESS {
			inProgress++
		}
	}
	if inProgress < 1 {
		t.Logf("INTG-036: skip ListPlayerQuests %s chain_id=%d in_progress=0 (hint quest progress hook — see tools/smoke/README.md)", label, chainID)
		return
	}
	t.Logf("INTG-036: ListPlayerQuests %s chain_id=%d in_progress_count=%d quest_rows=%d player_id=%d hud_military_todo_hint=client_derived",
		label, chainID, inProgress, len(quests), playerID)
}

func smokeINTG036LogDailyMilitaryTrainInProgress(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i36-daily-train", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg036Failf(t, "list daily military train quest", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg036Failf(t, "decode daily military train quest", "player_id=%d err=%v", playerID, err)
	}
	var dailyTrainInProgress int
	for _, q := range out.GetQuests() {
		if q.GetQuestCfgId() == smokeINTG036DailyMilitaryTrainQuestCfgID &&
			q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_IN_PROGRESS {
			dailyTrainInProgress++
		}
	}
	if dailyTrainInProgress < 1 {
		t.Logf("INTG-036: skip daily military train quest_cfg_id=%d in_progress (chain_id=%d; hint daily_train_1 — see tools/smoke/README.md)",
			smokeINTG036DailyMilitaryTrainQuestCfgID, smokeDailyQuestChainID)
		return
	}
	t.Logf("INTG-036: ListPlayerQuests daily_military_train quest_cfg_id=%d chain_id=%d in_progress_count=%d player_id=%d",
		smokeINTG036DailyMilitaryTrainQuestCfgID, smokeDailyQuestChainID, dailyTrainInProgress, playerID)
}

func intg036Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG036CfgHint, step, fmt.Sprintf(format, args...))
}
