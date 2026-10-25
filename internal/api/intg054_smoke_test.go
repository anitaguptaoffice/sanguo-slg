package api_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG054CfgHint = smokeINTG053CfgHint + "; INTG-054: GetCityState seven-slot+build/recruit queue finish_at_ms+ETA/complete residual deepest-deepest-deepest; ListPlayerHeroes loyalty/exp residual deepest-deepest-deepest+ListPlayerBag training item; ListPowerRank/ListKillRank pin/refresh residual deepest-deepest-deepest; ListGuildMembers duty/online+ListGuildChatMessages id/len residual deepest-deepest-deepest; ListPlayerQuests claimable+chain+queue ETA cross residual deepest-deepest-deepest HUD deeplink"

// TestINTG054Wave54SmokePath extends INTG-053 with wave:54 city/hero/rank/guild/quest residual-deepest-deepest-deepest gateway hints (CLIENT-340–346).
func TestINTG054Wave54SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-054 wave:54 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG054Wave54Smoke(t)
}

func runINTG054Wave54Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG054Wave54BeforeRestartGateway)
}

func smokeINTG054Wave54BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG053Wave53BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG054GetCityStateSevenSlotsQueueETACompleteResidualDeepestDeepestDeepestGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG054HeroTrainingBagResidualDeepestDeepestDeepestGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG054DualRankPinRefreshResidualDeepestDeepestDeepestGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG054GuildDutyChatResidualDeepestDeepestDeepestGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG054QuestChainQueueETACrossResidualDeepestDeepestDeepestGateway(t, c, sid, cityID, playerID)
}

func smokeINTG054GetCityStateSevenSlotsQueueETACompleteResidualDeepestDeepestDeepestGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-054: skip GetCityState seven-slot+queue ETA/complete residual deepest-deepest-deepest (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-054 DOM: GetCityState seven-slot+queue ETA/complete residual deepest-deepest-deepest city_id=%d (CLIENT-340/341)", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	nowMs := time.Now().UnixMilli()
	bySlot := make(map[string]struct {
		buildingCfgID     int32
		level             int32
		upgradeFinishAtMs int64
	})
	var nextBuildFinish int64
	activeRingSlots := 0
	for _, b := range st.GetBuildings() {
		key := b.GetSlotKey()
		if key == "" {
			continue
		}
		finish := b.GetUpgradeFinishAtMs()
		bySlot[key] = struct {
			buildingCfgID     int32
			level             int32
			upgradeFinishAtMs int64
		}{buildingCfgID: b.GetBuildingCfgId(), level: b.GetLevel(), upgradeFinishAtMs: finish}
		if finish > nowMs {
			activeRingSlots++
			if nextBuildFinish == 0 || finish < nextBuildFinish {
				nextBuildFinish = finish
			}
		}
	}
	var slotParts []string
	for _, wantKey := range smokeINTG025SevenBuildingSlotKeys {
		row, ok := bySlot[wantKey]
		if !ok {
			continue
		}
		deepestDeeperHint := "eta_complete_residual_deepest_deepest_deepest_hint=idle"
		if row.upgradeFinishAtMs > nowMs {
			remSec := (row.upgradeFinishAtMs - nowMs) / 1000
			deepestDeeperHint = fmt.Sprintf("eta_complete_residual_deepest_deepest_deepest_hint=%s ring=active deepest_deepest_deepest_ring_hint=client_derived", smokeINTG035DomesticQueueEtaSegmentHint(remSec))
		}
		slotParts = append(slotParts, fmt.Sprintf("%s(building_cfg_id=%d,level=%d,upgrade_finish_at_ms=%d,%s)",
			wantKey, row.buildingCfgID, row.level, row.upgradeFinishAtMs, deepestDeeperHint))
	}
	if len(slotParts) > 0 {
		t.Logf("INTG-054: GetCityState city_id=%d seven-slot building_cfg_id [%s] active_ring_slots=%d next_build_finish_preview_ms=%d slot_interlink_residual_deepest_deepest_deepest_hint=client_derived player_id=%d",
			cityID, strings.Join(slotParts, " "), activeRingSlots, nextBuildFinish, playerID)
	} else {
		t.Logf("INTG-054: skip GetCityState seven-slot building_cfg_id residual deepest-deepest-deepest (no expected slot_key rows; see tools/smoke/README.md)")
	}

	buildLogged := false
	for _, b := range st.GetBuildings() {
		finish := b.GetUpgradeFinishAtMs()
		if finish > nowMs {
			remSec := (finish - nowMs) / 1000
			t.Logf("INTG-054: GetCityState build_queue first upgrade_finish_at_ms=%d building_cfg_id=%d level=%d eta_complete_residual_deepest_deepest_deepest_hint=%s city_id=%d player_id=%d",
				finish, b.GetBuildingCfgId(), b.GetLevel(), smokeINTG035DomesticQueueEtaSegmentHint(remSec), cityID, playerID)
			buildLogged = true
			break
		}
	}
	if !buildLogged {
		t.Logf("INTG-054: skip GetCityState build_queue upgrade_finish_at_ms (no active queue; hint StartBuildingUpgrade — see tools/smoke/README.md)")
	}
	if !smokeINTG054OptionalRecruitQueueFinishResidualDeepestDeepestDeepest(t, c, apiSrv, sid, cityID, playerID) {
		t.Logf("INTG-054: skip GetCityState recruit_queue upgrade_finish_at_ms (no active recruit queue; hint military.v1.RecruitTroop — see tools/smoke/README.md)")
	}
}

func smokeINTG054OptionalRecruitQueueFinishResidualDeepestDeepestDeepest(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) bool {
	t.Helper()
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 30)
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitTroop, TraceId: "i54-recruit-queue", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 1,
		}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-054: recruit_queue optional RecruitTroop code=%d msg=%s (non-blocking)", recruitResp.Code, recruitResp.Msg)
		return false
	}
	var out militaryv1.RecruitTroopResponse
	if err := proto.Unmarshal(recruitResp.Data, &out); err != nil {
		intg054Failf(t, "decode recruit troop queue wave54", "player_id=%d err=%v", playerID, err)
	}
	finish := out.GetFinishAtMs()
	if finish == 0 && out.GetQueueId() == 0 {
		return false
	}
	nowMs := time.Now().UnixMilli()
	remSec := (finish - nowMs) / 1000
	if remSec < 0 {
		remSec = 0
	}
	t.Logf("INTG-054: GetCityState recruit_queue first upgrade_finish_at_ms=%d unit_cfg_id=%d eta_complete_residual_deepest_deepest_deepest_hint=%s queue_id=%d player_id=%d",
		finish, smokeMarchTroopUnitCfgID, smokeINTG035DomesticQueueEtaSegmentHint(remSec), out.GetQueueId(), playerID)
	return true
}

func smokeINTG054HeroTrainingBagResidualDeepestDeepestDeepestGateway(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-054 HERO: ListPlayerHeroes+ListPlayerBag training residual deepest-deepest-deepest (CLIENT-342/343)")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i54-heroes-training", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg054Failf(t, "list player heroes training residual deepest-deepest-deepest", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg054Failf(t, "decode list player heroes training residual deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	heroes := out.GetHeroes()
	if len(heroes) < 1 || out.GetTotalCount() < 1 {
		t.Logf("INTG-054: skip ListPlayerHeroes loyalty/exp residual deepest-deepest-deepest (empty roster total=%d; hint RecruitHero — see tools/smoke/README.md)", out.GetTotalCount())
	} else {
		first := heroes[0]
		expHint := "exp_residual_deepest_deepest_deepest_hint=client_derived"
		detailResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteGetHeroDetail, TraceId: "i54-hero-exp-deepest-deepest-deepest", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&herov1.GetHeroDetailRequest{ServerId: intg006ServerID, HeroId: first.GetHeroId()}),
		})
		if detailResp.Code == 0 {
			var detailOut herov1.GetHeroDetailResponse
			if err := proto.Unmarshal(detailResp.Data, &detailOut); err == nil && detailOut.GetHeroId() != 0 {
				expHint = fmt.Sprintf("exp=%d exp_residual_deepest_deepest_deepest_hint=client_derived", detailOut.GetExp())
			}
		}
		t.Logf("INTG-054: ListPlayerHeroes player_id=%d hero_id=%d level=%d loyalty=%d %s loyalty_exp_residual_deepest_deepest_deepest_hint=client_derived",
			playerID, first.GetHeroId(), first.GetLevel(), first.GetLoyalty(), expHint)
	}

	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i54-bag-training", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if bagResp.Code != 0 {
		intg054Failf(t, "list player bag training residual deepest-deepest-deepest", "player_id=%d code=%d msg=%s", playerID, bagResp.Code, bagResp.Msg)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		intg054Failf(t, "decode list player bag training residual deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	items := bagOut.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-054: skip ListPlayerBag training item_id/count (empty bag; hint grant — see tools/smoke/README.md)")
		return
	}
	var picked *contentv1.PlayerItemStack
	for _, it := range items {
		if it.GetItemCfgId() >= 2000 && it.GetQuantity() > 0 {
			picked = it
			break
		}
	}
	if picked == nil {
		picked = items[0]
	}
	trainingHint := "training_item_residual_deepest_deepest_deepest_hint=client_derived"
	if pool != nil && picked != nil {
		var itemType int32
		if err := pool.QueryRow(ctx, `SELECT item_type FROM cfg_item WHERE item_cfg_id = $1`, picked.GetItemCfgId()).Scan(&itemType); err == nil {
			trainingHint = fmt.Sprintf("item_type=%d training_item_residual_deepest_deepest_deepest_hint=client_derived", itemType)
		}
	}
	t.Logf("INTG-054: ListPlayerBag player_id=%d training_item_id=%d count=%d entry_count=%d %s",
		playerID, picked.GetItemCfgId(), picked.GetQuantity(), len(items), trainingHint)
}

func smokeINTG054DualRankPinRefreshResidualDeepestDeepestDeepestGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-054 RANK: ListPowerRank/ListKillRank pin/refresh residual deepest-deepest-deepest (CLIENT-344)")
	if pool != nil {
		if _, err := pool.Exec(ctx, `UPDATE player SET power = 4130 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID); err != nil {
			intg054Failf(t, "seed power for rank pin refresh residual deepest-deepest-deepest", "err=%v", err)
		}
		if err := apiSrv.RefreshRanks(ctx); err != nil {
			intg054Failf(t, "refresh ranks pin refresh residual deepest-deepest-deepest", "err=%v", err)
		}
	}
	for _, board := range []struct {
		lbType rankv1.LeaderboardType
		alias  string
		trace  string
	}{
		{rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER, "ListPowerRank", "i54-rank-power-deepest-deepest-deepest"},
		{rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE, "ListKillRank", "i54-rank-kill-deepest-deepest-deepest"},
	} {
		resp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteGetLeaderboard, TraceId: board.trace, SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
				ServerId: intg006ServerID, Type: board.lbType, Page: 1, PageSize: 20,
			}),
		})
		if resp.Code != 0 {
			intg054Failf(t, "get leaderboard pin refresh residual deepest-deepest-deepest", "alias=%s code=%d msg=%s", board.alias, resp.Code, resp.Msg)
		}
		var lbOut rankv1.GetLeaderboardResponse
		if err := proto.Unmarshal(resp.Data, &lbOut); err != nil {
			intg054Failf(t, "decode leaderboard pin refresh residual deepest-deepest-deepest", "alias=%s err=%v", board.alias, err)
		}
		entries := lbOut.GetEntries()
		if lbOut.GetTotalCount() < 1 || len(entries) < 1 {
			t.Logf("INTG-054: skip %s pin/refresh residual deepest-deepest-deepest (empty total=%d; hint RefreshRanks — see tools/smoke/README.md)", board.alias, lbOut.GetTotalCount())
			continue
		}
		e := entries[0]
		t.Logf("INTG-054: %s list_len=%d first_player_id=%d first_rank=%d my_rank=%d snapshot_refreshed_at_ms=%d pin_refresh_residual_deepest_deepest_deepest_hint=client_derived rank_pin_keep_residual_deepest_deepest_deepest_ring_hint=client_derived viewer_player_id=%d",
			board.alias, len(entries), e.GetEntityId(), e.GetRank(), lbOut.GetMyRank(), lbOut.GetSnapshotRefreshedAtMs(), playerID)
	}
}

func smokeINTG054GuildDutyChatResidualDeepestDeepestDeepestGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	var guildID int64
	err := pool.QueryRow(ctx, `SELECT guild_id FROM guild_member WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) || guildID == 0 {
		t.Logf("INTG-054: skip ListGuildMembers+ListGuildChatMessages residual deepest-deepest-deepest (player not in guild — see tools/smoke/README.md)")
		return
	}
	if err != nil {
		intg054Failf(t, "lookup guild membership wave54", "player_id=%d err=%v", playerID, err)
	}
	smokeStep(t, fmt.Sprintf("INTG-054 GUILD: ListGuildMembers+ListGuildChatMessages residual deepest-deepest-deepest guild_id=%d (CLIENT-345)", guildID))
	memResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteListGuildMembers, TraceId: "i54-guild-duty", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.ListGuildMembersRequest{
			ServerId: intg006ServerID, GuildId: guildID, Page: 1, PageSize: 50,
		}),
	})
	if memResp.Code != 0 {
		intg054Failf(t, "list guild members duty residual deepest-deepest-deepest", "guild_id=%d code=%d msg=%s", guildID, memResp.Code, memResp.Msg)
	}
	var memOut guildv1.ListGuildMembersResponse
	if err := proto.Unmarshal(memResp.Data, &memOut); err != nil {
		intg054Failf(t, "decode list guild members duty residual deepest-deepest-deepest", "guild_id=%d err=%v", guildID, err)
	}
	members := memOut.GetMembers()
	total := memOut.GetTotalCount()
	if total < 1 {
		total = int32(len(members))
	}
	var firstRole guildv1.GuildMemberRole
	var memberPower int64
	if len(members) > 0 {
		firstRole = members[0].GetRole()
		memberPower = members[0].GetPower()
	}
	t.Logf("INTG-054: ListGuildMembers guild_id=%d members_total=%d duty_first=%s first_member_power=%d duty_online_residual_deepest_deepest_deepest_hint=client_derived guild_duty_header_residual_deepest_deepest_deepest_hint=client_derived player_id=%d",
		guildID, total, firstRole.String(), memberPower, playerID)

	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: chat.RouteListChatMessages, TraceId: "i54-guild-chat", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&chatv1.ListChatMessagesRequest{
			ServerId: intg006ServerID, Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD, GuildId: guildID, Limit: 50,
		}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-054: skip ListGuildChatMessages residual deepest-deepest-deepest (guild_id=%d code=%d msg=%s — see tools/smoke/README.md)", guildID, listResp.Code, listResp.Msg)
		return
	}
	var listOut chatv1.ListChatMessagesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg054Failf(t, "decode guild chat messages wave54", "guild_id=%d err=%v", guildID, err)
	}
	messages := listOut.GetMessages()
	if len(messages) < 1 {
		t.Logf("INTG-054: skip ListGuildChatMessages first id/len residual deepest-deepest-deepest (empty guild channel guild_id=%d — see tools/smoke/README.md)", guildID)
		return
	}
	first := messages[0]
	t.Logf("INTG-054: ListGuildChatMessages guild_id=%d first_message_id=%d message_list_length=%d chat_unread_separator_residual_deepest_deepest_deepest_hint=client_derived guild_chat_unread_divider_residual_deepest_deepest_deepest_sweep_hint=client_derived player_id=%d",
		guildID, first.GetMessageId(), len(messages), playerID)
}

func smokeINTG054QuestChainQueueETACrossResidualDeepestDeepestDeepestGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	var queueFinishMs int64
	if cityID != 0 {
		st := smokeGatewayGetCityState(t, c, sid, cityID)
		nowMs := time.Now().UnixMilli()
		for _, b := range st.GetBuildings() {
			finish := b.GetUpgradeFinishAtMs()
			if finish > nowMs {
				queueFinishMs = finish
				break
			}
		}
	}

	smokeStep(t, fmt.Sprintf("INTG-054 HUD: ListPlayerQuests+queue ETA cross residual deepest-deepest-deepest chain_id=%d (CLIENT-346)", smokeDailyQuestChainID))
	chainHint := fmt.Sprintf("chain_id=%d chain_type_hint=unknown", smokeDailyQuestChainID)
	chainResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetQuestChainStatus, TraceId: "i54-chain-status", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.GetQuestChainStatusRequest{ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID}),
	})
	if chainResp.Code == 0 {
		var chainOut questv1.GetQuestChainStatusResponse
		if err := proto.Unmarshal(chainResp.Data, &chainOut); err == nil && chainOut.GetChain() != nil {
			ch := chainOut.GetChain()
			chainHint = fmt.Sprintf("chain_id=%d chain_name=%q chain_state=%s completed=%d/%d chain_type_hint=daily",
				ch.GetChainId(), ch.GetChainName(), ch.GetChainState().String(),
				ch.GetCompletedQuestCount(), ch.GetTotalQuestCount())
		}
	}

	questResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i54-quest-hud-cross-deeper", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		}),
	})
	if questResp.Code != 0 {
		intg054Failf(t, "list player quests hud cross residual deepest-deepest-deepest", "player_id=%d code=%d msg=%s", playerID, questResp.Code, questResp.Msg)
	}
	var questOut questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(questResp.Data, &questOut); err != nil {
		intg054Failf(t, "decode list player quests hud cross residual deepest-deepest-deepest", "player_id=%d err=%v", playerID, err)
	}
	var claimableCount int
	for _, q := range questOut.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
		}
	}
	if claimableCount < 1 && len(questOut.GetQuests()) < 1 {
		t.Logf("INTG-054: skip ListPlayerQuests chain+queue ETA cross residual deepest-deepest-deepest (%s claimable=0 empty chain; hint daily progress — see tools/smoke/README.md)", chainHint)
		return
	}
	queueCrossHint := "queue_eta_cross_residual_deepest_deepest_deepest_hint=idle"
	if queueFinishMs > 0 {
		remSec := (queueFinishMs - time.Now().UnixMilli()) / 1000
		if remSec < 0 {
			remSec = 0
		}
		queueCrossHint = fmt.Sprintf("build_queue_finish_at_ms=%d queue_eta_cross_residual_deepest_deepest_deepest_hint=%s", queueFinishMs, smokeINTG035DomesticQueueEtaSegmentHint(remSec))
	} else if cityID == 0 {
		queueCrossHint = "queue_eta_cross_residual_deepest_deepest_deepest_hint=skip_no_city"
	}
	t.Logf("INTG-054: HUD quest_queue_cross player_id=%d %s claimable_count=%d %s hud_todo_bottom_bar_deeplink_residual_deepest_deepest_deepest_hint=client_derived hud_todo_toolbar_deep_link_residual_deepest_deepest_deepest_pulse_hint=client_derived",
		playerID, chainHint, claimableCount, queueCrossHint)
}

func intg054Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG054CfgHint, step, fmt.Sprintf(format, args...))
}
