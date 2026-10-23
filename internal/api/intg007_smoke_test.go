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
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const (
	smokeDailyFoodQuestCfgID = int32(1012)
	smokeDailyQuestChainID   = int32(400)
	smokeHeroTemplateCfgID   = int32(1001)
	smokeDailyFoodTarget     = int32(5000)
)

const smokeINTG007CfgHint = smokeData002CfgHint + "; INTG-007: daily_food_1 quest_cfg_id=1012 chain_id=400; hero template_cfg_id=1001; mail item_cfg_id=2001"

type intg007PersistSnapshot struct {
	Base            data002PersistSnapshot
	Bag2001         int32
	DailyQuestState int16
	HeroTemplateID  int32
}

// TestINTG007M4DeepSmokePath extends INTG-006 with MAIL-001, HERO-002 recruit, and QUEST-002 daily chain 400.
func TestINTG007M4DeepSmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-007 deep smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG007DeepSmoke(t)
}

func runINTG007DeepSmoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg007Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg007Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg007Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg007_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG007DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)

	smokeStep(t, "simulate process restart (new api.Server + PG pool)")
	ts.Close()
	_ = c.Close()

	pool2 := reopenDBPool(t)
	apiSrv2, ts2, wsURL2 := startData002SmokeGateway(t, log, pool2, worldStore)
	defer ts2.Close()

	c2 := dial(t, wsURL2)
	defer func() { _ = c2.Close() }()

	sid2, _ := smokeLoginOnly(t, c2, loginName)
	assertINTG007Persistence(t, ctx, pool2, apiSrv2, c2, sid2, playerID, ext)
	runData002M3Subset(t, ctx, c2, apiSrv2, pool2, sid2, playerID)
}

func runINTG007DeepenSteps(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, base data002PersistSnapshot) intg007PersistSnapshot {
	bag2001 := base.Bag2001
	bag2001 += smokeGmSendMailAndClaim(t, ctx, c, pool, apiSrv, sid, playerID)
	heroTpl := smokeRecruitHeroGateway(t, ctx, c, apiSrv, sid, playerID)
	dailyState := smokeDailyFoodChain(t, ctx, c, pool, sid, playerID)
	return intg007PersistSnapshot{
		Base:            base,
		Bag2001:         bag2001,
		DailyQuestState: dailyState,
		HeroTemplateID:  heroTpl,
	}
}

func smokeGmSendMailAndClaim(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, apiSrv *api.Server, sid string, playerID int64) int32 {
	t.Helper()
	smokeStep(t, "MAIL-001: gm send-mail (cmd/gm equivalent)")
	mailSvc := mail.NewService(mail.NewPGStore(pool), apiSrv.ContentService(), nil)
	sent, err := mailSvc.Send(ctx, intg006ServerID, playerID, mail.TypeReward, "intg-007-smoke", "claim attachments", content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: smokeItemRewardCfgID, Qty: 1}},
	}, mail.SendAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-007", TicketID: "T-mail"})
	if err != nil {
		intg007Failf(t, "gm send-mail", "err=%v", err)
	}

	smokeStep(t, "MAIL-001: gateway ListPlayerMail")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i7-mail-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID,
			Filter:   contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
		}),
	})
	if listResp.Code != 0 {
		intg007Failf(t, "list player mail", "code=%d msg=%s", listResp.Code, listResp.Msg)
	}
	var listOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg007Failf(t, "decode mail list", "err=%v", err)
	}
	if len(listOut.GetMails()) == 0 {
		intg007Failf(t, "list player mail", "empty inbox mail_id=%d", sent.MailID)
	}

	smokeStep(t, "MAIL-001: gateway ClaimPlayerMailAttachments into bag")
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimPlayerMailAttachments, TraceId: "i7-mail-claim", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ClaimPlayerMailAttachmentsRequest{ServerId: intg006ServerID, MailId: sent.MailID}),
	})
	if claimResp.Code != 0 {
		intg007Failf(t, "claim mail attachments", "mail_id=%d code=%d msg=%s", sent.MailID, claimResp.Code, claimResp.Msg)
	}
	return 1
}

func smokeRecruitHeroGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) int32 {
	t.Helper()
	smokeStep(t, "HERO-002: seed recruit scroll + resources via GM grant")
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-007", TicketID: "T-hero"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 3}},
		Resources: map[string]int64{
			"food": 20000, "wood": 20000, "iron": 20000, "stone": 20000,
		},
	}, "intg-007-hero-seed")
	if err != nil {
		intg007Failf(t, "gm grant hero seed", "err=%v", err)
	}

	smokeStep(t, fmt.Sprintf("HERO-002: gateway RecruitHero template_cfg_id=%d", smokeHeroTemplateCfgID))
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitHero, TraceId: "i7-recruit", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RecruitHeroRequest{ServerId: intg006ServerID, TemplateCfgId: smokeHeroTemplateCfgID}),
	})
	if recruitResp.Code != 0 {
		intg007Failf(t, "recruit hero", "template_cfg_id=%d code=%d msg=%s", smokeHeroTemplateCfgID, recruitResp.Code, recruitResp.Msg)
	}

	smokeStep(t, "HERO-002: gateway ListPlayerHeroes")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i7-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		intg007Failf(t, "list player heroes", "template_cfg_id=%d code=%d msg=%s", smokeHeroTemplateCfgID, listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg007Failf(t, "decode hero list", "err=%v", err)
	}
	for _, h := range listOut.GetHeroes() {
		if h.GetTemplateCfgId() == smokeHeroTemplateCfgID {
			return smokeHeroTemplateCfgID
		}
	}
	intg007Failf(t, "list player heroes", "template_cfg_id=%d not found total=%d", smokeHeroTemplateCfgID, listOut.GetTotalCount())
	return 0
}

func smokeDailyFoodChain(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, playerID int64) int16 {
	t.Helper()
	smokeStep(t, fmt.Sprintf("QUEST-002: unlock + accept daily_food_1 quest_cfg_id=%d", smokeDailyFoodQuestCfgID))
	_, err := pool.Exec(ctx, `UPDATE player SET level = 5 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg007Failf(t, "seed player level for daily", "err=%v", err)
	}
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "i7-daily-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyFoodQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		intg007Failf(t, "accept daily quest", "quest_cfg_id=%d code=%d msg=%s", smokeDailyFoodQuestCfgID, acceptResp.Code, acceptResp.Msg)
	}

	smokeStep(t, fmt.Sprintf("QUEST-002: report collect_resource progress target=%d", smokeDailyFoodTarget))
	progResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteReportQuestProgress, TraceId: "i7-daily-p", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ReportQuestProgressRequest{
			ServerId: intg006ServerID, QuestCfgId: smokeDailyFoodQuestCfgID, Absolute: true, ProgressValue: smokeDailyFoodTarget,
		}),
	})
	if progResp.Code != 0 {
		intg007Failf(t, "report daily progress", "quest_cfg_id=%d code=%d msg=%s", smokeDailyFoodQuestCfgID, progResp.Code, progResp.Msg)
	}

	smokeStep(t, "QUEST-002: claim daily reward")
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "i7-daily-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyFoodQuestCfgID}),
	})
	if claimResp.Code != 0 {
		intg007Failf(t, "claim daily quest", "quest_cfg_id=%d code=%d msg=%s", smokeDailyFoodQuestCfgID, claimResp.Code, claimResp.Msg)
	}

	var state int16
	err = pool.QueryRow(ctx, `
		SELECT state FROM player_quest
		WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=$3`,
		intg006ServerID, playerID, smokeDailyFoodQuestCfgID).Scan(&state)
	if err != nil {
		intg007Failf(t, "read daily quest pg", "err=%v", err)
	}
	if state != 3 {
		intg007Failf(t, "daily quest state after claim", "quest_cfg_id=%d state=%d want=3", smokeDailyFoodQuestCfgID, state)
	}
	return state
}

func assertINTG007Persistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, apiSrv *api.Server, c *websocket.Conn, sid string, playerID int64, want intg007PersistSnapshot) {
	t.Helper()
	base := want.Base
	base.Bag2001 = want.Bag2001
	assertData002Persistence(t, ctx, pool, apiSrv, c, sid, playerID, base)

	smokeStep(t, "verify daily quest chain 400 after restart")
	var dailyState int16
	err := pool.QueryRow(ctx, `
		SELECT state FROM player_quest
		WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=$3`,
		intg006ServerID, playerID, smokeDailyFoodQuestCfgID).Scan(&dailyState)
	if err != nil {
		intg007Failf(t, "daily quest pg after restart", "err=%v", err)
	}
	if dailyState != want.DailyQuestState {
		intg007Failf(t, "daily quest state after restart", "quest_cfg_id=%d state=%d want=%d", smokeDailyFoodQuestCfgID, dailyState, want.DailyQuestState)
	}
	chainResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetQuestChainStatus, TraceId: "i7-chain", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.GetQuestChainStatusRequest{ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID}),
	})
	if chainResp.Code != 0 {
		intg007Failf(t, "get quest chain status", "chain_id=%d code=%d msg=%s", smokeDailyQuestChainID, chainResp.Code, chainResp.Msg)
	}

	smokeStep(t, "verify hero roster after restart")
	heroResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i7-heroes-r", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if heroResp.Code != 0 {
		intg007Failf(t, "list heroes after restart", "template_cfg_id=%d code=%d msg=%s", want.HeroTemplateID, heroResp.Code, heroResp.Msg)
	}
	var heroOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(heroResp.Data, &heroOut); err != nil {
		intg007Failf(t, "decode heroes after restart", "err=%v", err)
	}
	found := false
	for _, h := range heroOut.GetHeroes() {
		if h.GetTemplateCfgId() == want.HeroTemplateID {
			found = true
			break
		}
	}
	if !found {
		intg007Failf(t, "hero missing after restart", "template_cfg_id=%d total=%d", want.HeroTemplateID, heroOut.GetTotalCount())
	}
}

func intg007Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG007CfgHint, step, fmt.Sprintf(format, args...))
}
