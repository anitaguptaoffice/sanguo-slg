package api_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG028CfgHint = smokeINTG027CfgHint + "; INTG-028: ListMarches latest march_id+phase+to_x/to_y; RecruitTroop queue_id+finish_at_ms; ListBattleReports first+second report_id; ListPlayerMail unread+unclaimed; ListPlayerQuests chain400 claimable_count"

// TestINTG028Wave31SmokePath extends INTG-027 with march submit feedback, recruit queue, battle report adjacency ids, mail badges, and daily HUD claimable count for wave:31 CLIENT readouts.
func TestINTG028Wave31SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-028 wave:31 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG028Wave31Smoke(t)
}

func runINTG028Wave31Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG028Wave31BeforeRestartGateway)
}

func smokeINTG028Wave31BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG027Wave30BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG028ListMarchesLatestMarchGateway(t, c, sid, cityID, playerID)
	smokeINTG028RecruitTroopQueueGateway(t, c, sid, cityID, playerID)
	smokeINTG028ListBattleReportsFirstSecondGateway(t, c, sid, playerID)
	smokeINTG028ListPlayerMailUnreadUnclaimedGateway(t, c, sid, playerID)
	smokeINTG028ListPlayerQuestsChain400ClaimableGateway(t, c, sid, playerID)
}

// smokeINTG028ListMarchesLatestMarchGateway logs the newest march row by march_id after StartMarch (CLIENT-156).
func smokeINTG028ListMarchesLatestMarchGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		t.Logf("INTG-028: skip ListMarches latest march (no city_id; hint StartMarch — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-028 MIL: gateway ListMarches latest march_id+phase+to_x/to_y city_id=%d", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i28-march-latest", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 50}),
	})
	if listResp.Code != 0 {
		intg028Failf(t, "list marches latest", "city_id=%d code=%d msg=%s", cityID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg028Failf(t, "decode list marches latest", "city_id=%d err=%v", cityID, err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 || listOut.GetTotal() < 1 {
		t.Logf("INTG-028: skip ListMarches latest march (empty list total=%d; hint StartMarch — see tools/smoke/README.md)", listOut.GetTotal())
		return
	}
	var latest *militaryv1.MarchSummary
	for _, row := range marches {
		if latest == nil || row.GetMarchId() > latest.GetMarchId() {
			latest = row
		}
	}
	if latest == nil || latest.GetMarchId() == 0 {
		intg028Failf(t, "list marches latest", "city_id=%d missing march_id in list", cityID)
	}
	t.Logf("INTG-028: ListMarches latest march_id=%d phase=%s to_x=%d to_y=%d player_id=%d total=%d",
		latest.GetMarchId(), latest.GetPhase().String(), latest.GetToX(), latest.GetToY(), playerID, listOut.GetTotal())
}

// smokeINTG028RecruitTroopQueueGateway logs recruit queue_id and finish_at_ms after RecruitTroop (CLIENT-157).
func smokeINTG028RecruitTroopQueueGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		t.Logf("INTG-028: skip RecruitTroop queue (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-028 MIL: gateway RecruitTroop queue_id+finish_at_ms city_id=%d", cityID))
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitTroop, TraceId: "i28-recruit-queue", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 3,
		}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-028: skip RecruitTroop queue_id+finish_at_ms (code=%d msg=%s; hint wallet/troop queue — see tools/smoke/README.md)",
			recruitResp.Code, recruitResp.Msg)
		return
	}
	var out militaryv1.RecruitTroopResponse
	if err := proto.Unmarshal(recruitResp.Data, &out); err != nil {
		intg028Failf(t, "decode recruit troop queue", "player_id=%d err=%v", playerID, err)
	}
	queueID := out.GetQueueId()
	finishAt := out.GetFinishAtMs()
	if queueID == 0 && finishAt == 0 {
		t.Logf("INTG-028: skip RecruitTroop queue fields (queue_id=0 finish_at_ms=0; instant recruit or no queue — see tools/smoke/README.md)")
		return
	}
	t.Logf("INTG-028: RecruitTroop player_id=%d city_id=%d queue_id=%d finish_at_ms=%d",
		playerID, cityID, queueID, finishAt)
}

// smokeINTG028ListBattleReportsFirstSecondGateway logs report count and first/second report_id (CLIENT-158).
func smokeINTG028ListBattleReportsFirstSecondGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(10)
	smokeStep(t, fmt.Sprintf("INTG-028 MIL: gateway ListBattleReports count + first/second report_id limit=%d", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i28-br-adj", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: 0}),
	})
	if resp.Code != 0 {
		intg028Failf(t, "list battle reports adjacency", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg028Failf(t, "decode battle reports adjacency", "player_id=%d err=%v", playerID, err)
	}
	reports := out.GetReports()
	count := len(reports)
	total := out.GetTotal()
	if total < 1 || count < 1 {
		t.Logf("INTG-028: skip ListBattleReports first/second report_id (no reports; hint march arrival — see tools/smoke/README.md)")
		return
	}
	firstID := reports[0].GetReportId()
	var secondID int64
	if count >= 2 {
		secondID = reports[1].GetReportId()
		t.Logf("INTG-028: ListBattleReports player_id=%d total=%d page_count=%d first_report_id=%d second_report_id=%d",
			playerID, total, count, firstID, secondID)
		return
	}
	t.Logf("INTG-028: ListBattleReports player_id=%d total=%d page_count=%d first_report_id=%d (hint only: fewer than 2 reports for adjacency — see tools/smoke/README.md)",
		playerID, total, count, firstID)
}

// smokeINTG028ListPlayerMailUnreadUnclaimedGateway logs unread and unclaimed attachment counts (CLIENT-159/162).
func smokeINTG028ListPlayerMailUnreadUnclaimedGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-028 MAIL: gateway ListPlayerMail unread+unclaimed_attachment page_size=%d", pageSize))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i28-mail-badge", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if resp.Code != 0 {
		intg028Failf(t, "list player mail badge", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg028Failf(t, "decode list player mail badge", "player_id=%d err=%v", playerID, err)
	}
	if out.GetTotalCount() < 1 && len(out.GetMails()) < 1 {
		t.Logf("INTG-028: skip ListPlayerMail unread+unclaimed (empty inbox; hint GM send-mail — see tools/smoke/README.md)")
		return
	}
	mails := out.GetMails()
	unread := smokeINTG022CountUnreadMails(mails)
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(mails)
	t.Logf("INTG-028: ListPlayerMail player_id=%d total_count=%d unread_count=%d unclaimed_attachment_count=%d (page_derived)",
		playerID, out.GetTotalCount(), unread, unclaimed)
}

// smokeINTG028ListPlayerQuestsChain400ClaimableGateway logs claimable_count for daily HUD badge (CLIENT-162).
func smokeINTG028ListPlayerQuestsChain400ClaimableGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-028 QUEST: gateway ListPlayerQuests chain_id=%d claimable_count", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i28-quests-claimable", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          smokeDailyQuestChainID,
			IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg028Failf(t, "list player quests claimable", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg028Failf(t, "decode list player quests claimable", "player_id=%d err=%v", playerID, err)
	}
	quests := out.GetQuests()
	if len(quests) < 1 {
		t.Logf("INTG-028: skip ListPlayerQuests chain_id=%d claimable_count (empty chain; hint QUEST-002 seed — see tools/smoke/README.md)", smokeDailyQuestChainID)
		return
	}
	var claimable int32
	for _, q := range quests {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimable++
		}
	}
	t.Logf("INTG-028: ListPlayerQuests chain_id=%d claimable_count=%d quest_count=%d",
		smokeDailyQuestChainID, claimable, len(quests))
}

func intg028Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG028CfgHint, step, fmt.Sprintf(format, args...))
}
