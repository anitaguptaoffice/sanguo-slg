package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG013CfgHint = smokeINTG012CfgHint + "; INTG-013: GetBattleReport detail.rounds; ClaimPlayerMailAttachments item_cfg_id=2001"

// TestINTG013Wave16SmokePath extends INTG-012 with battle report detail and mail attachment claim probes.
func TestINTG013Wave16SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-013 wave:16 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG013Wave16Smoke(t)
}

func runINTG013Wave16Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg013Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg013Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg013Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg013_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	marchID := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	reportID := smokeINTG012ListBattleReportsGateway(t, c, sid, playerID)
	smokeINTG013GetBattleReportGateway(t, c, sid, playerID, reportID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)

	smokeINTG010DualLeaderboardGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG012MailMarkReadGateway(t, ctx, c, pool, sid, playerID)
	mailGranted := smokeINTG013MailClaimAttachmentsGateway(t, ctx, c, pool, apiSrv, sid, playerID)

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

// smokeINTG013GetBattleReportGateway loads report detail when list returned a report_id; dev empty inbox logs hint only.
func smokeINTG013GetBattleReportGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64, reportID int64) {
	t.Helper()
	if reportID == 0 {
		t.Logf("INTG-013: skip GetBattleReport (no report_id; same hint as INTG-012 empty ListBattleReports — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-013 MIL: gateway GetBattleReport report_id=%d", reportID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetBattleReport, TraceId: "i13-br-get", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.GetBattleReportRequest{ReportId: reportID}),
	})
	if resp.Code != 0 {
		intg013Failf(t, "get battle report", "report_id=%d player_id=%d code=%d msg=%s", reportID, playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.GetBattleReportResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg013Failf(t, "decode battle report", "report_id=%d err=%v", reportID, err)
	}
	detail := out.GetReport().GetDetail()
	if detail == nil {
		intg013Failf(t, "battle report detail", "report_id=%d missing detail", reportID)
	}
	rounds := detail.GetRounds()
	if rounds == nil {
		intg013Failf(t, "battle report detail", "report_id=%d detail.rounds is nil", reportID)
	}
	if len(rounds) < 1 {
		intg013Failf(t, "battle report detail", "report_id=%d detail.rounds empty", reportID)
	}
	t.Logf("INTG-013: GetBattleReport ok report_id=%d rounds=%d result=%q", reportID, len(rounds), detail.GetResult())
}

// smokeINTG013MailClaimAttachmentsGateway seeds reward mail and claims via gateway; returns qty of item 2001 granted.
func smokeINTG013MailClaimAttachmentsGateway(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, apiSrv *api.Server, sid string, playerID int64) int32 {
	t.Helper()
	smokeStep(t, "INTG-013 MAIL: gm send-mail (attachments, claim probe)")
	mailSvc := mail.NewService(mail.NewPGStore(pool), apiSrv.ContentService(), nil)
	sent, err := mailSvc.Send(ctx, intg006ServerID, playerID, mail.TypeReward, "intg-013-claim", "claim attachments smoke", content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: smokeItemRewardCfgID, Qty: 1}},
	}, mail.SendAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-013", TicketID: "T-i13-claim"})
	if err != nil {
		intg013Failf(t, "gm send-mail claim probe", "err=%v", err)
	}

	smokeStep(t, fmt.Sprintf("INTG-013 MAIL: gateway ClaimPlayerMailAttachments mail_id=%d", sent.MailID))
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimPlayerMailAttachments, TraceId: "i13-mail-claim", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ClaimPlayerMailAttachmentsRequest{ServerId: intg006ServerID, MailId: sent.MailID}),
	})
	if claimResp.Code != 0 {
		intg013Failf(t, "claim mail attachments", "mail_id=%d code=%d msg=%s", sent.MailID, claimResp.Code, claimResp.Msg)
	}
	var claimOut contentv1.ClaimPlayerMailAttachmentsResponse
	if err := proto.Unmarshal(claimResp.Data, &claimOut); err != nil {
		intg013Failf(t, "decode claim mail", "mail_id=%d err=%v", sent.MailID, err)
	}
	granted := smokeINTG013FormatGranted(claimOut.GetGranted())
	t.Logf("INTG-013: ClaimPlayerMailAttachments ok mail_id=%d granted=%s", sent.MailID, granted)

	var qty2001 int32
	for _, it := range claimOut.GetGranted().GetItems() {
		if it.GetItemCfgId() == smokeItemRewardCfgID {
			qty2001 += it.GetQuantity()
		}
	}
	if qty2001 < 1 {
		for _, stack := range claimOut.GetBagItems() {
			if stack.GetItemCfgId() == smokeItemRewardCfgID && stack.GetQuantity() > 0 {
				qty2001 = 1
				break
			}
		}
	}
	if qty2001 < 1 {
		intg013Failf(t, "claim mail attachments", "mail_id=%d missing item_cfg_id=%d in granted/bag", sent.MailID, smokeItemRewardCfgID)
	}
	return qty2001
}

func smokeINTG013FormatGranted(granted *apicommon.RewardBundle) string {
	if granted == nil {
		return "(nil)"
	}
	var parts []string
	for _, it := range granted.GetItems() {
		parts = append(parts, fmt.Sprintf("item_%d=%d", it.GetItemCfgId(), it.GetQuantity()))
	}
	if w := granted.GetResources(); w != nil {
		if w.GetFood() > 0 {
			parts = append(parts, fmt.Sprintf("food=%d", w.GetFood()))
		}
		if w.GetWood() > 0 {
			parts = append(parts, fmt.Sprintf("wood=%d", w.GetWood()))
		}
		if w.GetIron() > 0 {
			parts = append(parts, fmt.Sprintf("iron=%d", w.GetIron()))
		}
		if w.GetStone() > 0 {
			parts = append(parts, fmt.Sprintf("stone=%d", w.GetStone()))
		}
		if w.GetGold() > 0 {
			parts = append(parts, fmt.Sprintf("gold=%d", w.GetGold()))
		}
	}
	if len(parts) == 0 {
		return "(empty)"
	}
	return strings.Join(parts, ",")
}

func intg013Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG013CfgHint, step, fmt.Sprintf(format, args...))
}
