package api_test

import (
	"context"
	"fmt"
	"strings"
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

const smokeINTG044CfgHint = smokeINTG043CfgHint + "; INTG-044: L1 ListHotelRecruitCandidates+optional refresh/recruit; L2 StartMarch hero_id required+busy+idle restore; L3 LargessHero loyalty+cooldown; L4 UpgradeHero+GetHeroDetail exp; L5 SetCityChief/GetCityChief/ClearCityChief"

// TestINTG044HeroL1L5SmokePath extends INTG-043 with hero L1–L5 gateway hints (issue #1194).
func TestINTG044HeroL1L5SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-044 hero L1–L5 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG044HeroL1L5Smoke(t)
}

func runINTG044HeroL1L5Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG044BeforeRestartGateway)
}

func smokeINTG044BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG043Wave46BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	smokeINTG044L1HotelGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG044L2MarchHeroGateway(t, ctx, c, apiSrv, sid, playerID, cityID)
	smokeINTG044L3LargessGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG044L4UpgradeGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG044L5CityChiefGateway(t, ctx, c, apiSrv, sid, playerID, cityID)
}

func smokeINTG044L1HotelGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	if cityID == 0 {
		t.Logf("INTG-044: skip ListHotelRecruitCandidates (no city_id; hint CreateCity — see tools/smoke/README.md)")
		return
	}
	smokeINTG044SeedHotelBuildings(t, ctx, pool, cityID)
	smokeStep(t, fmt.Sprintf("INTG-044 L1: gateway ListHotelRecruitCandidates city_id=%d", cityID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListHotelRecruitCandidates, TraceId: "i44-hotel-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListHotelRecruitCandidatesRequest{ServerId: intg006ServerID, CityId: cityID}),
	})
	if resp.Code != 0 {
		if containsAny(resp.Msg, "hotel", "客栈", "not built") {
			t.Logf("INTG-044: skip ListHotelRecruitCandidates (code=%d msg=%s; hint build hotel slot building_cfg_id=8 — see tools/smoke/README.md)", resp.Code, resp.Msg)
			return
		}
		intg044Failf(t, "list hotel candidates", "city_id=%d code=%d msg=%s", cityID, resp.Code, resp.Msg)
	}
	var out herov1.ListHotelRecruitCandidatesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg044Failf(t, "decode list hotel candidates", "city_id=%d err=%v", cityID, err)
	}
	t.Logf("INTG-044: ListHotelRecruitCandidates city_id=%d candidates_len=%d hotel_level=%d hero_capacity=%d hero_owned=%d hotel_pool_l1_hint=client_derived",
		cityID, len(out.GetCandidates()), out.GetHotelLevel(), out.GetHeroCapacity(), out.GetHeroOwned())
	if out.GetHotelLevel() < 1 {
		t.Logf("INTG-044: skip hotel refresh/recruit optional (hotel_level=%d; hint upgrade hotel — see tools/smoke/README.md)", out.GetHotelLevel())
		return
	}
	smokeINTG044OptionalHotelRefreshRecruit(t, ctx, c, apiSrv, sid, playerID, cityID, out.GetCandidates())
}

func smokeINTG044OptionalHotelRefreshRecruit(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64, cityID int64, candidates []*herov1.HotelRecruitCandidate) {
	t.Helper()
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg044-hotel", TicketID: "T-i44-hotel"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Resources: map[string]int64{"gold": 500000},
		Items:     []content.RewardItem{{ItemCfgID: hero.HotelRefreshItemCfgID, Qty: 2}},
	}, "intg044-hotel-gold")
	if err != nil {
		t.Logf("INTG-044: skip RefreshHotelRecruitPool optional (gm grant err=%v — see tools/smoke/README.md)", err)
		return
	}
	refreshResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRefreshHotelRecruitPool, TraceId: "i44-hotel-refresh", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RefreshHotelRecruitPoolRequest{ServerId: intg006ServerID, CityId: cityID}),
	})
	if refreshResp.Code != 0 {
		t.Logf("INTG-044: RefreshHotelRecruitPool optional code=%d msg=%s (hint capacity/gold/item — see tools/smoke/README.md)", refreshResp.Code, refreshResp.Msg)
	} else {
		var refreshOut herov1.RefreshHotelRecruitPoolResponse
		if err := proto.Unmarshal(refreshResp.Data, &refreshOut); err == nil {
			t.Logf("INTG-044: RefreshHotelRecruitPool ok candidates_len=%d refresh_pool_l1_hint=client_derived", len(refreshOut.GetCandidates()))
			candidates = refreshOut.GetCandidates()
		}
	}
	if len(candidates) < 1 {
		listResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteListHotelRecruitCandidates, TraceId: "i44-hotel-relist", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&herov1.ListHotelRecruitCandidatesRequest{ServerId: intg006ServerID, CityId: cityID}),
		})
		if listResp.Code == 0 {
			var listOut herov1.ListHotelRecruitCandidatesResponse
			if err := proto.Unmarshal(listResp.Data, &listOut); err == nil {
				candidates = listOut.GetCandidates()
			}
		}
	}
	if len(candidates) < 1 {
		t.Logf("INTG-044: skip RecruitHotelCandidate optional (empty pool; hint RefreshHotelRecruitPool — see tools/smoke/README.md)")
		return
	}
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitHotelCandidate, TraceId: "i44-hotel-recruit", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RecruitHotelCandidateRequest{
			ServerId: intg006ServerID, CityId: cityID, CandidateId: candidates[0].GetCandidateId(),
		}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-044: RecruitHotelCandidate optional code=%d msg=%s (hint hero_capacity/gold — see tools/smoke/README.md)", recruitResp.Code, recruitResp.Msg)
		return
	}
	var recruitOut herov1.RecruitHotelCandidateResponse
	if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
		intg044Failf(t, "decode recruit hotel candidate", "err=%v", err)
	}
	t.Logf("INTG-044: RecruitHotelCandidate ok hero_id=%d level=%d loyalty=%d recruit_hotel_l1_hint=client_derived",
		recruitOut.GetHeroId(), recruitOut.GetLevel(), recruitOut.GetLoyalty())
}

func smokeINTG044L2MarchHeroGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64, cityID int64) {
	t.Helper()
	if cityID == 0 {
		t.Logf("INTG-044: skip StartMarch hero_id paths (no city_id — see tools/smoke/README.md)")
		return
	}
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 40)
	smokeStep(t, "INTG-044 L2: gateway StartMarch reject missing hero_id")
	missingResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i44-march-no-hero", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 20, ToY: 21, Purpose: 1,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5}},
		}),
	})
	if missingResp.Code == 0 {
		intg044Failf(t, "start march without hero_id", "expected error code got ok")
	}
	t.Logf("INTG-044: StartMarch missing hero_id reject code=%d msg=%s march_hero_required_l2_hint=client_derived", missingResp.Code, missingResp.Msg)

	heroID := smokeEnsureMarchHeroID(t, ctx, c, apiSrv, sid, playerID)
	busyResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i44-march-busy", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: 22, ToY: 23, Purpose: 1, HeroId: heroID,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 5}},
		}),
	})
	if busyResp.Code == 0 {
		intg044Failf(t, "start march non-idle hero", "hero_id=%d expected busy reject", heroID)
	}
	t.Logf("INTG-044: StartMarch non-idle hero reject hero_id=%d code=%d msg=%s march_busy_l2_hint=client_derived", heroID, busyResp.Code, busyResp.Msg)

	h, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h == nil {
		intg044Failf(t, "hero status marching", "hero_id=%d err=%v", heroID, err)
	}
	if h.Status != hero.StatusMarch {
		intg044Failf(t, "hero status marching", "hero_id=%d status=%d want=%d", heroID, h.Status, hero.StatusMarch)
	}
	t.Logf("INTG-044: StartMarch success hero_id=%d status=marching(%d) march_status_l2_hint=client_derived", heroID, h.Status)

	arriveMs := smokeINTG044FirstMarchArriveMs(t, c, sid, cityID)
	smokeINTG044FastFinishMarch(t, apiSrv, arriveMs)
	h2, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h2 == nil {
		intg044Failf(t, "hero idle after march", "hero_id=%d err=%v", heroID, err)
	}
	if h2.Status != hero.StatusIdle {
		intg044Failf(t, "hero idle after march", "hero_id=%d status=%d want idle", heroID, h2.Status)
	}
	t.Logf("INTG-044: march finished hero_id=%d status=idle(%d) hub_finished_handler_l2_hint=client_derived", heroID, h2.Status)
}

func smokeINTG044L3LargessGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) {
	t.Helper()
	heroID := smokeINTG044PickHeroForLargess(t, ctx, c, apiSrv, sid, playerID)
	if heroID == 0 {
		t.Logf("INTG-044: skip LargessHero (no hero_id; hint RecruitHero — see tools/smoke/README.md)")
		return
	}
	h, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h == nil {
		t.Logf("INTG-044: skip LargessHero (hero load err=%v — see tools/smoke/README.md)", err)
		return
	}
	if h.Loyalty >= hero.LoyaltyMax-5 {
		if err := apiSrv.HeroService().SetHeroLoyalty(ctx, h, 30); err != nil {
			t.Logf("INTG-044: skip LargessHero (set loyalty err=%v — see tools/smoke/README.md)", err)
			return
		}
	}
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg044-largess", TicketID: "T-i44-largess"}
	_, _, grantErr := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Resources: map[string]int64{"gold": 100000},
	}, "intg044-largess-gold")
	if grantErr != nil {
		t.Logf("INTG-044: skip LargessHero (wallet grant err=%v — see tools/smoke/README.md)", grantErr)
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-044 L3: gateway LargessHero gold hero_id=%d", heroID))
	largessResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteLargessHero, TraceId: "i44-largess", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.LargessHeroRequest{
			ServerId: intg006ServerID, HeroId: heroID, GiftKind: herov1.LargessGiftKind_LARGESS_GIFT_GOLD,
		}),
	})
	if largessResp.Code != 0 {
		t.Logf("INTG-044: skip LargessHero success path (code=%d msg=%s; hint gold/loyalty — see tools/smoke/README.md)", largessResp.Code, largessResp.Msg)
		return
	}
	var largessOut herov1.LargessHeroResponse
	if err := proto.Unmarshal(largessResp.Data, &largessOut); err != nil {
		intg044Failf(t, "decode largess hero", "err=%v", err)
	}
	t.Logf("INTG-044: LargessHero hero_id=%d loyalty=%d loyalty_delta=%d gold_spent=%d next_largess_at_ms=%d largess_l3_hint=client_derived",
		largessOut.GetHeroId(), largessOut.GetLoyalty(), largessOut.GetLoyaltyDelta(), largessOut.GetGoldSpent(), largessOut.GetNextLargessAtMs())

	cdResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteLargessHero, TraceId: "i44-largess-cd", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.LargessHeroRequest{
			ServerId: intg006ServerID, HeroId: heroID, GiftKind: herov1.LargessGiftKind_LARGESS_GIFT_GOLD,
		}),
	})
	if cdResp.Code == 0 {
		intg044Failf(t, "largess cooldown", "expected cooldown reject hero_id=%d", heroID)
	}
	t.Logf("INTG-044: LargessHero cooldown reject hero_id=%d code=%d msg=%s largess_cooldown_l3_hint=client_derived", heroID, cdResp.Code, cdResp.Msg)
}

func smokeINTG044L4UpgradeGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) {
	t.Helper()
	heroID := smokeINTG044RecruitAdditionalHero(t, ctx, c, apiSrv, sid, playerID)
	if heroID == 0 {
		t.Logf("INTG-044: skip UpgradeHero (no recruitable hero — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-044 L4: gateway GetHeroDetail exp fields hero_id=%d", heroID))
	detailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetHeroDetail, TraceId: "i44-detail-exp", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.GetHeroDetailRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if detailResp.Code != 0 {
		intg044Failf(t, "get hero detail exp", "hero_id=%d code=%d msg=%s", heroID, detailResp.Code, detailResp.Msg)
	}
	var detailOut herov1.GetHeroDetailResponse
	if err := proto.Unmarshal(detailResp.Data, &detailOut); err != nil {
		intg044Failf(t, "decode hero detail exp", "hero_id=%d err=%v", heroID, err)
	}
	if detailOut.GetLevel() > hero.MaxLevelM1 {
		intg044Failf(t, "get hero detail level cap", "hero_id=%d level=%d max=%d", heroID, detailOut.GetLevel(), hero.MaxLevelM1)
	}
	t.Logf("INTG-044: GetHeroDetail hero_id=%d level=%d exp=%d exp_toward_next=%d upgrade_exp_required=%d hero_detail_exp_l4_hint=client_derived",
		heroID, detailOut.GetLevel(), detailOut.GetExp(), detailOut.GetExpTowardNext(), detailOut.GetUpgradeExpRequired())

	failResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteUpgradeHero, TraceId: "i44-upgrade-fail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.UpgradeHeroRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if failResp.Code == 0 {
		var failOut herov1.UpgradeHeroResponse
		if err := proto.Unmarshal(failResp.Data, &failOut); err == nil && failOut.GetPreviousLevel() == failOut.GetLevel() {
			t.Logf("INTG-044: UpgradeHero insufficient exp noop hero_id=%d level=%d upgrade_reject_l4_hint=client_derived", heroID, failOut.GetLevel())
		}
	} else {
		t.Logf("INTG-044: UpgradeHero insufficient exp reject hero_id=%d code=%d msg=%s upgrade_reject_l4_hint=client_derived", heroID, failResp.Code, failResp.Msg)
	}

	h, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h == nil {
		intg044Failf(t, "seed hero exp", "hero_id=%d err=%v", heroID, err)
	}
	prevLevel := h.Level
	h.Exp = 500
	if err := apiSrv.HeroService().Store.SaveHero(ctx, h); err != nil {
		intg044Failf(t, "seed hero exp", "hero_id=%d err=%v", heroID, err)
	}
	upResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteUpgradeHero, TraceId: "i44-upgrade-ok", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.UpgradeHeroRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if upResp.Code != 0 {
		t.Logf("INTG-044: skip UpgradeHero success (code=%d msg=%s; hint exp table — see tools/smoke/README.md)", upResp.Code, upResp.Msg)
		return
	}
	var upOut herov1.UpgradeHeroResponse
	if err := proto.Unmarshal(upResp.Data, &upOut); err != nil {
		intg044Failf(t, "decode upgrade hero", "err=%v", err)
	}
	if upOut.GetLevel() != prevLevel+1 {
		intg044Failf(t, "upgrade hero level", "hero_id=%d prev=%d got=%d", heroID, prevLevel, upOut.GetLevel())
	}
	t.Logf("INTG-044: UpgradeHero ok hero_id=%d previous_level=%d level=%d exp=%d upgrade_success_l4_hint=client_derived",
		heroID, upOut.GetPreviousLevel(), upOut.GetLevel(), upOut.GetExp())
}

func smokeINTG044L5CityChiefGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64, cityID int64) {
	t.Helper()
	if cityID == 0 {
		t.Logf("INTG-044: skip city chief office (no city_id — see tools/smoke/README.md)")
		return
	}
	chiefHero := smokeINTG044RecruitAdditionalHero(t, ctx, c, apiSrv, sid, playerID)
	if chiefHero == 0 {
		t.Logf("INTG-044: skip SetCityChief (no idle hero — see tools/smoke/README.md)")
		return
	}
	marchHero := smokeINTG044RecruitAdditionalHero(t, ctx, c, apiSrv, sid, playerID)
	if marchHero != 0 && marchHero != chiefHero {
		apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 30)
		marchResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteStartMarch, TraceId: "i44-chief-march", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&militaryv1.StartMarchRequest{
				CityId: cityID, ToX: 30, ToY: 31, Purpose: 1, HeroId: marchHero,
				Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 8}},
			}),
		})
		if marchResp.Code == 0 {
			chiefWhileMarch := mustSend(t, c, &commonv1.ClientPacket{
				Route: api.RouteSetCityChief, TraceId: "i44-chief-busy", SessionId: sid, ServerId: intg006ServerID,
				Payload: mustMarshal(&herov1.SetCityChiefRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: marchHero}),
			})
			if chiefWhileMarch.Code == 0 {
				intg044Failf(t, "set city chief while marching", "hero_id=%d expected reject", marchHero)
			}
			t.Logf("INTG-044: SetCityChief marching reject hero_id=%d code=%d msg=%s office_busy_l5_hint=client_derived", marchHero, chiefWhileMarch.Code, chiefWhileMarch.Msg)
			var marchOut militaryv1.StartMarchResponse
			if err := proto.Unmarshal(marchResp.Data, &marchOut); err == nil && marchOut.GetMarch().GetArriveAtMs() > 0 {
				smokeINTG044FastFinishMarch(t, apiSrv, marchOut.GetMarch().GetArriveAtMs())
			}
		}
	}

	smokeStep(t, fmt.Sprintf("INTG-044 L5: gateway SetCityChief/GetCityChief/ClearCityChief city_id=%d hero_id=%d", cityID, chiefHero))
	setResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteSetCityChief, TraceId: "i44-chief-set", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.SetCityChiefRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: chiefHero}),
	})
	if setResp.Code != 0 {
		t.Logf("INTG-044: skip city chief office (SetCityChief code=%d msg=%s — see tools/smoke/README.md)", setResp.Code, setResp.Msg)
		return
	}
	var setOut herov1.SetCityChiefResponse
	if err := proto.Unmarshal(setResp.Data, &setOut); err != nil {
		intg044Failf(t, "decode set city chief", "err=%v", err)
	}
	t.Logf("INTG-044: SetCityChief city_id=%d hero_id=%d production_bonus=%v one_chief_per_city_l5_hint=client_derived",
		setOut.GetCityId(), setOut.GetHeroId(), setOut.GetProductionBonus())

	getResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetCityChief, TraceId: "i44-chief-get", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.GetCityChiefRequest{ServerId: intg006ServerID, CityId: cityID}),
	})
	if getResp.Code != 0 {
		intg044Failf(t, "get city chief", "city_id=%d code=%d msg=%s", cityID, getResp.Code, getResp.Msg)
	}
	var getOut herov1.GetCityChiefResponse
	if err := proto.Unmarshal(getResp.Data, &getOut); err != nil {
		intg044Failf(t, "decode get city chief", "err=%v", err)
	}
	if getOut.GetHeroId() != chiefHero {
		intg044Failf(t, "get city chief", "city_id=%d want hero_id=%d got=%d", cityID, chiefHero, getOut.GetHeroId())
	}
	t.Logf("INTG-044: GetCityChief city_id=%d hero_id=%d loyalty=%d get_chief_l5_hint=client_derived", getOut.GetCityId(), getOut.GetHeroId(), getOut.GetLoyalty())

	replaceHero := smokeINTG044RecruitAdditionalHero(t, ctx, c, apiSrv, sid, playerID)
	if replaceHero != 0 && replaceHero != chiefHero {
		repResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteSetCityChief, TraceId: "i44-chief-replace", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&herov1.SetCityChiefRequest{ServerId: intg006ServerID, CityId: cityID, HeroId: replaceHero}),
		})
		if repResp.Code == 0 {
			t.Logf("INTG-044: SetCityChief replace city_id=%d new_hero_id=%d one_chief_per_city_l5_hint=client_derived", cityID, replaceHero)
			chiefHero = replaceHero
		}
	}

	clearResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClearCityChief, TraceId: "i44-chief-clear", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ClearCityChiefRequest{ServerId: intg006ServerID, CityId: cityID}),
	})
	if clearResp.Code != 0 {
		intg044Failf(t, "clear city chief", "city_id=%d code=%d msg=%s", cityID, clearResp.Code, clearResp.Msg)
	}
	h, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, chiefHero)
	if err != nil || h == nil {
		intg044Failf(t, "chief idle after clear", "hero_id=%d err=%v", chiefHero, err)
	}
	if h.Status != hero.StatusIdle {
		intg044Failf(t, "chief idle after clear", "hero_id=%d status=%d want idle", chiefHero, h.Status)
	}
	t.Logf("INTG-044: ClearCityChief city_id=%d hero_id=%d status=idle(%d) clear_office_l5_hint=client_derived", cityID, chiefHero, h.Status)
}

func smokeINTG044SeedHotelBuildings(t *testing.T, ctx context.Context, pool *pgxpool.Pool, cityID int64) {
	t.Helper()
	_, err := pool.Exec(ctx, `
		INSERT INTO city_building (server_id, city_id, slot_key, building_cfg_id, level)
		VALUES ($1,$2,'hotel',8,2), ($1,$2,'hall',1,3)
		ON CONFLICT (server_id, city_id, slot_key) DO UPDATE SET building_cfg_id = EXCLUDED.building_cfg_id, level = GREATEST(city_building.level, EXCLUDED.level)`,
		intg006ServerID, cityID)
	if err != nil {
		t.Logf("INTG-044: hotel seed optional err=%v (ListHotel may skip — see tools/smoke/README.md)", err)
	}
}

func smokeINTG044FirstMarchArriveMs(t *testing.T, c *websocket.Conn, sid string, cityID int64) int64 {
	t.Helper()
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i44-march-arrive", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 5}),
	})
	if listResp.Code != 0 {
		return 0
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil || len(listOut.GetMarches()) == 0 {
		return 0
	}
	return listOut.GetMarches()[0].GetArriveAtMs()
}

func smokeINTG044FastFinishMarch(t *testing.T, apiSrv *api.Server, arriveAtMs int64) {
	t.Helper()
	if arriveAtMs <= 0 {
		t.Logf("INTG-044: skip march fast-forward (no arrive_at_ms; hint ListMarches — see tools/smoke/README.md)")
		return
	}
	apiSrv.AdvanceSmokeTimeTo(time.UnixMilli(arriveAtMs).Add(3 * time.Second))
	for i := 0; i < 8; i++ {
		apiSrv.TickMilitaryForTest()
	}
}

func smokeINTG044RecruitAdditionalHero(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) int64 {
	t.Helper()
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg044-hero", TicketID: "T-i44-hero"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 2}},
		Resources: map[string]int64{
			"food": 50000, "wood": 50000, "iron": 50000, "stone": 50000,
		},
	}, "intg044-recruit-extra")
	if err != nil {
		return 0
	}
	for tpl := smokeHeroTemplateCfgID; tpl < smokeHeroTemplateCfgID+20; tpl++ {
		recruitResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteRecruitHero, TraceId: fmt.Sprintf("i44-recruit-extra-%d", tpl), SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&herov1.RecruitHeroRequest{ServerId: intg006ServerID, TemplateCfgId: tpl}),
		})
		if recruitResp.Code != 0 {
			continue
		}
		var recruitOut herov1.RecruitHeroResponse
		if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
			continue
		}
		if recruitOut.GetHeroId() > 0 {
			return recruitOut.GetHeroId()
		}
	}
	return 0
}

func smokeINTG044RecruitTemplateHero(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) int64 {
	t.Helper()
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i44-hero-pick", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code == 0 {
		var listOut herov1.ListPlayerHeroesResponse
		if err := proto.Unmarshal(listResp.Data, &listOut); err == nil {
			for _, row := range listOut.GetHeroes() {
				if row.GetHeroId() <= 0 {
					continue
				}
				h, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, row.GetHeroId())
				if err != nil || h == nil || h.Status != hero.StatusIdle {
					continue
				}
				return row.GetHeroId()
			}
		}
	}
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg044-hero", TicketID: "T-i44-hero"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 3}},
		Resources: map[string]int64{
			"food": 50000, "wood": 50000, "iron": 50000, "stone": 50000,
		},
	}, "intg044-recruit")
	if err != nil {
		return 0
	}
	for tpl := smokeHeroTemplateCfgID; tpl < smokeHeroTemplateCfgID+12; tpl++ {
		recruitResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteRecruitHero, TraceId: fmt.Sprintf("i44-recruit-%d", tpl), SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&herov1.RecruitHeroRequest{ServerId: intg006ServerID, TemplateCfgId: tpl}),
		})
		if recruitResp.Code != 0 {
			continue
		}
		var recruitOut herov1.RecruitHeroResponse
		if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
			continue
		}
		if recruitOut.GetHeroId() > 0 {
			return recruitOut.GetHeroId()
		}
	}
	return 0
}

func smokeINTG044PickHeroForLargess(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) int64 {
	t.Helper()
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i44-largess-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		return smokeINTG044RecruitTemplateHero(t, ctx, c, apiSrv, sid, playerID)
	}
	var listOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		return 0
	}
	for _, row := range listOut.GetHeroes() {
		if row.GetHeroId() <= 0 {
			continue
		}
		h, err := apiSrv.HeroService().Store.GetHero(ctx, intg006ServerID, row.GetHeroId())
		if err != nil || h == nil || h.Status != hero.StatusIdle {
			continue
		}
		return row.GetHeroId()
	}
	return smokeINTG044RecruitTemplateHero(t, ctx, c, apiSrv, sid, playerID)
}

func containsAny(s string, subs ...string) bool {
	low := strings.ToLower(s)
	for _, sub := range subs {
		if strings.Contains(low, strings.ToLower(sub)) {
			return true
		}
	}
	return false
}

func intg044Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG044CfgHint, step, fmt.Sprintf(format, args...))
}
