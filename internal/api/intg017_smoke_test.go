package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

const smokeINTG017CfgHint = smokeINTG016CfgHint + "; INTG-017: ListBattleReports created_at_ms+outcome; GetCityState production_rates; ListMarches to_x/to_y grid"

// TestINTG017Wave20SmokePath extends INTG-016 with battle report time/outcome fields, city production rates, and march destination grid.
func TestINTG017Wave20SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-017 wave:20 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG017Wave20Smoke(t)
}

func runINTG017Wave20Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg017Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg017Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg017Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg017_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeINTG016ListPlayerHeroesGetHeroDetailGateway(t, c, sid, playerID)

	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG017ListMarchesGridGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	smokeINTG017ListBattleReportsTimeOutcomeGateway(t, c, sid, playerID)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
	smokeINTG014GetBattleReportGateway(t, c, sid, playerID, reportID)

	smokeINTG016ListPlayerMailPaginationGateway(t, c, sid, playerID)
	smokeINTG016GetCityStateBuildingsGateway(t, c, sid, playerID)
	smokeINTG017GetCityStateProductionRatesGateway(t, c, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)

	smokeINTG010DualLeaderboardGateway(t, ctx, c, apiSrv, pool, sid, playerID)
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

// smokeINTG017ListMarchesGridGateway asserts ListMarches first row destination matches the StartMarch request (CLIENT-069 grid filter).
func smokeINTG017ListMarchesGridGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, marchID int64, wantToX int32, wantToY int32) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-017 MIL: gateway ListMarches grid to=(%d,%d) march_id=%d", wantToX, wantToY, marchID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i17-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg017Failf(t, "list marches grid", "march_id=%d code=%d msg=%s", marchID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg017Failf(t, "decode list marches grid", "err=%v", err)
	}
	if len(listOut.GetMarches()) < 1 {
		intg017Failf(t, "list marches grid", "march_id=%d empty list total=%d", marchID, listOut.GetTotal())
	}
	first := listOut.GetMarches()[0]
	if first.GetMarchId() != marchID {
		intg017Failf(t, "list marches grid", "first march_id=%d want=%d", first.GetMarchId(), marchID)
	}
	if first.GetToX() != wantToX || first.GetToY() != wantToY {
		intg017Failf(t, "list marches grid", "march_id=%d want to=(%d,%d) got=(%d,%d)", marchID, wantToX, wantToY, first.GetToX(), first.GetToY())
	}
	t.Logf("INTG-017: ListMarches ok march_id=%d to_x=%d to_y=%d", marchID, first.GetToX(), first.GetToY())
}

// smokeINTG017ListBattleReportsTimeOutcomeGateway probes first summary created_at_ms and outcome (limit≥1).
func smokeINTG017ListBattleReportsTimeOutcomeGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const limit = int32(1)
	smokeStep(t, fmt.Sprintf("INTG-017 MIL: gateway ListBattleReports limit=%d summary time+outcome", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i17-br-time", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit}),
	})
	if resp.Code != 0 {
		intg017Failf(t, "list battle reports time/outcome", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg017Failf(t, "decode battle reports time/outcome", "player_id=%d err=%v", playerID, err)
	}
	if out.GetTotal() < 1 || len(out.GetReports()) == 0 {
		t.Logf("INTG-017: skip battle report created_at_ms/outcome (no reports; march may still be in transit — see tools/smoke/README.md)")
		return
	}
	row := out.GetReports()[0]
	if row.GetCreatedAtMs() <= 0 {
		intg017Failf(t, "battle report created_at_ms", "report_id=%d created_at_ms=%d", row.GetReportId(), row.GetCreatedAtMs())
	}
	if row.GetOutcome() < 1 || row.GetOutcome() > 3 {
		intg017Failf(t, "battle report outcome", "report_id=%d outcome=%d", row.GetReportId(), row.GetOutcome())
	}
	t.Logf("INTG-017: ListBattleReports first report_id=%d created_at_ms=%d outcome=%d", row.GetReportId(), row.GetCreatedAtMs(), row.GetOutcome())
}

// smokeINTG017GetCityStateProductionRatesGateway logs production_rates food/wood/iron/stone per hour.
func smokeINTG017GetCityStateProductionRatesGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		intg017Failf(t, "get city state production_rates", "player_id=%d no player city", playerID)
	}
	smokeStep(t, fmt.Sprintf("INTG-017 DOM: gateway GetCityState city_id=%d production_rates", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	rates := st.GetProductionRates()
	if rates == nil {
		intg017Failf(t, "get city state production_rates", "city_id=%d missing production_rates field", cityID)
	}
	food, wood, iron, stone := rates.GetFood(), rates.GetWood(), rates.GetIron(), rates.GetStone()
	t.Logf("INTG-017: GetCityState production_rates city_id=%d food=%d/h wood=%d/h iron=%d/h stone=%d/h", cityID, food, wood, iron, stone)
	if food == 0 && wood == 0 && iron == 0 && stone == 0 {
		t.Logf("INTG-017: production_rates all zero (dev empty city or no producer buildings — see tools/smoke/README.md)")
	}
}

func intg017Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG017CfgHint, step, fmt.Sprintf(format, args...))
}
