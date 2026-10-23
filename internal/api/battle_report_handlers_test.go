package api_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

func TestGetAndListBattleReports(t *testing.T) {
	clk := &handlerClock{t: time.Unix(1_700_000_000, 0)}
	domHub := domestic.NewHub(clk.Now)
	milHub := march.NewHub(clk.Now)
	store := report.NewMemStore()
	reportSvc := report.NewService(store)
	resolver := combat.NewResolver(1, reportSvc, combat.M2FixtureGarrisons(), nil)
	milHub.SetMarchArrivalHandler(resolver.HubHandler())

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := api.NewServer(log, nil, nil, domHub, milHub)
	srv.AttachBattleReports(reportSvc)

	const playerID = 42
	sid := "battle-report-session"
	srv.BindSessionForTest(sid, api.PlayerContext{ServerID: 1, PlayerID: playerID})

	ctx := context.Background()
	rep := battle.Simulate(battle.BaselineInputs()[0])
	rec, err := reportSvc.Save(ctx, report.SaveParams{
		ServerID: 1, ReportID: 9, AttackerPlayerID: playerID,
		LocationX: 5, LocationY: 5, Report: rep,
	})
	if err != nil {
		t.Fatal(err)
	}

	router := srv.GatewayRouter()
	getPkt := &commonv1.ClientPacket{
		Route:     api.RouteGetBattleReport,
		TraceId:   "get",
		SessionId: sid,
		Payload:   mustMarshal(&militaryv1.GetBattleReportRequest{ReportId: rec.ReportID}),
	}
	getResp := router.Dispatch(ctx, getPkt)
	if getResp.Code != 0 {
		t.Fatalf("get: code=%d msg=%s", getResp.Code, getResp.Msg)
	}
	var getOut militaryv1.GetBattleReportResponse
	if err := proto.Unmarshal(getResp.Data, &getOut); err != nil {
		t.Fatal(err)
	}
	if getOut.GetReport().GetSummary().GetReportId() != rec.ReportID {
		t.Fatalf("report id %d", getOut.GetReport().GetSummary().GetReportId())
	}

	listPkt := &commonv1.ClientPacket{
		Route:     api.RouteListBattleReports,
		TraceId:   "list",
		SessionId: sid,
		Payload:   mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: 10}),
	}
	listResp := router.Dispatch(ctx, listPkt)
	if listResp.Code != 0 {
		t.Fatalf("list: code=%d", listResp.Code)
	}
	var listOut militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Fatal(err)
	}
	if listOut.GetTotal() < 1 || len(listOut.GetReports()) == 0 {
		t.Fatal("expected at least one report")
	}
}
