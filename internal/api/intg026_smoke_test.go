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
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG026CfgHint = smokeINTG025CfgHint + "; INTG-026: ListMarches first march_id+to_x/to_y+arrive_at_ms+phase; ListBattleReports→GetBattleReport location_x/y; ListPlayerMail unread+unclaimed_attachment; ListPlayerCities count+first cell"

// intg026BeforeRestartHook runs wave-specific gateway assertions immediately before the INTG-026 process-restart segment.
type intg026BeforeRestartHook func(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64)

// TestINTG026Wave29SmokePath extends INTG-025 with march grid+ETA, battle report coordinates, mail badge counts, and world city grid summary.
func TestINTG026Wave29SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-026 wave:29 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG026SmokePath(t, nil)
}

func runINTG026Wave29Smoke(t *testing.T) {
	runINTG026SmokePath(t, nil)
}

func runINTG026SmokePath(t *testing.T, beforeRestart intg026BeforeRestartHook) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg026Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg026Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg026Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg026_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeINTG023ListPlayerBagGateway(t, c, sid, playerID)
	smokeINTG020ListShopShelfOfferPricesGateway(t, c, sid, playerID)
	smokeINTG018GetHeroDetailLevelLoyaltyGateway(t, c, sid, playerID)
	smokeINTG025ListPlayerHeroesFirstHeroGateway(t, c, sid, playerID)
	smokeINTG023GetHeroDetailFirstHeroGateway(t, c, sid, playerID)

	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG017ListMarchesGridGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	smokeINTG023ListMarchesPhaseArriveAtGateway(t, c, sid, cityID, marchID)
	smokeINTG024ListMarchesPhaseCountsGateway(t, c, sid, cityID, marchID)
	smokeINTG026ListMarchesFirstMarchGridETAGateway(t, c, sid, cityID, playerID)
	smokeINTG017ListBattleReportsTimeOutcomeGateway(t, c, sid, playerID)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
	smokeINTG024ListBattleReportsWinLoseGateway(t, c, sid, playerID)
	smokeINTG014GetBattleReportGateway(t, c, sid, playerID, reportID)
	smokeINTG018GetBattleReportRoundsGateway(t, c, sid, playerID, reportID)
	smokeINTG026ListBattleReportsGetBattleReportLocationGateway(t, c, sid, playerID)

	smokeINTG016ListPlayerMailPaginationGateway(t, c, sid, playerID)
	smokeINTG016GetCityStateBuildingsGateway(t, c, sid, playerID)
	smokeINTG020GetCityStateBuildingLevelGateway(t, c, sid, playerID)
	smokeINTG019GetCityStateResourcesProductionRatesGateway(t, c, sid, playerID)
	smokeINTG022ListPlayerCitiesXYNameGateway(t, c, sid, playerID)
	smokeINTG026ListPlayerCitiesCountFirstCellGateway(t, c, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG022GetCityStateInProgressBuildSlotsGateway(t, c, sid, playerID)
	smokeINTG025GetCityStateSevenSlotsProductionRatesGateway(t, c, sid, playerID)
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
	smokeINTG026ListPlayerMailUnreadUnclaimedGateway(t, c, sid, playerID)
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

	if beforeRestart != nil {
		beforeRestart(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
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

// smokeINTG026ListMarchesFirstMarchGridETAGateway logs first march destination, ETA, and phase (CLIENT-139/140/141).
func smokeINTG026ListMarchesFirstMarchGridETAGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		t.Logf("INTG-026: skip ListMarches first march (no city_id; hint StartMarch — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-026 MIL: gateway ListMarches first march_id+to_x/to_y+arrive_at_ms+phase city_id=%d", cityID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i26-march-grid", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg026Failf(t, "list marches grid eta", "player_id=%d code=%d msg=%s", playerID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg026Failf(t, "decode list marches grid eta", "player_id=%d err=%v", playerID, err)
	}
	marches := listOut.GetMarches()
	if len(marches) < 1 {
		t.Logf("INTG-026: skip ListMarches first march (empty list total=%d; hint StartMarch — see tools/smoke/README.md)", listOut.GetTotal())
		return
	}
	first := marches[0]
	toX, toY := first.GetToX(), first.GetToY()
	arriveAt := first.GetArriveAtMs()
	phase := first.GetPhase()
	t.Logf("INTG-026: ListMarches player_id=%d first_march_id=%d to_x=%d to_y=%d arrive_at_ms=%d phase=%s",
		playerID, first.GetMarchId(), toX, toY, arriveAt, phase.String())
	if !smokeValidWorldTileCoord(toX) || !smokeValidWorldTileCoord(toY) {
		intg026Failf(t, "list marches first row coords", "march_id=%d to_x=%d to_y=%d", first.GetMarchId(), toX, toY)
	}
	if phase == militaryv1.MarchPhase_MARCH_PHASE_UNSPECIFIED {
		intg026Failf(t, "list marches phase", "march_id=%d phase unspecified", first.GetMarchId())
	}
	if arriveAt <= 0 {
		intg026Failf(t, "list marches arrive_at_ms", "march_id=%d arrive_at_ms=%d want>0", first.GetMarchId(), arriveAt)
	}
}

// smokeINTG026ListBattleReportsGetBattleReportLocationGateway lists reports and logs GetBattleReport summary coordinates (CLIENT-142).
func smokeINTG026ListBattleReportsGetBattleReportLocationGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = 5
	smokeStep(t, fmt.Sprintf("INTG-026 MIL: gateway ListBattleReports→GetBattleReport location_x/y limit=%d", limit))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i26-br-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit}),
	})
	if listResp.Code != 0 {
		intg026Failf(t, "list battle reports location", "player_id=%d code=%d msg=%s", playerID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg026Failf(t, "decode list battle reports location", "player_id=%d err=%v", playerID, err)
	}
	reports := listOut.GetReports()
	if len(reports) < 1 {
		t.Logf("INTG-026: skip GetBattleReport location (no battle reports; hint march may not have resolved combat — see tools/smoke/README.md)")
		return
	}
	reportID := reports[0].GetReportId()
	if reportID == 0 {
		t.Logf("INTG-026: skip GetBattleReport location (first report_id=0; see tools/smoke/README.md)")
		return
	}
	getResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetBattleReport, TraceId: "i26-br-get", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.GetBattleReportRequest{ReportId: reportID}),
	})
	if getResp.Code != 0 {
		intg026Failf(t, "get battle report location", "report_id=%d player_id=%d code=%d msg=%s", reportID, playerID, getResp.Code, getResp.Msg)
	}
	var getOut militaryv1.GetBattleReportResponse
	if err := proto.Unmarshal(getResp.Data, &getOut); err != nil {
		intg026Failf(t, "decode battle report location", "report_id=%d err=%v", reportID, err)
	}
	view := getOut.GetReport()
	if view == nil || view.GetSummary() == nil {
		intg026Failf(t, "battle report summary", "report_id=%d missing report/summary", reportID)
	}
	summary := view.GetSummary()
	lx, ly := summary.GetLocationX(), summary.GetLocationY()
	if !smokeValidWorldTileCoord(lx) || !smokeValidWorldTileCoord(ly) {
		intg026Failf(t, "battle report location coords", "report_id=%d location_x=%d location_y=%d", reportID, lx, ly)
	}
	t.Logf("INTG-026: GetBattleReport report_id=%d location_x=%d location_y=%d (from ListBattleReports first row)",
		reportID, lx, ly)
}

// smokeINTG026ListPlayerMailUnreadUnclaimedGateway logs unread and unclaimed attachment counts (CLIENT-143).
func smokeINTG026ListPlayerMailUnreadUnclaimedGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-026 MAIL: gateway ListPlayerMail unread_count + unclaimed_attachment_count page_size=%d", pageSize))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i26-mail-badge", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if resp.Code != 0 {
		intg026Failf(t, "list player mail badge counts", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg026Failf(t, "decode list player mail badge counts", "player_id=%d err=%v", playerID, err)
	}
	mails := out.GetMails()
	unread := smokeINTG022CountUnreadMails(mails)
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(mails)
	t.Logf("INTG-026: ListPlayerMail player_id=%d total_count=%d unread_count=%d unclaimed_attachment_count=%d (page_derived)",
		playerID, out.GetTotalCount(), unread, unclaimed)
}

// smokeINTG026ListPlayerCitiesCountFirstCellGateway logs city count and first grid cell (CLIENT-140).
func smokeINTG026ListPlayerCitiesCountFirstCellGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-026 WORLD: gateway ListPlayerCities cities_count + first cell x/y")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerCities, TraceId: "i26-cities", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&worldv1.ListPlayerCitiesRequest{}),
	})
	if resp.Code != 0 {
		intg026Failf(t, "list player cities", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out worldv1.ListPlayerCitiesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg026Failf(t, "decode list player cities", "player_id=%d err=%v", playerID, err)
	}
	cities := out.GetCities()
	if len(cities) < 1 {
		intg026Failf(t, "list player cities", "player_id=%d empty cities", playerID)
	}
	first := cities[0]
	x, y := first.GetX(), first.GetY()
	if !smokeValidWorldTileCoord(x) || !smokeValidWorldTileCoord(y) {
		intg026Failf(t, "list player cities first cell", "city_id=%d x=%d y=%d", first.GetCityId(), x, y)
	}
	t.Logf("INTG-026: ListPlayerCities player_id=%d cities_count=%d first_city_id=%d x=%d y=%d",
		playerID, len(cities), first.GetCityId(), x, y)
}

func intg026Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG026CfgHint, step, fmt.Sprintf(format, args...))
}
