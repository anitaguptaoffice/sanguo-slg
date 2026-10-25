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
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

const smokeINTG022CfgHint = smokeINTG021CfgHint + "; INTG-022: GetCityState in-progress build slot_key+upgrade_finish_at_ms; ListPlayerMail total+unread; ListPlayerQuests chain400 claimable/progress; ListPlayerCities x/y/name"

// TestINTG022Wave25SmokePath extends INTG-021 with build queue fields, mail unread count, daily claimable/progress todo, and city name on the world grid.
func TestINTG022Wave25SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-022 wave:25 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG022Wave25Smoke(t)
}

func runINTG022Wave25Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg022Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg022Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg022Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg022_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeINTG020ListShopShelfOfferPricesGateway(t, c, sid, playerID)
	smokeINTG018GetHeroDetailLevelLoyaltyGateway(t, c, sid, playerID)

	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG017ListMarchesGridGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	smokeINTG019ListMarchesPhaseGateway(t, c, sid, cityID, marchID)
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
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG021ListGuildMembersRoleGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG021RecruitHeroOptional(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG012MailMarkReadGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG020ListPlayerMailUnclaimedAttachmentGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG022ListPlayerMailUnreadCountGateway(t, c, sid, playerID)
	mailGranted := smokeINTG013MailClaimAttachmentsGateway(t, ctx, c, pool, apiSrv, sid, playerID)
	smokeINTG014RecruitTroopListMarchesOptional(t, c, sid, cityID, marchID)

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

// smokeINTG022GetCityStateInProgressBuildSlotsGateway logs each building slot_key with upgrade_finish_at_ms (0 = idle).
func smokeINTG022GetCityStateInProgressBuildSlotsGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		intg022Failf(t, "get city state build queue", "player_id=%d no player city", playerID)
	}
	smokeStep(t, fmt.Sprintf("INTG-022 DOM: gateway GetCityState city_id=%d in-progress build slots", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	buildings := st.GetBuildings()
	if len(buildings) == 0 {
		intg022Failf(t, "get city state build queue", "city_id=%d empty buildings", cityID)
	}
	inProgress := 0
	for _, b := range buildings {
		finishMS := b.GetUpgradeFinishAtMs()
		t.Logf("INTG-022: GetCityState build slot_key=%s upgrade_finish_at_ms=%d (0=idle)",
			b.GetSlotKey(), finishMS)
		if finishMS > 0 {
			inProgress++
		}
	}
	if inProgress < 1 {
		t.Logf("INTG-022: GetCityState city_id=%d no active upgrade queue (all slots idle, upgrade_finish_at_ms zero); hint after INTG-011 speedup may have completed", cityID)
	}
}

// smokeINTG022ListPlayerMailUnreadCountGateway logs total_count and unread count (unread filter total_count + ALL-page derivation).
func smokeINTG022ListPlayerMailUnreadCountGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-022 MAIL: gateway ListPlayerMail total_count + unread_count page_size=%d", pageSize))
	allResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i22-mail-all", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if allResp.Code != 0 {
		intg022Failf(t, "list player mail all", "player_id=%d code=%d msg=%s", playerID, allResp.Code, allResp.Msg)
	}
	var allOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(allResp.Data, &allOut); err != nil {
		intg022Failf(t, "decode list player mail all", "player_id=%d err=%v", playerID, err)
	}
	derivedUnread := smokeINTG022CountUnreadMails(allOut.GetMails())

	unreadResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i22-mail-unread", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_UNREAD,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if unreadResp.Code != 0 {
		intg022Failf(t, "list player mail unread", "player_id=%d code=%d msg=%s", playerID, unreadResp.Code, unreadResp.Msg)
	}
	var unreadOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(unreadResp.Data, &unreadOut); err != nil {
		intg022Failf(t, "decode list player mail unread", "player_id=%d err=%v", playerID, err)
	}
	filterUnread := unreadOut.GetTotalCount()
	t.Logf("INTG-022: ListPlayerMail player_id=%d total_count=%d unread_count=%d (unread_filter_total=%d page_unread_derived=%d)",
		playerID, allOut.GetTotalCount(), filterUnread, filterUnread, derivedUnread)
	if allOut.GetTotalCount() < 1 {
		intg022Failf(t, "list player mail unread", "player_id=%d total_count=0 want>=1", playerID)
	}
	if filterUnread < 1 {
		intg022Failf(t, "list player mail unread", "player_id=%d unread_count=0 want>=1 (read-filter equivalent)", playerID)
	}
}

func smokeINTG022CountUnreadMails(mails []*contentv1.PlayerMail) int32 {
	n := int32(0)
	for _, m := range mails {
		if smokeINTG022MailIsUnread(m) {
			n++
		}
	}
	return n
}

func smokeINTG022MailIsUnread(m *contentv1.PlayerMail) bool {
	if m == nil {
		return false
	}
	if m.GetReadAtMs() > 0 {
		return false
	}
	if m.GetStatus() == int32(mail.StatusRead) || m.GetStatus() == int32(mail.StatusClaimed) {
		return false
	}
	return true
}

// smokeINTG022ListPlayerQuestsChain400TodoGateway retains INTG-018 progress checks and logs claimable + progress-complete counts.
func smokeINTG022ListPlayerQuestsChain400TodoGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-022 QUEST: gateway ListPlayerQuests chain_id=%d claimable/todo", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i22-quests", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          smokeDailyQuestChainID,
			IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg022Failf(t, "list player quests chain 400", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg022Failf(t, "decode list player quests", "player_id=%d err=%v", playerID, err)
	}
	quests := out.GetQuests()
	if len(quests) < 1 {
		intg022Failf(t, "list player quests chain 400", "player_id=%d empty quests", playerID)
	}
	first := quests[0]
	cur, tgt := first.GetProgressCurrent(), first.GetProgressTarget()
	if tgt < 1 {
		intg022Failf(t, "list player quests progress", "quest_cfg_id=%d progress_target=%d", first.GetQuestCfgId(), tgt)
	}
	if !smokeQuestProgressConsistent(cur, tgt, first.GetState()) {
		intg022Failf(t, "list player quests progress", "quest_cfg_id=%d progress_current=%d progress_target=%d", first.GetQuestCfgId(), cur, tgt)
	}
	var claimable, progressComplete int32
	for _, q := range quests {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimable++
		}
		pt := q.GetProgressTarget()
		if pt > 0 && q.GetProgressCurrent() >= pt {
			progressComplete++
		}
	}
	todo := claimable
	if todo < 1 {
		todo = progressComplete
	}
	t.Logf("INTG-022: ListPlayerQuests chain_id=%d count=%d claimable_count=%d progress_complete_count=%d todo_count=%d first_quest_cfg_id=%d progress_current=%d progress_target=%d",
		smokeDailyQuestChainID, len(quests), claimable, progressComplete, todo, first.GetQuestCfgId(), cur, tgt)
}

// smokeINTG022ListPlayerCitiesXYNameGateway logs first city x/y/name (INTG-018 grid checks retained).
func smokeINTG022ListPlayerCitiesXYNameGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-022 WORLD: gateway ListPlayerCities x/y/name")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerCities, TraceId: "i22-cities", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&worldv1.ListPlayerCitiesRequest{}),
	})
	if resp.Code != 0 {
		intg022Failf(t, "list player cities", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out worldv1.ListPlayerCitiesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg022Failf(t, "decode list player cities", "player_id=%d err=%v", playerID, err)
	}
	cities := out.GetCities()
	if len(cities) < 1 {
		intg022Failf(t, "list player cities", "player_id=%d empty cities", playerID)
	}
	first := cities[0]
	x, y := first.GetX(), first.GetY()
	name := first.GetName()
	if !smokeValidWorldTileCoord(x) || !smokeValidWorldTileCoord(y) {
		intg022Failf(t, "list player cities coords", "city_id=%d x=%d y=%d", first.GetCityId(), x, y)
	}
	if name == "" {
		intg022Failf(t, "list player cities name", "city_id=%d empty name", first.GetCityId())
	}
	t.Logf("INTG-022: ListPlayerCities player_id=%d cities_count=%d first_city_id=%d x=%d y=%d name=%q",
		playerID, len(cities), first.GetCityId(), x, y, name)
}

func intg022Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG022CfgHint, step, fmt.Sprintf(format, args...))
}

// The protocol exposes a raw count, not a capped percentage. Production stores
// overshoot and transitions at >= target; completed/claimable 60/50 is valid.
func smokeQuestProgressConsistent(current, target int32, state questv1.PlayerQuestState) bool {
	if target < 1 || current < 0 {
		return false
	}
	switch state {
	case questv1.PlayerQuestState_PLAYER_QUEST_STATE_IN_PROGRESS:
		return current < target
	case questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE, questv1.PlayerQuestState_PLAYER_QUEST_STATE_COMPLETED:
		return current >= target
	default:
		return true
	}
}

func TestSmokeQuestProgressPreservesOvershoot(t *testing.T) {
	ctx := context.Background()
	svc := quest.NewService(quest.NewMemStore(), quest.NewMemCatalog([]quest.QuestCfg{{
		QuestCfgID: 1014, Code: "daily_train_1", QuestType: quest.QuestTypeDaily,
		ChainID: quest.DailyChainID, Repeatable: true, UnlockLevel: 1,
		Objectives: []quest.Objective{{Type: "train_troops", UnitCode: "any", Count: 50}},
	}}), nil, nil)
	actor := quest.Actor{ServerID: 1, PlayerID: 1}
	if _, _, err := svc.AcceptQuest(ctx, actor, 1014); err != nil {
		t.Fatal(err)
	}
	for _, want := range []int32{20, 40, 60} {
		view, _, err := svc.ReportQuestProgress(ctx, actor, 1014, false, 20)
		if err != nil {
			t.Fatal(err)
		}
		if view.ProgressCurrent != want || view.ProgressTarget != 50 {
			t.Fatalf("raw progress got=%d/%d want=%d/50", view.ProgressCurrent, view.ProgressTarget, want)
		}
		if !smokeQuestProgressConsistent(view.ProgressCurrent, view.ProgressTarget, questv1.PlayerQuestState(view.State)) {
			t.Fatalf("valid raw progress rejected: %+v", view)
		}
		if want == 60 && view.State != quest.PlayerQuestStateClaimable {
			t.Fatalf("overshoot must be claimable: %+v", view)
		}
	}
	for _, tc := range []struct {
		current, target int32
		state           questv1.PlayerQuestState
	}{
		{-1, 50, questv1.PlayerQuestState_PLAYER_QUEST_STATE_IN_PROGRESS},
		{0, 0, questv1.PlayerQuestState_PLAYER_QUEST_STATE_IN_PROGRESS},
		{60, 50, questv1.PlayerQuestState_PLAYER_QUEST_STATE_IN_PROGRESS},
		{40, 50, questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE},
		{40, 50, questv1.PlayerQuestState_PLAYER_QUEST_STATE_COMPLETED},
	} {
		if smokeQuestProgressConsistent(tc.current, tc.target, tc.state) {
			t.Fatalf("invalid progress accepted: %+v", tc)
		}
	}
}
