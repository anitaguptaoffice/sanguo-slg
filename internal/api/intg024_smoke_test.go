package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

const smokeINTG024CfgHint = smokeINTG023CfgHint + "; INTG-024: ListPlayerMail unread+unclaimed_attachment; ListPlayerQuests chain400 claimable_count; ListMarches phase_counts; ListBattleReports win/lose counts"

// TestINTG024Wave27SmokePath extends INTG-023 with mail badge counts, daily claimable, march phase summary, and battle report win/lose summary.
func TestINTG024Wave27SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-024 wave:27 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG024Wave27Smoke(t)
}

func runINTG024Wave27Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg024Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg024Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg024Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg024_%d", time.Now().UnixNano())
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
	smokeINTG024ListMarchesPhaseCountsGateway(t, c, sid, cityID, marchID)
	smokeINTG017ListBattleReportsTimeOutcomeGateway(t, c, sid, playerID)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
	smokeINTG024ListBattleReportsWinLoseGateway(t, c, sid, playerID)
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
	smokeINTG024ListPlayerQuestsChain400ClaimableGateway(t, c, sid, playerID)

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
	smokeINTG024ListPlayerMailUnreadUnclaimedGateway(t, c, sid, playerID)
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

// smokeINTG024ListPlayerMailUnreadUnclaimedGateway logs unread_count and unclaimed_attachment_count on one ALL inbox page (CLIENT-122).
func smokeINTG024ListPlayerMailUnreadUnclaimedGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-024 MAIL: gateway ListPlayerMail unread_count + unclaimed_attachment_count page_size=%d", pageSize))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i24-mail-badge", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if resp.Code != 0 {
		intg024Failf(t, "list player mail badge counts", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg024Failf(t, "decode list player mail badge counts", "player_id=%d err=%v", playerID, err)
	}
	mails := out.GetMails()
	unread := smokeINTG022CountUnreadMails(mails)
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(mails)
	t.Logf("INTG-024: ListPlayerMail player_id=%d total_count=%d unread_count=%d unclaimed_attachment_count=%d (page_derived)",
		playerID, out.GetTotalCount(), unread, unclaimed)
	if out.GetTotalCount() < 1 {
		intg024Failf(t, "list player mail badge counts", "player_id=%d total_count=0 want>=1", playerID)
	}
	if unread < 1 {
		intg024Failf(t, "list player mail unread", "player_id=%d unread_count=0 want>=1 (INTG-022 equivalent)", playerID)
	}
	if unclaimed < 1 {
		intg024Failf(t, "list player mail unclaimed", "player_id=%d unclaimed_attachment_count=0 want>=1 (INTG-020 seed)", playerID)
	}
}

// smokeINTG024ListPlayerQuestsChain400ClaimableGateway logs claimable_count for daily chain (CLIENT-123).
func smokeINTG024ListPlayerQuestsChain400ClaimableGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-024 QUEST: gateway ListPlayerQuests chain_id=%d claimable_count", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i24-quests-claimable", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          smokeDailyQuestChainID,
			IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg024Failf(t, "list player quests claimable", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg024Failf(t, "decode list player quests claimable", "player_id=%d err=%v", playerID, err)
	}
	var claimable int32
	for _, q := range out.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimable++
		}
	}
	t.Logf("INTG-024: ListPlayerQuests chain_id=%d quest_count=%d claimable_count=%d",
		smokeDailyQuestChainID, len(out.GetQuests()), claimable)
	if len(out.GetQuests()) < 1 {
		intg024Failf(t, "list player quests claimable", "player_id=%d empty quests", playerID)
	}
}

// smokeINTG024ListMarchesPhaseCountsGateway logs per-phase counts or first march phase (CLIENT-124).
func smokeINTG024ListMarchesPhaseCountsGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, marchID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-024 MIL: gateway ListMarches phase_counts city_id=%d", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i24-march-phases", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg024Failf(t, "list marches phase counts", "march_id=%d code=%d msg=%s", marchID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg024Failf(t, "decode list marches phase counts", "err=%v", err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 {
		intg024Failf(t, "list marches phase counts", "march_id=%d empty list total=%d", marchID, listOut.GetTotal())
	}
	phaseCounts := make(map[int32]int32)
	for _, row := range marches {
		phaseCounts[int32(row.GetPhase())]++
	}
	var keys []int32
	for k := range phaseCounts {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%d", militaryv1.MarchPhase(k).String(), phaseCounts[k]))
	}
	first := marches[0]
	t.Logf("INTG-024: ListMarches city_id=%d total=%d phase_counts=[%s] first_march_id=%d first_phase=%s",
		cityID, listOut.GetTotal(), strings.Join(parts, " "), first.GetMarchId(), first.GetPhase().String())
	if first.GetMarchId() != marchID {
		intg024Failf(t, "list marches phase counts", "first march_id=%d want=%d", first.GetMarchId(), marchID)
	}
}

// smokeINTG024ListBattleReportsWinLoseGateway logs win/lose counts from ListBattleReports (outcome 1=胜 2=负; CLIENT-125).
func smokeINTG024ListBattleReportsWinLoseGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(50)
	smokeStep(t, fmt.Sprintf("INTG-024 MIL: gateway ListBattleReports limit=%d win/lose summary", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i24-br-outcome", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit}),
	})
	if resp.Code != 0 {
		intg024Failf(t, "list battle reports win/lose", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg024Failf(t, "decode battle reports win/lose", "player_id=%d err=%v", playerID, err)
	}
	if out.GetTotal() < 1 || len(out.GetReports()) == 0 {
		t.Logf("INTG-024: skip battle report win/lose counts (no reports; march may still be in transit — see tools/smoke/README.md)")
		return
	}
	var win, lose, draw int32
	for _, row := range out.GetReports() {
		switch row.GetOutcome() {
		case 1:
			win++
		case 2:
			lose++
		case 3:
			draw++
		}
	}
	t.Logf("INTG-024: ListBattleReports player_id=%d total=%d page_count=%d win_count=%d lose_count=%d draw_count=%d",
		playerID, out.GetTotal(), len(out.GetReports()), win, lose, draw)
}

func intg024Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG024CfgHint, step, fmt.Sprintf(format, args...))
}
