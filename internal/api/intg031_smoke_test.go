package api_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	accountcommonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG031CfgHint = smokeINTG030CfgHint + "; INTG-031: GetCityState build_queue count+first building_cfg_id/level+production_rates first resource; ListPlayerHeroes count+first hero_id/level; RecruitHero hero_id+currency hint; GetLeaderboard power Top3+my_rank; ListGuildMembers role counts; ListPlayerQuests first claimable quest_id+building_cfg_id hint"

// TestINTG031Wave34SmokePath extends INTG-030 with city queue/HUD, hero list/recruit, leaderboard Top3, guild role counts, and daily claim anchor hints for wave:34 CLIENT readouts.
func TestINTG031Wave34SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-031 wave:34 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG031Wave34Smoke(t)
}

func runINTG031Wave34Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG031Wave34BeforeRestartGateway)
}

func smokeINTG031Wave34BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG030Wave33BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG031GetCityStateBuildQueueProductionGateway(t, c, sid, cityID, playerID)
	smokeINTG031ListPlayerHeroesCountFirstGateway(t, c, sid, playerID)
	smokeINTG031RecruitHeroCurrencyHintGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG031GetLeaderboardPowerTop3MyRankGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG031ListGuildMembersRoleCountsGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG031ListPlayerQuestsFirstClaimableBuildingHintGateway(t, ctx, pool, c, sid, playerID)
}

// smokeINTG031GetCityStateBuildQueueProductionGateway logs active build_queue count, first slot building_cfg_id/level, and first production_rates resource (CLIENT-180/181).
func smokeINTG031GetCityStateBuildQueueProductionGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-031: skip GetCityState build_queue+production_rates (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-031 DOM: gateway GetCityState city_id=%d build_queue+production_rates", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	buildings := st.GetBuildings()
	nowMs := time.Now().UnixMilli()
	var queueCount int
	var firstQueueSlot string
	var firstQueueCfgID int32
	var firstQueueLevel int32
	for _, b := range buildings {
		if b.GetUpgradeFinishAtMs() > nowMs {
			queueCount++
			if firstQueueSlot == "" {
				firstQueueSlot = b.GetSlotKey()
				firstQueueCfgID = b.GetBuildingCfgId()
				firstQueueLevel = b.GetLevel()
			}
		}
	}
	rateHint := smokeINTG031ProductionRatesFirstResourceHint(st.GetProductionRates())
	if queueCount < 1 {
		t.Logf("INTG-031: GetCityState build_queue_count=%d production_rates_first=%s city_id=%d (hint StartBuildingUpgrade for queue slot — see tools/smoke/README.md)",
			queueCount, rateHint, cityID)
	} else {
		t.Logf("INTG-031: GetCityState build_queue_count=%d first_slot_key=%s building_cfg_id=%d level=%d production_rates_first=%s city_id=%d player_id=%d",
			queueCount, firstQueueSlot, firstQueueCfgID, firstQueueLevel, rateHint, cityID, playerID)
	}
}

func smokeINTG031ProductionRatesFirstResourceHint(rates *accountcommonv1.ResourceWallet) string {
	if rates == nil {
		return "production_rates=missing"
	}
	if rates.GetFood() != 0 {
		return fmt.Sprintf("food=%d/h", rates.GetFood())
	}
	if rates.GetWood() != 0 {
		return fmt.Sprintf("wood=%d/h", rates.GetWood())
	}
	if rates.GetIron() != 0 {
		return fmt.Sprintf("iron=%d/h", rates.GetIron())
	}
	if rates.GetStone() != 0 {
		return fmt.Sprintf("stone=%d/h", rates.GetStone())
	}
	return "food=0/h"
}

// smokeINTG031ListPlayerHeroesCountFirstGateway logs hero list count and first hero_id/level (CLIENT-182).
func smokeINTG031ListPlayerHeroesCountFirstGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-031 HERO: gateway ListPlayerHeroes count + first hero_id/level")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i31-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg031Failf(t, "list player heroes", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg031Failf(t, "decode list player heroes", "player_id=%d err=%v", playerID, err)
	}
	total := out.GetTotalCount()
	heroes := out.GetHeroes()
	if len(heroes) < 1 || total < 1 {
		t.Logf("INTG-031: skip ListPlayerHeroes first hero (hero_count=%d; hint hero.v1.RecruitHero — see tools/smoke/README.md)", total)
		return
	}
	first := heroes[0]
	t.Logf("INTG-031: ListPlayerHeroes player_id=%d hero_count=%d first_hero_id=%d first_level=%d",
		playerID, total, first.GetHeroId(), first.GetLevel())
}

// smokeINTG031RecruitHeroCurrencyHintGateway logs RecruitHero hero_id and recruit cost currency hint from ListRecruitTemplates (CLIENT-183); failures are non-fatal.
func smokeINTG031RecruitHeroCurrencyHintGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-031 HERO: gateway ListRecruitTemplates → RecruitHero hero_id+currency hint")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListRecruitTemplates, TraceId: "i31-recruit-tpl", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListRecruitTemplatesRequest{ServerId: intg006ServerID, PageSize: 50}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-031: skip RecruitHero currency hint (ListRecruitTemplates code=%d msg=%s — see tools/smoke/README.md)", listResp.Code, listResp.Msg)
		return
	}
	var tplOut herov1.ListRecruitTemplatesResponse
	if err := proto.Unmarshal(listResp.Data, &tplOut); err != nil {
		t.Logf("INTG-031: skip RecruitHero currency hint (decode templates err=%v)", err)
		return
	}
	var tpl *herov1.RecruitTemplatePreview
	for _, row := range tplOut.GetTemplates() {
		if row.GetTemplateCfgId() == smokeHeroTemplateCfgID {
			tpl = row
			break
		}
	}
	if tpl == nil {
		t.Logf("INTG-031: skip RecruitHero currency hint (template_cfg_id=%d missing; hint DATA-002 cfg_hero_template — see tools/smoke/README.md)", smokeHeroTemplateCfgID)
		return
	}
	currencyHint := smokeINTG031RecruitTemplateCurrencyHint(tpl)

	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-031", TicketID: "T-i31-hero"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 2}},
		Resources: map[string]int64{
			"food": 25000, "wood": 25000, "iron": 25000, "stone": 25000,
		},
	}, "intg-031-hero-seed")
	if err != nil {
		t.Logf("INTG-031: skip RecruitHero (gm grant err=%v; currency_hint=%s)", err, currencyHint)
		return
	}
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitHero, TraceId: "i31-recruit", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RecruitHeroRequest{ServerId: intg006ServerID, TemplateCfgId: smokeHeroTemplateCfgID}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-031: skip RecruitHero (template_cfg_id=%d code=%d msg=%s; currency_hint=%s — see tools/smoke/README.md)",
			smokeHeroTemplateCfgID, recruitResp.Code, recruitResp.Msg, currencyHint)
		return
	}
	var recruitOut herov1.RecruitHeroResponse
	if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
		intg031Failf(t, "decode recruit hero", "player_id=%d err=%v", playerID, err)
	}
	heroID := recruitOut.GetHeroId()
	if heroID == 0 {
		t.Logf("INTG-031: RecruitHero empty hero_id (currency_hint=%s; see tools/smoke/README.md)", currencyHint)
		return
	}
	t.Logf("INTG-031: RecruitHero hero_id=%d template_cfg_id=%d currency_hint=%s player_id=%d",
		heroID, recruitOut.GetTemplateCfgId(), currencyHint, playerID)
}

func smokeINTG031RecruitTemplateCurrencyHint(tpl *herov1.RecruitTemplatePreview) string {
	if tpl == nil {
		return "currency=unspecified"
	}
	parts := make([]string, 0, 5)
	if cost := tpl.GetRecruitCost(); cost != nil {
		if cost.GetFood() > 0 {
			parts = append(parts, fmt.Sprintf("food=%d", cost.GetFood()))
		}
		if cost.GetWood() > 0 {
			parts = append(parts, fmt.Sprintf("wood=%d", cost.GetWood()))
		}
		if cost.GetIron() > 0 {
			parts = append(parts, fmt.Sprintf("iron=%d", cost.GetIron()))
		}
		if cost.GetStone() > 0 {
			parts = append(parts, fmt.Sprintf("stone=%d", cost.GetStone()))
		}
		if cost.GetGold() > 0 {
			parts = append(parts, fmt.Sprintf("gold=%d", cost.GetGold()))
		}
	}
	if item := tpl.GetRecruitItem(); item != nil && item.GetItemCfgId() > 0 {
		parts = append(parts, fmt.Sprintf("item_cfg_id=%d qty=%d", item.GetItemCfgId(), item.GetQuantity()))
	}
	if len(parts) == 0 {
		return "currency=none"
	}
	return strings.Join(parts, " ")
}

// smokeINTG031GetLeaderboardPowerTop3MyRankGateway logs power board Top3 rank/score and my_rank (CLIENT-184).
func smokeINTG031GetLeaderboardPowerTop3MyRankGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-031 RANK: seed power + RefreshRanks + GetLeaderboard PLAYER_POWER Top3+my_rank")
	_, err := pool.Exec(ctx, `UPDATE player SET power = 3400 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg031Failf(t, "seed power for leaderboard", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		intg031Failf(t, "refresh ranks power", "err=%v", err)
	}
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetLeaderboard, TraceId: "i31-rank-power", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
			ServerId: intg006ServerID,
			Type:     rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER,
			Page:     1,
			PageSize: 20,
		}),
	})
	if resp.Code != 0 {
		intg031Failf(t, "get leaderboard power", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg031Failf(t, "decode leaderboard power", "player_id=%d err=%v", playerID, err)
	}
	myRank := out.GetMyRank()
	entries := out.GetEntries()
	if out.GetTotalCount() < 1 || len(entries) < 1 {
		t.Logf("INTG-031: GetLeaderboard PLAYER_POWER Top3 hint only (empty board total=%d my_rank=%d; RefreshRanks — see tools/smoke/README.md)",
			out.GetTotalCount(), myRank)
		return
	}
	topN := len(entries)
	if topN > 3 {
		topN = 3
	}
	var topParts []string
	for i := 0; i < topN; i++ {
		e := entries[i]
		topParts = append(topParts, fmt.Sprintf("rank=%d score=%d", e.GetRank(), e.GetScore()))
	}
	t.Logf("INTG-031: GetLeaderboard PLAYER_POWER Top3=[%s] my_rank=%d total_count=%d viewer_player_id=%d",
		strings.Join(topParts, " "), myRank, out.GetTotalCount(), playerID)
}

// smokeINTG031ListGuildMembersRoleCountsGateway logs per-role member counts when the player is in a guild (CLIENT-185).
func smokeINTG031ListGuildMembersRoleCountsGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	var guildID int64
	err := pool.QueryRow(ctx, `SELECT guild_id FROM guild_member WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) || guildID == 0 {
		t.Logf("INTG-031: skip ListGuildMembers role counts (player not in guild — join guild via guild.v1.CreateGuild or INTG-010 optional social; see tools/smoke/README.md)")
		return
	}
	if err != nil {
		intg031Failf(t, "lookup guild membership", "player_id=%d err=%v", playerID, err)
	}
	smokeStep(t, fmt.Sprintf("INTG-031 GUILD: gateway ListGuildMembers guild_id=%d role counts", guildID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteListGuildMembers, TraceId: "i31-guild-roles", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.ListGuildMembersRequest{
			ServerId: intg006ServerID,
			GuildId:  guildID,
			Page:     1,
			PageSize: 50,
		}),
	})
	if resp.Code != 0 {
		intg031Failf(t, "list guild members", "guild_id=%d player_id=%d code=%d msg=%s", guildID, playerID, resp.Code, resp.Msg)
	}
	var out guildv1.ListGuildMembersResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg031Failf(t, "decode list guild members", "guild_id=%d err=%v", guildID, err)
	}
	members := out.GetMembers()
	if len(members) < 1 {
		intg031Failf(t, "list guild members", "guild_id=%d empty members", guildID)
	}
	roleCounts := make(map[guildv1.GuildMemberRole]int)
	for _, m := range members {
		roleCounts[m.GetRole()]++
	}
	var parts []string
	for role, count := range roleCounts {
		parts = append(parts, fmt.Sprintf("%s=%d", role.String(), count))
	}
	t.Logf("INTG-031: ListGuildMembers guild_id=%d members_count=%d role_counts=[%s]",
		guildID, len(members), strings.Join(parts, " "))
}

// smokeINTG031ListPlayerQuestsFirstClaimableBuildingHintGateway logs first claimable quest_cfg_id and building_cfg_id hint from cfg_quest objectives (CLIENT-186).
func smokeINTG031ListPlayerQuestsFirstClaimableBuildingHintGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-031 QUEST: gateway ListPlayerQuests chain_id=%d first claimable quest_id+building_cfg_id hint", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i31-quests-claim", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          smokeDailyQuestChainID,
			IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg031Failf(t, "list player quests claimable", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg031Failf(t, "decode list player quests claimable", "player_id=%d err=%v", playerID, err)
	}
	var picked *questv1.PlayerQuestProgress
	for _, q := range out.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			picked = q
			break
		}
	}
	if picked == nil {
		t.Logf("INTG-031: skip ListPlayerQuests first claimable (chain_id=%d; hint quest progress hook — see tools/smoke/README.md)", smokeDailyQuestChainID)
		return
	}
	questCfgID := picked.GetQuestCfgId()
	buildingHint := smokeINTG031QuestBuildingCfgIDHint(ctx, pool, questCfgID)
	t.Logf("INTG-031: ListPlayerQuests chain_id=%d quest_id=%d building_cfg_id_hint=%s player_id=%d",
		smokeDailyQuestChainID, questCfgID, buildingHint, playerID)
}

type smokeQuestObjectiveJSON struct {
	Type          string `json:"type"`
	BuildingCfgID int32  `json:"building_cfg_id"`
}

func smokeINTG031QuestBuildingCfgIDHint(ctx context.Context, pool *pgxpool.Pool, questCfgID int32) string {
	if questCfgID <= 0 {
		return "building_cfg_id=0"
	}
	if pool == nil {
		return "building_cfg_id=unknown(no_pg)"
	}
	var objectives []byte
	err := pool.QueryRow(ctx, `SELECT objectives FROM cfg_quest WHERE quest_cfg_id = $1`, questCfgID).Scan(&objectives)
	if err != nil {
		return fmt.Sprintf("building_cfg_id=lookup_err(quest_cfg_id=%d)", questCfgID)
	}
	var rows []smokeQuestObjectiveJSON
	if err := json.Unmarshal(objectives, &rows); err != nil {
		return fmt.Sprintf("building_cfg_id=parse_err(quest_cfg_id=%d)", questCfgID)
	}
	for _, row := range rows {
		if row.BuildingCfgID > 0 {
			return fmt.Sprintf("building_cfg_id=%d objective_type=%s", row.BuildingCfgID, row.Type)
		}
	}
	return "building_cfg_id=none_in_objectives"
}

func intg031Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG031CfgHint, step, fmt.Sprintf(format, args...))
}
