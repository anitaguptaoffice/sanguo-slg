package api_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG046CfgHint = smokeINTG045CfgHint + "; INTG-046: L9 AddHeroPoint+GetHeroDetail attrs; L10 Begin/FinishHeroExpr+exp; L11 RestHero+StartMarch march_force gate"

// TestINTG046HeroL9L11SmokePath extends INTG-045 with points / expr / march_force gateway hints (issue #1231).
func TestINTG046HeroL9L11SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-046 hero L9–L11 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG046HeroL9L11Smoke(t)
}

func runINTG046HeroL9L11Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG046BeforeRestartGateway)
}

func smokeINTG046BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG045BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-046: skip L9–L11 (no city_id — see tools/smoke/README.md)")
		return
	}
	smokeINTG046L9PointsGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG046L10ExprGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG046L11MarchForceGateway(t, ctx, c, apiSrv, sid, playerID, cityID)
}

func smokeINTG046L9PointsGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) {
	t.Helper()
	heroID := smokeINTG046RecruitDedicatedHero(t, ctx, c, apiSrv, sid, playerID)
	if heroID == 0 {
		t.Logf("INTG-046: skip L9 points (no hero_id — see tools/smoke/README.md)")
		return
	}
	smokeINTG046SetHeroLevel(t, ctx, apiSrv, heroID, 3)

	smokeStep(t, fmt.Sprintf("INTG-046 L9: gateway GetHeroDetail attrs+exp+march_force hero_id=%d", heroID))
	detailBefore := smokeINTG046GetHeroDetail(t, c, sid, heroID)
	if detailBefore.GetMarchForceMax() <= 0 {
		intg046Failf(t, "get hero detail march_force_max", "hero_id=%d max=%d", heroID, detailBefore.GetMarchForceMax())
	}
	t.Logf("INTG-046: GetHeroDetail hero_id=%d level=%d exp=%d attrs force=%d intel=%d politics=%d march_force=%d/%d points_expr_force_l9_hint=client_derived",
		heroID, detailBefore.GetLevel(), detailBefore.GetExp(),
		detailBefore.GetAttributes().GetForce(), detailBefore.GetAttributes().GetIntel(), detailBefore.GetAttributes().GetPolitics(),
		detailBefore.GetMarchForce(), detailBefore.GetMarchForceMax())

	h, tpl, err := smokeINTG046OwnedTemplateHero(t, ctx, apiSrv, playerID, heroID)
	if err != nil {
		intg046Failf(t, "load hero for points", "hero_id=%d err=%v", heroID, err)
	}
	base := hero.StatsAtLevel(tpl, h.Level)
	smokeStep(t, fmt.Sprintf("INTG-046 L9: gateway AddHeroPoint hero_id=%d", heroID))
	addResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAddHeroPoint, TraceId: "i46-add-point", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.AddHeroPointRequest{
			ServerId: intg006ServerID, HeroId: heroID,
			Politics: base.Politics + 1, Force: base.Force + 1, Intel: base.Intel + 1,
		}),
	})
	if addResp.Code != 0 {
		intg046Failf(t, "add hero point", "hero_id=%d code=%d msg=%s", heroID, addResp.Code, addResp.Msg)
	}
	var addOut herov1.AddHeroPointResponse
	if err := proto.Unmarshal(addResp.Data, &addOut); err != nil {
		intg046Failf(t, "decode add hero point", "err=%v", err)
	}
	t.Logf("INTG-046: AddHeroPoint hero_id=%d potential_remaining=%d politics_add=%d force_add=%d intel_add=%d add_point_l9_hint=client_derived",
		heroID, addOut.GetPotentialRemaining(), addOut.GetPoliticsAdd(), addOut.GetForceAdd(), addOut.GetIntelAdd())

	detailAfter := smokeINTG046GetHeroDetail(t, c, sid, heroID)
	if detailAfter.GetAttributes().GetForce() <= detailBefore.GetAttributes().GetForce() {
		intg046Failf(t, "get hero detail after add point", "hero_id=%d force before=%d after=%d",
			heroID, detailBefore.GetAttributes().GetForce(), detailAfter.GetAttributes().GetForce())
	}

	hMarch, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || hMarch == nil {
		intg046Failf(t, "load hero for add-point busy reject", "hero_id=%d err=%v", heroID, err)
	}
	hMarch.Status = hero.StatusMarch
	if err := apiSrv.HeroService().Store.SaveHero(ctx, hMarch); err != nil {
		intg046Failf(t, "seed marching for add-point reject", "err=%v", err)
	}
	smokeStep(t, fmt.Sprintf("INTG-046 L9: gateway AddHeroPoint reject non-idle hero_id=%d", heroID))
	busyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAddHeroPoint, TraceId: "i46-add-point-busy", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.AddHeroPointRequest{
			ServerId: intg006ServerID, HeroId: heroID,
			Politics: base.Politics + 1, Force: base.Force + 1, Intel: base.Intel + 1,
		}),
	})
	if busyResp.Code == 0 {
		intg046Failf(t, "add hero point non-idle", "expected reject hero_id=%d", heroID)
	}
	t.Logf("INTG-046: AddHeroPoint non-idle reject hero_id=%d code=%d msg=%s add_point_busy_l9_hint=client_derived",
		heroID, busyResp.Code, busyResp.Msg)
	hMarch.Status = hero.StatusIdle
	if err := apiSrv.HeroService().Store.SaveHero(ctx, hMarch); err != nil {
		intg046Failf(t, "restore idle after add-point busy", "err=%v", err)
	}
}

func smokeINTG046L10ExprGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) {
	t.Helper()
	heroID := smokeINTG046RecruitDedicatedHero(t, ctx, c, apiSrv, sid, playerID)
	if heroID == 0 {
		t.Logf("INTG-046: skip L10 expr (no hero_id — see tools/smoke/README.md)")
		return
	}
	smokeINTG046SetHeroLevel(t, ctx, apiSrv, heroID, 3)
	smokeINTG046GrantExprGold(t, ctx, apiSrv, playerID)

	detailBefore := smokeINTG046GetHeroDetail(t, c, sid, heroID)
	expBefore := detailBefore.GetExp()

	smokeStep(t, fmt.Sprintf("INTG-046 L10: gateway BeginHeroExpr hero_id=%d", heroID))
	beginResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteBeginHeroExpr, TraceId: "i46-begin-expr", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.BeginHeroExprRequest{ServerId: intg006ServerID, HeroId: heroID, Hours: 1}),
	})
	if beginResp.Code != 0 {
		intg046Failf(t, "begin hero expr", "hero_id=%d code=%d msg=%s", heroID, beginResp.Code, beginResp.Msg)
	}
	var beginOut herov1.BeginHeroExprResponse
	if err := proto.Unmarshal(beginResp.Data, &beginOut); err != nil {
		intg046Failf(t, "decode begin hero expr", "err=%v", err)
	}
	t.Logf("INTG-046: BeginHeroExpr hero_id=%d status=%d ends_at_ms=%d gold_spent=%d begin_expr_l10_hint=client_derived",
		heroID, beginOut.GetStatus(), beginOut.GetEndsAtMs(), beginOut.GetGoldSpent())

	smokeStep(t, fmt.Sprintf("INTG-046 L10: gateway FinishHeroExpr reject early hero_id=%d", heroID))
	earlyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteFinishHeroExpr, TraceId: "i46-finish-expr-early", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.FinishHeroExprRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if earlyResp.Code == 0 {
		intg046Failf(t, "finish hero expr early", "expected reject hero_id=%d", heroID)
	}
	t.Logf("INTG-046: FinishHeroExpr early reject hero_id=%d code=%d msg=%s expr_not_complete_l10_hint=client_derived",
		heroID, earlyResp.Code, earlyResp.Msg)

	apiSrv.AdvanceSmokeTimeTo(time.UnixMilli(beginOut.GetEndsAtMs()).Add(2 * time.Second))
	smokeStep(t, fmt.Sprintf("INTG-046 L10: gateway FinishHeroExpr hero_id=%d", heroID))
	finishResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteFinishHeroExpr, TraceId: "i46-finish-expr", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.FinishHeroExprRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if finishResp.Code != 0 {
		intg046Failf(t, "finish hero expr", "hero_id=%d code=%d msg=%s", heroID, finishResp.Code, finishResp.Msg)
	}
	var finishOut herov1.FinishHeroExprResponse
	if err := proto.Unmarshal(finishResp.Data, &finishOut); err != nil {
		intg046Failf(t, "decode finish hero expr", "err=%v", err)
	}
	t.Logf("INTG-046: FinishHeroExpr hero_id=%d exp_gained=%d exp=%d finish_expr_l10_hint=client_derived",
		heroID, finishOut.GetExpGained(), finishOut.GetExp())

	detailAfter := smokeINTG046GetHeroDetail(t, c, sid, heroID)
	if detailAfter.GetExp() <= expBefore {
		intg046Failf(t, "get hero detail exp after expr", "hero_id=%d exp before=%d after=%d", heroID, expBefore, detailAfter.GetExp())
	}
	t.Logf("INTG-046: GetHeroDetail after expr hero_id=%d exp=%d exp_toward_next=%d upgrade_exp_required=%d hero_detail_expr_l10_hint=client_derived",
		heroID, detailAfter.GetExp(), detailAfter.GetExpTowardNext(), detailAfter.GetUpgradeExpRequired())
}

func smokeINTG046L11MarchForceGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64, cityID int64) {
	t.Helper()
	heroID := smokeINTG046RecruitDedicatedHero(t, ctx, c, apiSrv, sid, playerID)
	if heroID == 0 {
		t.Logf("INTG-046: skip L11 march_force (no hero_id — see tools/smoke/README.md)")
		return
	}
	h, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h == nil {
		intg046Failf(t, "load hero for march force", "hero_id=%d err=%v", heroID, err)
	}
	if h.Status != hero.StatusIdle {
		h.Status = hero.StatusIdle
		if err := apiSrv.HeroService().Store.SaveHero(ctx, h); err != nil {
			intg046Failf(t, "reset hero idle for march force", "err=%v", err)
		}
	}

	maxForce := hero.MarchForceMax(h.Level)
	now := time.Now()
	if err := apiSrv.HeroService().Store.SaveMarchForceState(ctx, hero.MarchForceState{
		ServerID: intg006ServerID, HeroID: heroID,
		Current: hero.MarchForceMarchCost - 1, LastRegenAt: now,
	}); err != nil {
		intg046Failf(t, "seed low march force", "err=%v", err)
	}

	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 40)
	smokeStep(t, fmt.Sprintf("INTG-046 L11: gateway StartMarch reject insufficient force hero_id=%d", heroID))
	lowResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i46-march-low-force", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 44, ToY: 45, Purpose: 1, HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5}},
		}),
	})
	if lowResp.Code == 0 {
		intg046Failf(t, "start march low force", "expected reject hero_id=%d", heroID)
	}
	if lowResp.Code != int32(commonv1.ErrorCode_MILITARY_INVALID_MARCH) {
		intg046Failf(t, "start march low force code", "hero_id=%d code=%d want=%d msg=%s",
			heroID, lowResp.Code, commonv1.ErrorCode_MILITARY_INVALID_MARCH, lowResp.Msg)
	}
	t.Logf("INTG-046: StartMarch insufficient force reject hero_id=%d code=%d msg=%s march_force_gate_l11_hint=client_derived",
		heroID, lowResp.Code, lowResp.Msg)

	if err := apiSrv.HeroService().Store.SaveMarchForceState(ctx, hero.MarchForceState{
		ServerID: intg006ServerID, HeroID: heroID, Current: 8, LastRegenAt: now,
	}); err != nil {
		intg046Failf(t, "seed partial march force", "err=%v", err)
	}
	smokeStep(t, fmt.Sprintf("INTG-046 L11: gateway RestHero refill hero_id=%d", heroID))
	restResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRestHero, TraceId: "i46-rest-hero", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RestHeroRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if restResp.Code != 0 {
		intg046Failf(t, "rest hero", "hero_id=%d code=%d msg=%s", heroID, restResp.Code, restResp.Msg)
	}
	var restOut herov1.RestHeroResponse
	if err := proto.Unmarshal(restResp.Data, &restOut); err != nil {
		intg046Failf(t, "decode rest hero", "err=%v", err)
	}
	if restOut.GetMarchForce() != maxForce || restOut.GetMarchForceMax() != maxForce {
		intg046Failf(t, "rest hero force", "hero_id=%d got=%d/%d want=%d/%d",
			heroID, restOut.GetMarchForce(), restOut.GetMarchForceMax(), maxForce, maxForce)
	}
	t.Logf("INTG-046: RestHero ok hero_id=%d march_force=%d march_force_max=%d rest_force_l11_hint=client_derived",
		heroID, restOut.GetMarchForce(), restOut.GetMarchForceMax())

	detailFull := smokeINTG046GetHeroDetail(t, c, sid, heroID)
	forceBeforeMarch := detailFull.GetMarchForce()

	smokeStep(t, fmt.Sprintf("INTG-046 L11: gateway StartMarch deduct force hero_id=%d", heroID))
	marchResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i46-march-force-deduct", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 46, ToY: 47, Purpose: 1, HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5}},
		}),
	})
	if marchResp.Code != 0 {
		intg046Failf(t, "start march deduct force", "hero_id=%d code=%d msg=%s", heroID, marchResp.Code, marchResp.Msg)
	}
	var marchOut militaryv1.StartMarchResponse
	if err := proto.Unmarshal(marchResp.Data, &marchOut); err != nil {
		intg046Failf(t, "decode start march", "err=%v", err)
	}
	detailMarching := smokeINTG046GetHeroDetail(t, c, sid, heroID)
	wantAfter := forceBeforeMarch - hero.MarchForceMarchCost
	if detailMarching.GetMarchForce() != wantAfter {
		intg046Failf(t, "march force deducted", "hero_id=%d before=%d after=%d want=%d",
			heroID, forceBeforeMarch, detailMarching.GetMarchForce(), wantAfter)
	}
	t.Logf("INTG-046: StartMarch force deduct hero_id=%d march_force=%d delta=%d march_force_deduct_l11_hint=client_derived",
		heroID, detailMarching.GetMarchForce(), hero.MarchForceMarchCost)

	smokeStep(t, fmt.Sprintf("INTG-046 L11: gateway RestHero reject non-idle hero_id=%d", heroID))
	restBusyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRestHero, TraceId: "i46-rest-busy", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RestHeroRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if restBusyResp.Code == 0 {
		intg046Failf(t, "rest hero non-idle", "expected reject hero_id=%d", heroID)
	}
	t.Logf("INTG-046: RestHero non-idle reject hero_id=%d code=%d msg=%s rest_busy_l11_hint=client_derived",
		heroID, restBusyResp.Code, restBusyResp.Msg)

	arriveMs := marchOut.GetMarch().GetArriveAtMs()
	if arriveMs == 0 {
		arriveMs = smokeINTG044FirstMarchArriveMs(t, c, sid, cityID)
	}
	smokeINTG044FastFinishMarch(t, apiSrv, arriveMs)
}

func smokeINTG046GetHeroDetail(t *testing.T, c *websocket.Conn, sid string, heroID int64) *herov1.GetHeroDetailResponse {
	t.Helper()
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetHeroDetail, TraceId: fmt.Sprintf("i46-detail-%d", heroID), SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.GetHeroDetailRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if resp.Code != 0 {
		intg046Failf(t, "get hero detail", "hero_id=%d code=%d msg=%s", heroID, resp.Code, resp.Msg)
	}
	var out herov1.GetHeroDetailResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg046Failf(t, "decode get hero detail", "err=%v", err)
	}
	return &out
}

func smokeINTG046RecruitDedicatedHero(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) int64 {
	t.Helper()
	heroID := smokeINTG044RecruitAdditionalHero(t, ctx, c, apiSrv, sid, playerID)
	if heroID == 0 {
		return 0
	}
	h, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h == nil {
		return heroID
	}
	if h.Status != hero.StatusIdle {
		h.Status = hero.StatusIdle
		_ = apiSrv.HeroService().Store.SaveHero(ctx, h)
	}
	return heroID
}

func smokeINTG046SetHeroLevel(t *testing.T, ctx context.Context, apiSrv *api.Server, heroID int64, level int32) {
	t.Helper()
	svc := apiSrv.HeroService()
	if svc == nil {
		return
	}
	h, err := svc.Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h == nil {
		intg046Failf(t, "set hero level load", "hero_id=%d err=%v", heroID, err)
	}
	tpl, ok := svc.Catalog[h.TemplateCfgID]
	if !ok {
		intg046Failf(t, "set hero level template", "template_cfg_id=%d", h.TemplateCfgID)
	}
	h.Level = level
	h.PoliticsAdd, h.ForceAdd, h.IntelAdd = 0, 0, 0
	hero.ApplyStatsForLevel(h, tpl, level)
	if err := svc.Store.SaveHero(ctx, h); err != nil {
		intg046Failf(t, "set hero level save", "err=%v", err)
	}
}

func smokeINTG046OwnedTemplateHero(t *testing.T, ctx context.Context, apiSrv *api.Server, playerID int64, heroID int64) (*hero.Hero, hero.Template, error) {
	t.Helper()
	svc := apiSrv.HeroService()
	h, err := svc.Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h == nil || h.PlayerID != playerID {
		return nil, hero.Template{}, hero.ErrHeroNotFound
	}
	tpl, ok := svc.Catalog[h.TemplateCfgID]
	if !ok {
		return nil, hero.Template{}, hero.ErrUnknownTemplate
	}
	return h, tpl, nil
}

func smokeINTG046GrantExprGold(t *testing.T, ctx context.Context, apiSrv *api.Server, playerID int64) {
	t.Helper()
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg046-expr", TicketID: "T-i46-expr"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Resources: map[string]int64{"gold": 500_000},
	}, "intg046-expr-gold")
	if err != nil {
		intg046Failf(t, "gm grant expr gold", "err=%v", err)
	}
}

func intg046Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG046CfgHint, step, fmt.Sprintf(format, args...))
}
