package api_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG045CfgHint = smokeINTG044CfgHint + "; INTG-045: L6 ListCaptive+Try/SureSummon+Release; L7 ListComing+Try/SureAccept+Reject; L8 ListPersuade+Persuade/Lionize"

// TestINTG045HeroL6L8SmokePath extends INTG-044 with captive / coming / persuade gateway hints (issue #1218).
func TestINTG045HeroL6L8SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-045 hero L6–L8 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG045HeroL6L8Smoke(t)
}

func runINTG045HeroL6L8Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG045BeforeRestartGateway)
}

func smokeINTG045BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG044BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-045: skip L6–L8 (no city_id — see tools/smoke/README.md)")
		return
	}
	smokeINTG045EnsureHallHeadroom(t, ctx, pool, cityID)
	smokeINTG045L6CaptiveGateway(t, ctx, c, apiSrv, sid, playerID, cityID)
	smokeINTG045L7ComingGateway(t, ctx, c, apiSrv, sid, playerID, cityID)
	smokeINTG045L8PersuadeGateway(t, ctx, c, apiSrv, sid, playerID, cityID)
}

func smokeINTG045EnsureHallHeadroom(t *testing.T, ctx context.Context, pool *pgxpool.Pool, cityID int64) {
	t.Helper()
	smokeINTG044SeedHotelBuildings(t, ctx, pool, cityID)
	_, err := pool.Exec(ctx, `
		UPDATE city_building SET level = GREATEST(level, 20)
		WHERE server_id = $1 AND city_id = $2 AND slot_key = 'hall'`,
		intg006ServerID, cityID)
	if err != nil {
		t.Logf("INTG-045: hall headroom seed optional err=%v", err)
	}
}

func smokeINTG045L6CaptiveGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64, cityID int64) {
	t.Helper()
	heroSvc := apiSrv.HeroService()
	if heroSvc == nil || heroSvc.CaptiveStore == nil {
		t.Logf("INTG-045: skip L6 captive (store missing)")
		return
	}
	p := hero.PlayerRef{ServerID: intg006ServerID, PlayerID: playerID}
	summonH, err := heroSvc.InjectCaptive(ctx, p, hero.InjectCaptiveInput{
		CityID: cityID, DisplayName: "冒烟俘A", Level: 10,
		Force: 70, Intel: 60, Politics: 50, Command: 55,
	})
	if err != nil {
		intg045Failf(t, "inject captive summon", "err=%v", err)
	}
	releaseH, err := heroSvc.InjectCaptive(ctx, p, hero.InjectCaptiveInput{
		CityID: cityID, DisplayName: "冒烟俘B", Level: 8,
		Force: 65, Intel: 55, Politics: 45, Command: 50,
	})
	if err != nil {
		intg045Failf(t, "inject captive release", "err=%v", err)
	}

	smokeStep(t, "INTG-045 L6: gateway ListCaptiveHeroes")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListCaptiveHeroes, TraceId: "i45-cap-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListCaptiveHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		intg045Failf(t, "list captives", "code=%d msg=%s", listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListCaptiveHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg045Failf(t, "decode list captives", "err=%v", err)
	}
	t.Logf("INTG-045: ListCaptiveHeroes captives_len=%d captive_list_l6_hint=client_derived", len(listOut.GetCaptives()))

	smokeStep(t, fmt.Sprintf("INTG-045 L6: gateway TrySummonCaptive reject city mismatch hero_id=%d", summonH.HeroID))
	badCityResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteTrySummonCaptive, TraceId: "i45-cap-try-bad-city", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.TrySummonCaptiveRequest{ServerId: intg006ServerID, CityId: cityID + 999_999, HeroId: summonH.HeroID}),
	})
	if badCityResp.Code == 0 {
		intg045Failf(t, "try summon captive city mismatch", "expected reject hero_id=%d", summonH.HeroID)
	}
	t.Logf("INTG-045: TrySummonCaptive city mismatch reject hero_id=%d code=%d msg=%s captive_city_l6_hint=client_derived",
		summonH.HeroID, badCityResp.Code, badCityResp.Msg)

	smokeStep(t, fmt.Sprintf("INTG-045 L6: gateway TrySummonCaptive hero_id=%d", summonH.HeroID))
	tryResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteTrySummonCaptive, TraceId: "i45-cap-try", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.TrySummonCaptiveRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: summonH.HeroID}),
	})
	if tryResp.Code != 0 {
		intg045Failf(t, "try summon captive", "hero_id=%d code=%d msg=%s", summonH.HeroID, tryResp.Code, tryResp.Msg)
	}
	var tryOut herov1.TrySummonCaptiveResponse
	if err := proto.Unmarshal(tryResp.Data, &tryOut); err != nil {
		intg045Failf(t, "decode try summon captive", "err=%v", err)
	}
	t.Logf("INTG-045: TrySummonCaptive hero_id=%d gold_cost=%d summary_len=%d try_summon_l6_hint=client_derived",
		summonH.HeroID, tryOut.GetGoldCost(), len(tryOut.GetSummary()))

	smokeINTG045GrantCaptiveSummonWallet(t, ctx, apiSrv, playerID, tryOut.GetGoldCost())

	smokeStep(t, fmt.Sprintf("INTG-045 L6: gateway SureSummonCaptive hero_id=%d", summonH.HeroID))
	sureResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteSureSummonCaptive, TraceId: "i45-cap-sure", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.SureSummonCaptiveRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: summonH.HeroID}),
	})
	if sureResp.Code != 0 {
		intg045Failf(t, "sure summon captive", "hero_id=%d code=%d msg=%s", summonH.HeroID, sureResp.Code, sureResp.Msg)
	}
	var sureOut herov1.SureSummonCaptiveResponse
	if err := proto.Unmarshal(sureResp.Data, &sureOut); err != nil {
		intg045Failf(t, "decode sure summon captive", "err=%v", err)
	}
	t.Logf("INTG-045: SureSummonCaptive ok hero_id=%d level=%d loyalty=%d sure_summon_l6_hint=client_derived",
		sureOut.GetHeroId(), sureOut.GetLevel(), sureOut.GetLoyalty())

	smokeStep(t, fmt.Sprintf("INTG-045 L6: gateway SureSummonCaptive reject not captive hero_id=%d", summonH.HeroID))
	repeatResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteSureSummonCaptive, TraceId: "i45-cap-sure-repeat", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.SureSummonCaptiveRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: summonH.HeroID}),
	})
	if repeatResp.Code == 0 {
		intg045Failf(t, "sure summon not captive", "expected reject hero_id=%d", summonH.HeroID)
	}
	t.Logf("INTG-045: SureSummonCaptive not-captive reject hero_id=%d code=%d msg=%s captive_state_l6_hint=client_derived",
		summonH.HeroID, repeatResp.Code, repeatResp.Msg)

	smokeStep(t, fmt.Sprintf("INTG-045 L6: gateway ReleaseCaptive hero_id=%d", releaseH.HeroID))
	releaseResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteReleaseCaptive, TraceId: "i45-cap-release", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ReleaseCaptiveRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: releaseH.HeroID}),
	})
	if releaseResp.Code != 0 {
		intg045Failf(t, "release captive", "hero_id=%d code=%d msg=%s", releaseH.HeroID, releaseResp.Code, releaseResp.Msg)
	}
	t.Logf("INTG-045: ReleaseCaptive ok hero_id=%d release_captive_l6_hint=client_derived", releaseH.HeroID)
}

func smokeINTG045GrantCaptiveSummonWallet(t *testing.T, ctx context.Context, apiSrv *api.Server, playerID int64, goldNeed int64) {
	t.Helper()
	grantGold := goldNeed + 50_000
	if grantGold < 100_000 {
		grantGold = 100_000
	}
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg045-captive", TicketID: "T-i45-cap"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Resources: map[string]int64{"gold": grantGold},
	}, "intg045-captive-gold")
	if err != nil {
		intg045Failf(t, "gm grant captive summon gold", "err=%v", err)
	}
}

func smokeINTG045L7ComingGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64, cityID int64) {
	t.Helper()
	heroSvc := apiSrv.HeroService()
	if heroSvc == nil || heroSvc.ComingStore == nil {
		t.Logf("INTG-045: skip L7 coming (store missing)")
		return
	}
	p := hero.PlayerRef{ServerID: intg006ServerID, PlayerID: playerID}
	acceptH, err := heroSvc.InjectComing(ctx, p, hero.InjectComingInput{
		CityID: cityID, DisplayName: "来投冒烟A", Level: 11,
		Force: 72, Intel: 62, Politics: 52, Command: 58,
	})
	if err != nil {
		intg045Failf(t, "inject coming accept", "err=%v", err)
	}
	rejectH, err := heroSvc.InjectComing(ctx, p, hero.InjectComingInput{
		CityID: cityID, DisplayName: "来投冒烟B", Level: 9,
		Force: 60, Intel: 50, Politics: 40, Command: 45,
	})
	if err != nil {
		intg045Failf(t, "inject coming reject", "err=%v", err)
	}

	smokeStep(t, "INTG-045 L7: gateway ListComingHeroes")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListComingHeroes, TraceId: "i45-com-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListComingHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		intg045Failf(t, "list coming", "code=%d msg=%s", listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListComingHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg045Failf(t, "decode list coming", "err=%v", err)
	}
	t.Logf("INTG-045: ListComingHeroes coming_len=%d coming_list_l7_hint=client_derived", len(listOut.GetComing()))

	smokeStep(t, fmt.Sprintf("INTG-045 L7: gateway RejectComing hero_id=%d", rejectH.HeroID))
	rejectResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRejectComing, TraceId: "i45-com-reject", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RejectComingRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: rejectH.HeroID}),
	})
	if rejectResp.Code != 0 {
		intg045Failf(t, "reject coming", "hero_id=%d code=%d msg=%s", rejectH.HeroID, rejectResp.Code, rejectResp.Msg)
	}
	t.Logf("INTG-045: RejectComing ok hero_id=%d reject_coming_l7_hint=client_derived", rejectH.HeroID)

	smokeStep(t, fmt.Sprintf("INTG-045 L7: gateway TryAcceptComing reject not coming hero_id=%d", rejectH.HeroID))
	badTryResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteTryAcceptComing, TraceId: "i45-com-try-bad", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.TryAcceptComingRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: rejectH.HeroID}),
	})
	if badTryResp.Code == 0 {
		intg045Failf(t, "try accept not coming", "expected reject hero_id=%d", rejectH.HeroID)
	}
	t.Logf("INTG-045: TryAcceptComing not-coming reject hero_id=%d code=%d msg=%s coming_state_l7_hint=client_derived",
		rejectH.HeroID, badTryResp.Code, badTryResp.Msg)

	smokeStep(t, fmt.Sprintf("INTG-045 L7: gateway TryAcceptComing hero_id=%d", acceptH.HeroID))
	tryResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteTryAcceptComing, TraceId: "i45-com-try", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.TryAcceptComingRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: acceptH.HeroID}),
	})
	if tryResp.Code != 0 {
		intg045Failf(t, "try accept coming", "hero_id=%d code=%d msg=%s", acceptH.HeroID, tryResp.Code, tryResp.Msg)
	}
	var tryOut herov1.TryAcceptComingResponse
	if err := proto.Unmarshal(tryResp.Data, &tryOut); err != nil {
		intg045Failf(t, "decode try accept coming", "err=%v", err)
	}
	t.Logf("INTG-045: TryAcceptComing hero_id=%d summary_len=%d try_accept_l7_hint=client_derived",
		acceptH.HeroID, len(tryOut.GetSummary()))

	smokeStep(t, fmt.Sprintf("INTG-045 L7: gateway SureAcceptComing hero_id=%d", acceptH.HeroID))
	sureResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteSureAcceptComing, TraceId: "i45-com-sure", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.SureAcceptComingRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: acceptH.HeroID}),
	})
	if sureResp.Code != 0 {
		intg045Failf(t, "sure accept coming", "hero_id=%d code=%d msg=%s", acceptH.HeroID, sureResp.Code, sureResp.Msg)
	}
	var sureOut herov1.SureAcceptComingResponse
	if err := proto.Unmarshal(sureResp.Data, &sureOut); err != nil {
		intg045Failf(t, "decode sure accept coming", "err=%v", err)
	}
	t.Logf("INTG-045: SureAcceptComing ok hero_id=%d level=%d loyalty=%d sure_accept_l7_hint=client_derived",
		sureOut.GetHeroId(), sureOut.GetLevel(), sureOut.GetLoyalty())
}

func smokeINTG045L8PersuadeGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64, cityID int64) {
	t.Helper()
	heroSvc := apiSrv.HeroService()
	if heroSvc == nil || heroSvc.LionizeStore == nil {
		t.Logf("INTG-045: skip L8 persuade (store missing)")
		return
	}
	const npcBefriend = int32(1004)
	const npcFail = int32(1003)

	smokeStep(t, "INTG-045 L8: gateway ListPersuadeTargets")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPersuadeTargets, TraceId: "i45-per-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPersuadeTargetsRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		intg045Failf(t, "list persuade targets", "code=%d msg=%s", listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListPersuadeTargetsResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg045Failf(t, "decode list persuade targets", "err=%v", err)
	}
	t.Logf("INTG-045: ListPersuadeTargets targets_len=%d persuade_list_l8_hint=client_derived", len(listOut.GetTargets()))

	smokeStep(t, fmt.Sprintf("INTG-045 L8: gateway PersuadeHero reject not befriended npc_cfg_id=%d", npcFail))
	prePersuadeResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RoutePersuadeHero, TraceId: "i45-per-fail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.PersuadeHeroRequest{ServerId: intg006ServerID, CityId: cityID, NpcCfgId: npcFail}),
	})
	if prePersuadeResp.Code == 0 {
		intg045Failf(t, "persuade without befriending", "expected reject npc_cfg_id=%d", npcFail)
	}
	t.Logf("INTG-045: PersuadeHero not-befriended reject npc_cfg_id=%d code=%d msg=%s persuade_gate_l8_hint=client_derived",
		npcFail, prePersuadeResp.Code, prePersuadeResp.Msg)

	smokeINTG045GrantLionizeGold(t, ctx, apiSrv, playerID)

	smokeStep(t, fmt.Sprintf("INTG-045 L8: gateway LionizeHero befriended npc_cfg_id=%d", npcBefriend))
	befriendResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteLionizeHero, TraceId: "i45-lion-befriend", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.LionizeHeroRequest{ServerId: intg006ServerID, CityId: cityID, NpcCfgId: npcBefriend}),
	})
	if befriendResp.Code != 0 {
		if containsAny(befriendResp.Msg, "already", "owned", "recruited") {
			t.Logf("INTG-045: skip L8 optional (template owned code=%d msg=%s)", befriendResp.Code, befriendResp.Msg)
			return
		}
		intg045Failf(t, "lionize befriended", "npc_cfg_id=%d code=%d msg=%s", npcBefriend, befriendResp.Code, befriendResp.Msg)
	}
	var befriendOut herov1.LionizeHeroResponse
	if err := proto.Unmarshal(befriendResp.Data, &befriendOut); err != nil {
		intg045Failf(t, "decode lionize befriended", "err=%v", err)
	}
	t.Logf("INTG-045: LionizeHero befriended npc_cfg_id=%d friend=%d state=%d lionize_befriend_l8_hint=client_derived",
		npcBefriend, befriendOut.GetFriend(), befriendOut.GetState())

	smokeStep(t, fmt.Sprintf("INTG-045 L8: gateway LionizeHero reject insufficient friend npc_cfg_id=%d", npcBefriend))
	hireEarlyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteLionizeHero, TraceId: "i45-lion-hire-fail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.LionizeHeroRequest{ServerId: intg006ServerID, CityId: cityID, NpcCfgId: npcBefriend}),
	})
	if hireEarlyResp.Code == 0 {
		intg045Failf(t, "lionize hire insufficient friend", "expected reject npc_cfg_id=%d", npcBefriend)
	}
	t.Logf("INTG-045: LionizeHero insufficient-friend reject npc_cfg_id=%d code=%d msg=%s lionize_friend_l8_hint=client_derived",
		npcBefriend, hireEarlyResp.Code, hireEarlyResp.Msg)

	smokeINTG045GrantPersuadeItems(t, ctx, apiSrv, playerID)
	base := time.Now().UTC()
	heroSvc.SetClock(func() time.Time { return base })

	for step := 0; step < 2; step++ {
		heroSvc.SetClock(func() time.Time {
			return base.Add(time.Duration(step+1) * time.Duration(hero.PersuadeCooldownSeconds+1) * time.Second)
		})
		smokeStep(t, fmt.Sprintf("INTG-045 L8: gateway PersuadeHero step=%d npc_cfg_id=%d", step+1, npcBefriend))
		persuadeResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RoutePersuadeHero, TraceId: fmt.Sprintf("i45-per-%d", step), SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&herov1.PersuadeHeroRequest{ServerId: intg006ServerID, CityId: cityID, NpcCfgId: npcBefriend}),
		})
		if persuadeResp.Code != 0 {
			intg045Failf(t, "persuade hero", "npc_cfg_id=%d code=%d msg=%s", npcBefriend, persuadeResp.Code, persuadeResp.Msg)
		}
		var persuadeOut herov1.PersuadeHeroResponse
		if err := proto.Unmarshal(persuadeResp.Data, &persuadeOut); err != nil {
			intg045Failf(t, "decode persuade hero", "err=%v", err)
		}
		t.Logf("INTG-045: PersuadeHero npc_cfg_id=%d friend=%d delta=%d persuade_step_l8_hint=client_derived",
			npcBefriend, persuadeOut.GetFriend(), persuadeOut.GetFriendDelta())
	}

	smokeStep(t, fmt.Sprintf("INTG-045 L8: gateway LionizeHero hire npc_cfg_id=%d", npcBefriend))
	hireResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteLionizeHero, TraceId: "i45-lion-hire", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.LionizeHeroRequest{ServerId: intg006ServerID, CityId: cityID, NpcCfgId: npcBefriend}),
	})
	if hireResp.Code != 0 {
		intg045Failf(t, "lionize hire", "npc_cfg_id=%d code=%d msg=%s", npcBefriend, hireResp.Code, hireResp.Msg)
	}
	var hireOut herov1.LionizeHeroResponse
	if err := proto.Unmarshal(hireResp.Data, &hireOut); err != nil {
		intg045Failf(t, "decode lionize hire", "err=%v", err)
	}
	t.Logf("INTG-045: LionizeHero hire npc_cfg_id=%d hero_id=%d recruited=%v lionize_hire_l8_hint=client_derived",
		npcBefriend, hireOut.GetHeroId(), hireOut.GetRecruited())
}

func smokeINTG045GrantLionizeGold(t *testing.T, ctx context.Context, apiSrv *api.Server, playerID int64) {
	t.Helper()
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg045-lionize", TicketID: "T-i45-lion"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Resources: map[string]int64{"gold": 500_000},
	}, "intg045-lionize-gold")
	if err != nil {
		intg045Failf(t, "gm grant lionize gold", "err=%v", err)
	}
}

func smokeINTG045GrantPersuadeItems(t *testing.T, ctx context.Context, apiSrv *api.Server, playerID int64) {
	t.Helper()
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg045-persuade", TicketID: "T-i45-per"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: hero.PersuadeItemCfgID, Qty: 5}},
	}, "intg045-persuade-items")
	if err != nil {
		intg045Failf(t, "gm grant persuade items", "err=%v", err)
	}
}

func intg045Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG045CfgHint, step, fmt.Sprintf(format, args...))
}
