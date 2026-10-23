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

const smokeINTG014CfgHint = smokeINTG013CfgHint + "; INTG-014: ListMarches to_x/to_y; GetBattleReport summary location_x/location_y"

// TestINTG014Wave17SmokePath extends INTG-013 with march destination and battle report coordinate field probes.
func TestINTG014Wave17SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-014 wave:17 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG014Wave17Smoke(t)
}

func runINTG014Wave17Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg014Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg014Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg014Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg014_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	marchID, cityID, wantToX, wantToY, _, _ := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG014ListMarchesDestinationGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	reportID := smokeINTG012ListBattleReportsGateway(t, c, sid, playerID)
	smokeINTG014GetBattleReportGateway(t, c, sid, playerID, reportID)

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

// smokeINTG014ListMarchesDestinationGateway re-lists marches and asserts the first row exposes valid destination coords.
func smokeINTG014ListMarchesDestinationGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, marchID int64, wantToX int32, wantToY int32) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-014 MIL: gateway ListMarches destination to=(%d,%d) march_id=%d", wantToX, wantToY, marchID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i14-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg014Failf(t, "list marches destination", "march_id=%d code=%d msg=%s", marchID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg014Failf(t, "decode list marches destination", "err=%v", err)
	}
	if len(listOut.GetMarches()) < 1 {
		intg014Failf(t, "list marches destination", "march_id=%d empty list total=%d", marchID, listOut.GetTotal())
	}
	first := listOut.GetMarches()[0]
	if !smokeValidWorldTileCoord(first.GetToX()) || !smokeValidWorldTileCoord(first.GetToY()) {
		intg014Failf(t, "list marches first row coords", "march_id=%d to_x=%d to_y=%d", first.GetMarchId(), first.GetToX(), first.GetToY())
	}
	t.Logf("INTG-014: ListMarches first march_id=%d to_x=%d to_y=%d (want march_id=%d to=(%d,%d))", first.GetMarchId(), first.GetToX(), first.GetToY(), marchID, wantToX, wantToY)
	if first.GetMarchId() == marchID {
		if first.GetToX() != wantToX || first.GetToY() != wantToY {
			intg014Failf(t, "list marches destination", "march_id=%d want=(%d,%d) got=(%d,%d)", marchID, wantToX, wantToY, first.GetToX(), first.GetToY())
		}
	}
}

// smokeINTG014GetBattleReportGateway loads report detail (rounds) and summary battlefield/defender coordinate fields when a report exists.
func smokeINTG014GetBattleReportGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64, reportID int64) {
	t.Helper()
	if reportID == 0 {
		t.Logf("INTG-014: skip GetBattleReport coordinate fields (no report_id; same hint as INTG-012/013 empty ListBattleReports — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-014 MIL: gateway GetBattleReport report_id=%d (summary coords)", reportID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetBattleReport, TraceId: "i14-br-get", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.GetBattleReportRequest{ReportId: reportID}),
	})
	if resp.Code != 0 {
		intg014Failf(t, "get battle report", "report_id=%d player_id=%d code=%d msg=%s", reportID, playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.GetBattleReportResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg014Failf(t, "decode battle report", "report_id=%d err=%v", reportID, err)
	}
	view := out.GetReport()
	if view == nil {
		intg014Failf(t, "battle report view", "report_id=%d missing report", reportID)
	}
	summary := view.GetSummary()
	if summary == nil {
		intg014Failf(t, "battle report summary", "report_id=%d missing summary", reportID)
	}
	lx, ly := summary.GetLocationX(), summary.GetLocationY()
	if !smokeValidWorldTileCoord(lx) || !smokeValidWorldTileCoord(ly) {
		intg014Failf(t, "battle report location coords", "report_id=%d location_x=%d location_y=%d", reportID, lx, ly)
	}
	detail := view.GetDetail()
	if detail == nil {
		intg014Failf(t, "battle report detail", "report_id=%d missing detail", reportID)
	}
	rounds := detail.GetRounds()
	if rounds == nil || len(rounds) < 1 {
		intg014Failf(t, "battle report detail", "report_id=%d detail.rounds empty", reportID)
	}
	t.Logf("INTG-014: GetBattleReport ok report_id=%d location_x=%d location_y=%d defender_player_id=%d defender_city_id=%d rounds=%d result=%q",
		reportID, lx, ly, summary.GetDefenderPlayerId(), summary.GetDefenderCityId(), len(rounds), detail.GetResult())
}

// smokeINTG014RecruitTroopListMarchesOptional recruits once and checks ListMarches is unchanged; failures never block the main path.
func smokeINTG014RecruitTroopListMarchesOptional(t *testing.T, c *websocket.Conn, sid string, cityID int64, marchID int64) {
	t.Helper()
	if cityID == 0 {
		t.Log("INTG-014 optional: RecruitTroop skipped (no march city_id)")
		return
	}
	smokeStep(t, "INTG-014 optional: RecruitTroop then ListMarches (non-blocking)")
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitTroop, TraceId: "i14-recruit", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5,
		}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-014 optional: RecruitTroop code=%d msg=%s (non-blocking)", recruitResp.Code, recruitResp.Msg)
		return
	}
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i14-list-opt", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-014 optional: ListMarches after recruit code=%d msg=%s (non-blocking)", listResp.Code, listResp.Msg)
		return
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Logf("INTG-014 optional: decode ListMarches err=%v (non-blocking)", err)
		return
	}
	for _, row := range listOut.GetMarches() {
		if row.GetMarchId() != marchID {
			t.Logf("INTG-014 optional: ListMarches unexpected march_id=%d (expected only %d or empty); total=%d (non-blocking)",
				row.GetMarchId(), marchID, listOut.GetTotal())
			return
		}
	}
	t.Logf("INTG-014 optional: ListMarches after RecruitTroop ok total=%d march_id=%d only", listOut.GetTotal(), marchID)
}

func intg014Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG014CfgHint, step, fmt.Sprintf(format, args...))
}
