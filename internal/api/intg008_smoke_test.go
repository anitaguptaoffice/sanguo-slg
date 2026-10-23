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
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
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
	smokeDailyRecruitQuestCfgID = int32(1015)
	smokeDailyRecruitUnlockLvl  = int32(7)
)

const smokeINTG008CfgHint = smokeINTG007CfgHint + "; INTG-008: ListRecruitTemplates; daily_food via GM grant hook; daily_recruit_1 quest_cfg_id=1015"

type intg008PersistSnapshot struct {
	intg007PersistSnapshot
	DailyRecruitState int16
}

// TestINTG008Wave11SmokePath extends INTG-007 with HERO-003 ListRecruitTemplates and QUEST-002 hook-driven daily chain 400.
func TestINTG008Wave11SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-008 wave:11 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG008Wave11Smoke(t)
}

func runINTG008Wave11Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg008Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg008Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg008Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg008_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeQuest003Optional(t, ctx, c, sid)

	ts.Close()
	_ = c.Close()

	pool2 := reopenDBPool(t)
	apiSrv2, ts2, wsURL2 := startData002SmokeGateway(t, log, pool2, worldStore)
	defer ts2.Close()

	c2 := dial(t, wsURL2)
	defer func() { _ = c2.Close() }()

	sid2, _ := smokeLoginOnly(t, c2, loginName)
	assertINTG008Persistence(t, ctx, pool2, apiSrv2, c2, sid2, playerID, ext)
	runData002M3Subset(t, ctx, c2, apiSrv2, pool2, sid2, playerID)
}

func runINTG008DeepenSteps(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, base data002PersistSnapshot) intg008PersistSnapshot {
	bag2001 := base.Bag2001
	bag2001 += smokeGmSendMailAndClaim(t, ctx, c, pool, apiSrv, sid, playerID)
	smokeListRecruitTemplatesGateway(t, c, sid)
	dailyFoodState := smokeDailyFoodChainGrantHook(t, ctx, c, apiSrv, pool, sid, playerID)
	heroTpl, dailyRecruitState := smokeDailyRecruitChain(t, ctx, c, apiSrv, pool, sid, playerID)
	return intg008PersistSnapshot{
		intg007PersistSnapshot: intg007PersistSnapshot{
			Base:            base,
			Bag2001:         bag2001,
			DailyQuestState: dailyFoodState,
			HeroTemplateID:  heroTpl,
		},
		DailyRecruitState: dailyRecruitState,
	}
}

func smokeListRecruitTemplatesGateway(t *testing.T, c *websocket.Conn, sid string) {
	t.Helper()
	smokeStep(t, "HERO-003: gateway ListRecruitTemplates")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListRecruitTemplates, TraceId: "i8-tpl", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListRecruitTemplatesRequest{ServerId: intg006ServerID, PageSize: 50}),
	})
	if listResp.Code != 0 {
		intg008Failf(t, "list recruit templates", "code=%d msg=%s", listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListRecruitTemplatesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg008Failf(t, "decode recruit templates", "err=%v", err)
	}
	if listOut.GetTotalCount() < 1 || len(listOut.GetTemplates()) == 0 {
		intg008Failf(t, "list recruit templates", "empty total=%d", listOut.GetTotalCount())
	}
	var tpl *herov1.RecruitTemplatePreview
	for _, row := range listOut.GetTemplates() {
		if row.GetTemplateCfgId() == smokeHeroTemplateCfgID {
			tpl = row
			break
		}
	}
	if tpl == nil {
		intg008Failf(t, "list recruit templates", "template_cfg_id=%d missing", smokeHeroTemplateCfgID)
	}
	cost := tpl.GetRecruitCost()
	if cost == nil || cost.GetFood() != 5000 || cost.GetWood() != 5000 {
		intg008Failf(t, "recruit template cost", "template_cfg_id=%d cost=%+v", smokeHeroTemplateCfgID, cost)
	}
	item := tpl.GetRecruitItem()
	if item == nil || item.GetItemCfgId() != hero.RecruitScrollID || item.GetQuantity() < 1 {
		intg008Failf(t, "recruit template item", "template_cfg_id=%d item=%+v", smokeHeroTemplateCfgID, item)
	}
}

func smokeDailyFoodChainGrantHook(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) int16 {
	t.Helper()
	smokeStep(t, fmt.Sprintf("QUEST-002: unlock + accept daily_food_1 quest_cfg_id=%d", smokeDailyFoodQuestCfgID))
	_, err := pool.Exec(ctx, `UPDATE player SET level = 5 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg008Failf(t, "seed player level for daily", "err=%v", err)
	}
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "i8-daily-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyFoodQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		intg008Failf(t, "accept daily quest", "quest_cfg_id=%d code=%d msg=%s", smokeDailyFoodQuestCfgID, acceptResp.Code, acceptResp.Msg)
	}

	smokeStep(t, fmt.Sprintf("QUEST-002: GM grant food=%d (collect_resource hook)", smokeDailyFoodTarget))
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-008", TicketID: "T-daily-food"}
	_, _, err = apiSrv.GmGrantRewardWithQuestHooks(ctx, audit, intg006ServerID, playerID, content.RewardPackage{
		Resources: map[string]int64{"food": int64(smokeDailyFoodTarget)},
	}, fmt.Sprintf("intg-008:daily-food:%d", playerID))
	if err != nil {
		intg008Failf(t, "gm grant food for daily", "err=%v", err)
	}

	smokeStep(t, "QUEST-002: claim daily_food_1 reward")
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "i8-daily-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyFoodQuestCfgID}),
	})
	if claimResp.Code != 0 {
		intg008Failf(t, "claim daily quest", "quest_cfg_id=%d code=%d msg=%s", smokeDailyFoodQuestCfgID, claimResp.Code, claimResp.Msg)
	}

	var state int16
	err = pool.QueryRow(ctx, `
		SELECT state FROM player_quest
		WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=$3`,
		intg006ServerID, playerID, smokeDailyFoodQuestCfgID).Scan(&state)
	if err != nil {
		intg008Failf(t, "read daily quest pg", "err=%v", err)
	}
	if state != 3 {
		intg008Failf(t, "daily quest state after claim", "quest_cfg_id=%d state=%d want=3", smokeDailyFoodQuestCfgID, state)
	}
	return state
}

func smokeDailyRecruitChain(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) (heroTemplateID int32, recruitDailyState int16) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("QUEST-002: daily_recruit_1 quest_cfg_id=%d", smokeDailyRecruitQuestCfgID))
	_, err := pool.Exec(ctx, `UPDATE player SET level = $3 WHERE server_id = $1 AND player_id = $2`,
		intg006ServerID, playerID, smokeDailyRecruitUnlockLvl)
	if err != nil {
		intg008Failf(t, "seed player level for daily recruit", "err=%v", err)
	}
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "i8-recruit-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyRecruitQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		intg008Failf(t, "accept daily recruit quest", "quest_cfg_id=%d code=%d msg=%s", smokeDailyRecruitQuestCfgID, acceptResp.Code, acceptResp.Msg)
	}

	smokeStep(t, "HERO-002: seed recruit scroll + resources via GM grant")
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-008", TicketID: "T-hero"}
	_, _, err = apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 3}},
		Resources: map[string]int64{
			"food": 20000, "wood": 20000, "iron": 20000, "stone": 20000,
		},
	}, "intg-008-hero-seed")
	if err != nil {
		intg008Failf(t, "gm grant hero seed", "err=%v", err)
	}

	smokeStep(t, fmt.Sprintf("HERO-002: gateway RecruitHero template_cfg_id=%d (recruit_hero hook)", smokeHeroTemplateCfgID))
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitHero, TraceId: "i8-recruit", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RecruitHeroRequest{ServerId: intg006ServerID, TemplateCfgId: smokeHeroTemplateCfgID}),
	})
	if recruitResp.Code != 0 {
		intg008Failf(t, "recruit hero", "template_cfg_id=%d code=%d msg=%s", smokeHeroTemplateCfgID, recruitResp.Code, recruitResp.Msg)
	}

	smokeStep(t, "QUEST-002: claim daily_recruit_1 reward")
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "i8-recruit-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyRecruitQuestCfgID}),
	})
	if claimResp.Code != 0 {
		intg008Failf(t, "claim daily recruit quest", "quest_cfg_id=%d code=%d msg=%s", smokeDailyRecruitQuestCfgID, claimResp.Code, claimResp.Msg)
	}

	var state int16
	err = pool.QueryRow(ctx, `
		SELECT state FROM player_quest
		WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=$3`,
		intg006ServerID, playerID, smokeDailyRecruitQuestCfgID).Scan(&state)
	if err != nil {
		intg008Failf(t, "read daily recruit quest pg", "err=%v", err)
	}
	if state != 3 {
		intg008Failf(t, "daily recruit quest state after claim", "quest_cfg_id=%d state=%d want=3", smokeDailyRecruitQuestCfgID, state)
	}

	smokeStep(t, "HERO-002: gateway ListPlayerHeroes")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i8-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		intg008Failf(t, "list player heroes", "template_cfg_id=%d code=%d msg=%s", smokeHeroTemplateCfgID, listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg008Failf(t, "decode hero list", "err=%v", err)
	}
	for _, h := range listOut.GetHeroes() {
		if h.GetTemplateCfgId() == smokeHeroTemplateCfgID {
			return smokeHeroTemplateCfgID, state
		}
	}
	intg008Failf(t, "list player heroes", "template_cfg_id=%d not found total=%d", smokeHeroTemplateCfgID, listOut.GetTotalCount())
	return 0, state
}

// smokeQuest003Optional tries train/build/use quest hooks when QUEST-003 lands; never fails the main path.
func smokeQuest003Optional(t *testing.T, ctx context.Context, c *websocket.Conn, sid string) {
	t.Helper()
	smokeStep(t, "QUEST-003 optional: train/build/use hook probe (non-blocking)")
	_ = ctx
	probe := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i8-q3-probe", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID}),
	})
	if probe.Code != 0 {
		t.Logf("QUEST-003 optional skipped: list quests code=%d (await QUEST-003 train/build/use hooks)", probe.Code)
		return
	}
	t.Log("QUEST-003 optional: chain 400 listed; train/build/use assertions deferred until QUEST-003 merges (see tools/smoke/README.md)")
}

func assertINTG008Persistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, apiSrv *api.Server, c *websocket.Conn, sid string, playerID int64, want intg008PersistSnapshot) {
	t.Helper()
	assertINTG007Persistence(t, ctx, pool, apiSrv, c, sid, playerID, want.intg007PersistSnapshot)

	var recruitState int16
	err := pool.QueryRow(ctx, `
		SELECT state FROM player_quest
		WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=$3`,
		intg006ServerID, playerID, smokeDailyRecruitQuestCfgID).Scan(&recruitState)
	if err != nil {
		intg008Failf(t, "daily recruit quest pg after restart", "err=%v", err)
	}
	if recruitState != want.DailyRecruitState {
		intg008Failf(t, "daily recruit quest state after restart", "quest_cfg_id=%d state=%d want=%d", smokeDailyRecruitQuestCfgID, recruitState, want.DailyRecruitState)
	}

	smokeStep(t, "HERO-003: ListRecruitTemplates after restart")
	smokeListRecruitTemplatesGateway(t, c, sid)
}

func intg008Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG008CfgHint, step, fmt.Sprintf(format, args...))
}
