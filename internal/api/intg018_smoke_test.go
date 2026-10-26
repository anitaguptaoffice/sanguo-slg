package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

const smokeINTG018CfgHint = smokeINTG017CfgHint + "; INTG-018: GetHeroDetail level+loyalty; GetBattleReport rounds; ListPlayerQuests chain400 progress; ListPlayerCities x/y"

// TestINTG018Wave21SmokePath extends INTG-017 with hero level/loyalty, battle report round index, daily quest progress, and player city grid.
func TestINTG018Wave21SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-018 wave:21 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG018Wave21Smoke(t)
}

func runINTG018Wave21Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg018Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg018Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg018Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg018_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeINTG018GetHeroDetailLevelLoyaltyGateway(t, c, sid, playerID)

	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG017ListMarchesGridGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	smokeINTG017ListBattleReportsTimeOutcomeGateway(t, c, sid, playerID)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
	smokeINTG014GetBattleReportGateway(t, c, sid, playerID, reportID)
	smokeINTG018GetBattleReportRoundsGateway(t, c, sid, playerID, reportID)

	smokeINTG016ListPlayerMailPaginationGateway(t, c, sid, playerID)
	smokeINTG016GetCityStateBuildingsGateway(t, c, sid, playerID)
	smokeINTG017GetCityStateProductionRatesGateway(t, c, sid, playerID)
	smokeINTG018ListPlayerCitiesGateway(t, c, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	ext.Base.Bag2003 += smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG018ListPlayerQuestsChain400Gateway(t, c, sid, playerID)

	ext.Base.Gold = smokeINTG010DualLeaderboardGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG012MailMarkReadGateway(t, ctx, c, pool, sid, playerID)
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

// smokeINTG018GetHeroDetailLevelLoyaltyGateway lists heroes and asserts GetHeroDetail level, loyalty, and four attributes.
func smokeINTG018GetHeroDetailLevelLoyaltyGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-018 HERO: gateway ListPlayerHeroes")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i18-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		intg018Failf(t, "list player heroes", "player_id=%d code=%d msg=%s", playerID, listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg018Failf(t, "decode hero list", "player_id=%d err=%v", playerID, err)
	}
	if len(listOut.GetHeroes()) == 0 {
		intg018Failf(t, "list player heroes", "player_id=%d empty heroes total_count=%d", playerID, listOut.GetTotalCount())
	}
	heroID := listOut.GetHeroes()[0].GetHeroId()
	if heroID == 0 {
		intg018Failf(t, "list player heroes", "player_id=%d first row missing hero_id", playerID)
	}

	smokeStep(t, fmt.Sprintf("INTG-018 HERO: gateway GetHeroDetail hero_id=%d level+loyalty", heroID))
	detailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetHeroDetail, TraceId: "i18-hero-detail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.GetHeroDetailRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if detailResp.Code != 0 {
		intg018Failf(t, "get hero detail", "hero_id=%d code=%d msg=%s", heroID, detailResp.Code, detailResp.Msg)
	}
	var detailOut herov1.GetHeroDetailResponse
	if err := proto.Unmarshal(detailResp.Data, &detailOut); err != nil {
		intg018Failf(t, "decode hero detail", "hero_id=%d err=%v", heroID, err)
	}
	if detailOut.GetHeroId() != heroID {
		intg018Failf(t, "get hero detail", "hero_id=%d response hero_id=%d", heroID, detailOut.GetHeroId())
	}
	if detailOut.GetTemplateCfgId() == 0 {
		intg018Failf(t, "get hero detail", "hero_id=%d missing template_cfg_id", heroID)
	}
	level := detailOut.GetLevel()
	if level < 1 {
		intg018Failf(t, "get hero detail level", "hero_id=%d level=%d", heroID, level)
	}
	loyalty := detailOut.GetLoyalty()
	loyMin, loyMax := detailOut.GetLoyaltyMin(), detailOut.GetLoyaltyMax()
	if loyMax > loyMin && (loyalty < loyMin || loyalty > loyMax) {
		intg018Failf(t, "get hero detail loyalty", "hero_id=%d loyalty=%d range=[%d,%d]", heroID, loyalty, loyMin, loyMax)
	}
	attrs := detailOut.GetAttributes()
	if attrs == nil {
		intg018Failf(t, "get hero detail", "hero_id=%d missing attributes", heroID)
	}
	t.Logf("INTG-018: GetHeroDetail ok hero_id=%d template_cfg_id=%d level=%d loyalty=%d force=%d intel=%d politics=%d command=%d",
		heroID, detailOut.GetTemplateCfgId(), level, loyalty, attrs.GetForce(), attrs.GetIntel(), attrs.GetPolitics(), attrs.GetCommand())
}

// smokeINTG018GetBattleReportRoundsGateway logs rounds count and first round index when a report exists.
func smokeINTG018GetBattleReportRoundsGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64, reportID int64) {
	t.Helper()
	if reportID == 0 {
		t.Logf("INTG-018: skip GetBattleReport rounds (no report_id; march may still be in transit — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-018 MIL: gateway GetBattleReport report_id=%d rounds probe", reportID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetBattleReport, TraceId: "i18-br-rounds", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.GetBattleReportRequest{ReportId: reportID}),
	})
	if resp.Code != 0 {
		intg018Failf(t, "get battle report rounds", "report_id=%d player_id=%d code=%d msg=%s", reportID, playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.GetBattleReportResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg018Failf(t, "decode battle report rounds", "report_id=%d err=%v", reportID, err)
	}
	view := out.GetReport()
	if view == nil || view.GetDetail() == nil {
		intg018Failf(t, "battle report detail", "report_id=%d missing report or detail", reportID)
	}
	rounds := view.GetDetail().GetRounds()
	if len(rounds) < 1 {
		intg018Failf(t, "battle report rounds", "report_id=%d detail.rounds empty", reportID)
	}
	firstRound := rounds[0].GetRound()
	if firstRound < 1 {
		intg018Failf(t, "battle report first round", "report_id=%d first_round=%d", reportID, firstRound)
	}
	t.Logf("INTG-018: GetBattleReport rounds report_id=%d rounds_count=%d first_round=%d", reportID, len(rounds), firstRound)
}

// smokeINTG018ListPlayerQuestsChain400Gateway lists daily chain quests and logs first row progress_current/target.
func smokeINTG018ListPlayerQuestsChain400Gateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-018 QUEST: gateway ListPlayerQuests chain_id=%d progress", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i18-quests", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID}),
	})
	if resp.Code != 0 {
		intg018Failf(t, "list player quests chain 400", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg018Failf(t, "decode list player quests", "player_id=%d err=%v", playerID, err)
	}
	quests := out.GetQuests()
	if len(quests) < 1 {
		intg018Failf(t, "list player quests chain 400", "player_id=%d empty quests", playerID)
	}
	first := quests[0]
	cur, tgt := first.GetProgressCurrent(), first.GetProgressTarget()
	if tgt < 1 {
		intg018Failf(t, "list player quests progress", "quest_cfg_id=%d progress_target=%d", first.GetQuestCfgId(), tgt)
	}
	if cur < 0 || cur > tgt {
		intg018Failf(t, "list player quests progress", "quest_cfg_id=%d progress_current=%d progress_target=%d", first.GetQuestCfgId(), cur, tgt)
	}
	t.Logf("INTG-018: ListPlayerQuests chain_id=%d count=%d first_quest_cfg_id=%d progress_current=%d progress_target=%d",
		smokeDailyQuestChainID, len(quests), first.GetQuestCfgId(), cur, tgt)
}

// smokeINTG018ListPlayerCitiesGateway logs city count and first city grid coordinates.
func smokeINTG018ListPlayerCitiesGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-018 WORLD: gateway ListPlayerCities grid")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerCities, TraceId: "i18-cities", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&worldv1.ListPlayerCitiesRequest{}),
	})
	if resp.Code != 0 {
		intg018Failf(t, "list player cities", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out worldv1.ListPlayerCitiesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg018Failf(t, "decode list player cities", "player_id=%d err=%v", playerID, err)
	}
	cities := out.GetCities()
	if len(cities) < 1 {
		intg018Failf(t, "list player cities", "player_id=%d empty cities", playerID)
	}
	first := cities[0]
	x, y := first.GetX(), first.GetY()
	if !smokeValidWorldTileCoord(x) || !smokeValidWorldTileCoord(y) {
		intg018Failf(t, "list player cities coords", "city_id=%d x=%d y=%d", first.GetCityId(), x, y)
	}
	t.Logf("INTG-018: ListPlayerCities player_id=%d cities_count=%d first_city_id=%d x=%d y=%d",
		playerID, len(cities), first.GetCityId(), x, y)
}

func intg018Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG018CfgHint, step, fmt.Sprintf(format, args...))
}
