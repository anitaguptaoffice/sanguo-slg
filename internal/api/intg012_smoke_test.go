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

const smokeINTG012CfgHint = smokeINTG011CfgHint + "; INTG-012: ListPlayerMail+MarkPlayerMailRead unread filter; ListBattleReports after march"

// TestINTG012Wave15SmokePath extends INTG-011 with MAIL read gateway and battle report list probes.
func TestINTG012Wave15SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-012 wave:15 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG012Wave15Smoke(t)
}

func runINTG012Wave15Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg012Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg012Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg012Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg012_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	marchID := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	_ = smokeINTG012ListBattleReportsGateway(t, c, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)

	smokeINTG010DualLeaderboardGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG012MailMarkReadGateway(t, ctx, c, pool, sid, playerID)

	want := intg009PersistSnapshot{intg008PersistSnapshot: ext, MarchID: marchID}
	if consumed2001 > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 -= consumed2001
	}
	if speedupUsed > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Base.Bag2003 -= speedupUsed
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

// smokeINTG012MailMarkReadGateway seeds a system mail, marks it read, and asserts unread inbox behavior.
func smokeINTG012MailMarkReadGateway(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-012 MAIL: gm send-mail (read probe, no attachments)")
	mailSvc := mail.NewService(mail.NewPGStore(pool), nil, nil)
	sent, err := mailSvc.Send(ctx, intg006ServerID, playerID, mail.TypeSystem, "intg-012-read", "mark read smoke", content.RewardPackage{},
		mail.SendAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-012", TicketID: "T-i12-read"})
	if err != nil {
		intg012Failf(t, "gm send-mail read probe", "err=%v", err)
	}
	t.Logf("INTG-012: seeded mail_id=%d for MarkPlayerMailRead", sent.MailID)

	smokeStep(t, "INTG-012 MAIL: gateway ListPlayerMail (all)")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i12-mail-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID,
			Filter:   contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
		}),
	})
	if listResp.Code != 0 {
		intg012Failf(t, "list player mail", "mail_id=%d code=%d msg=%s", sent.MailID, listResp.Code, listResp.Msg)
	}
	var listOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg012Failf(t, "decode mail list", "mail_id=%d err=%v", sent.MailID, err)
	}
	if !smokeINTG012MailInList(listOut.GetMails(), sent.MailID) {
		intg012Failf(t, "list player mail", "mail_id=%d not in inbox total=%d", sent.MailID, listOut.GetTotalCount())
	}

	smokeStep(t, fmt.Sprintf("INTG-012 MAIL: gateway MarkPlayerMailRead mail_id=%d", sent.MailID))
	markResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteMarkPlayerMailRead, TraceId: "i12-mail-read", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.MarkPlayerMailReadRequest{ServerId: intg006ServerID, MailId: sent.MailID}),
	})
	if markResp.Code != 0 {
		intg012Failf(t, "mark player mail read", "mail_id=%d code=%d msg=%s", sent.MailID, markResp.Code, markResp.Msg)
	}
	var markOut contentv1.MarkPlayerMailReadResponse
	if err := proto.Unmarshal(markResp.Data, &markOut); err != nil {
		intg012Failf(t, "decode mark mail read", "mail_id=%d err=%v", sent.MailID, err)
	}
	if !smokeINTG012MailIsRead(markOut.GetMail()) {
		intg012Failf(t, "mark player mail read", "mail_id=%d read_at_ms=%d status=%d", sent.MailID, markOut.GetMail().GetReadAtMs(), markOut.GetMail().GetStatus())
	}

	smokeStep(t, "INTG-012 MAIL: gateway ListPlayerMail (unread filter)")
	unreadResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i12-mail-unread", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID,
			Filter:   contentv1.MailInboxFilter_MAIL_INBOX_FILTER_UNREAD,
		}),
	})
	if unreadResp.Code != 0 {
		intg012Failf(t, "list unread mail", "mail_id=%d code=%d msg=%s", sent.MailID, unreadResp.Code, unreadResp.Msg)
	}
	var unreadOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(unreadResp.Data, &unreadOut); err != nil {
		intg012Failf(t, "decode unread mail list", "mail_id=%d err=%v", sent.MailID, err)
	}
	if smokeINTG012MailInList(unreadOut.GetMails(), sent.MailID) {
		intg012Failf(t, "unread filter after mark read", "mail_id=%d still visible in unread total=%d", sent.MailID, unreadOut.GetTotalCount())
	}
	t.Logf("INTG-012: mail_id=%d marked read; unread filter hides it (read_at_ms=%d)", sent.MailID, markOut.GetMail().GetReadAtMs())
}

func smokeINTG012MailInList(mails []*contentv1.PlayerMail, mailID int64) bool {
	for _, m := range mails {
		if m.GetMailId() == mailID {
			return true
		}
	}
	return false
}

func smokeINTG012MailIsRead(m *contentv1.PlayerMail) bool {
	if m == nil {
		return false
	}
	return m.GetReadAtMs() > 0 || m.GetStatus() == int32(mail.StatusRead) || m.GetStatus() == int32(mail.StatusClaimed)
}

// smokeINTG012ListBattleReportsGateway lists battle reports after march; empty dev inbox logs a hint only.
// Returns the first report_id when present, else 0 (INTG-013 may call GetBattleReport on it).
func smokeINTG012ListBattleReportsGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) int64 {
	t.Helper()
	const limit = 10
	smokeStep(t, fmt.Sprintf("INTG-012 MIL: gateway ListBattleReports limit=%d after StartMarch+ListMarches", limit))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListBattleReports, TraceId: "i12-br-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListBattleReportsRequest{Limit: limit}),
	})
	if resp.Code != 0 {
		intg012Failf(t, "list battle reports", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out militaryv1.ListBattleReportsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg012Failf(t, "decode battle reports", "player_id=%d err=%v", playerID, err)
	}
	if out.GetTotal() < 1 || len(out.GetReports()) == 0 {
		t.Logf("INTG-012: dev empty battle reports player_id=%d total=%d (march may still be in transit; advance clock or wait arrive — see tools/smoke/README.md)", playerID, out.GetTotal())
		return 0
	}
	for i, row := range out.GetReports() {
		if row.GetReportId() == 0 {
			intg012Failf(t, "battle report shape", "index=%d missing report_id", i)
		}
		if row.GetCreatedAtMs() <= 0 {
			intg012Failf(t, "battle report shape", "report_id=%d missing created_at_ms", row.GetReportId())
		}
		if row.GetOutcome() < 1 || row.GetOutcome() > 3 {
			intg012Failf(t, "battle report shape", "report_id=%d outcome=%d", row.GetReportId(), row.GetOutcome())
		}
	}
	firstID := out.GetReports()[0].GetReportId()
	t.Logf("INTG-012: ListBattleReports ok player_id=%d total=%d first_report_id=%d", playerID, out.GetTotal(), firstID)
	return firstID
}

func intg012Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG012CfgHint, step, fmt.Sprintf(format, args...))
}
