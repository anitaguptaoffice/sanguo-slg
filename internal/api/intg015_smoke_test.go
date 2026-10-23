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

const smokeINTG015CfgHint = smokeINTG014CfgHint + "; INTG-015: StartMarch depart_at_ms/arrive_at_ms; ListBattleReports limit=5 offset pagination"

// TestINTG015Wave18SmokePath extends INTG-014 with march ETA timestamps and battle report list pagination.
func TestINTG015Wave18SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-015 wave:18 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG015Wave18Smoke(t)
}

func runINTG015Wave18Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg015Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg015Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg015Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg015_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG014ListMarchesDestinationGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
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

// smokeINTG015StartMarchTimestampsGateway asserts StartMarch march exposes ETA timestamps.
func smokeINTG015StartMarchTimestampsGateway(t *testing.T, marchID int64, departAtMs int64, arriveAtMs int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-015 MIL: StartMarch march_id=%d depart_at_ms/arrive_at_ms", marchID))
	if departAtMs <= 0 {
		intg015Failf(t, "start march timestamps", "march_id=%d missing depart_at_ms", marchID)
	}
	if arriveAtMs <= 0 {
		intg015Failf(t, "start march timestamps", "march_id=%d missing arrive_at_ms", marchID)
	}
	if arriveAtMs <= departAtMs {
		intg015Failf(t, "start march timestamps", "march_id=%d depart_at_ms=%d arrive_at_ms=%d (want arrive > depart)", marchID, departAtMs, arriveAtMs)
	}
	t.Logf("INTG-015: StartMarch ok march_id=%d depart_at_ms=%d arrive_at_ms=%d", marchID, departAtMs, arriveAtMs)
}

// smokeINTG015ListBattleReportsPaginationGateway lists reports with limit=5 offset=0 then offset=page size; empty dev inbox logs a hint only.
func smokeINTG015ListBattleReportsPaginationGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) int64 {
	t.Helper()
	const limit = int32(5)
	smokeStep(t, fmt.Sprintf("INTG-015 MIL: gateway ListBattleReports limit=%d offset=0", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i15-br-page1", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: 0}),
	})
	if resp.Code != 0 {
		intg015Failf(t, "list battle reports page1", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg015Failf(t, "decode battle reports page1", "player_id=%d err=%v", playerID, err)
	}
	pageCount := int32(len(out.GetReports()))
	t.Logf("INTG-015: ListBattleReports page1 player_id=%d total=%d count=%d", playerID, out.GetTotal(), pageCount)
	if out.GetTotal() < 1 || pageCount == 0 {
		t.Logf("INTG-015: skip battle report pagination page2 (no reports; same hint as INTG-012 — march may still be in transit; see tools/smoke/README.md)")
		return 0
	}
	for i, row := range out.GetReports() {
		if row.GetReportId() == 0 {
			intg015Failf(t, "battle report shape", "index=%d missing report_id", i)
		}
		if row.GetCreatedAtMs() <= 0 {
			intg015Failf(t, "battle report shape", "report_id=%d missing created_at_ms", row.GetReportId())
		}
		if row.GetOutcome() < 1 || row.GetOutcome() > 3 {
			intg015Failf(t, "battle report shape", "report_id=%d outcome=%d", row.GetReportId(), row.GetOutcome())
		}
	}
	firstID := out.GetReports()[0].GetReportId()

	smokeStep(t, fmt.Sprintf("INTG-015 MIL: gateway ListBattleReports limit=%d offset=%d", limit, pageCount))
	resp2 := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i15-br-page2", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit, Offset: pageCount}),
	})
	if resp2.Code != 0 {
		intg015Failf(t, "list battle reports page2", "player_id=%d offset=%d code=%d msg=%s", playerID, pageCount, resp2.Code, resp2.Msg)
	}
	var out2 militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp2.Data, &out2); err != nil {
		intg015Failf(t, "decode battle reports page2", "player_id=%d offset=%d err=%v", playerID, pageCount, err)
	}
	page2Count := int32(len(out2.GetReports()))
	if page2Count > limit {
		intg015Failf(t, "battle report pagination", "offset=%d page2 len=%d exceeds limit=%d", pageCount, page2Count, limit)
	}
	t.Logf("INTG-015: ListBattleReports page2 offset=%d count=%d total=%d (empty or shorter page ok)", pageCount, page2Count, out2.GetTotal())
	return firstID
}

func intg015Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG015CfgHint, step, fmt.Sprintf(format, args...))
}
