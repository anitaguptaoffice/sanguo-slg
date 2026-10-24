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

const smokeINTG039CfgHint = smokeINTG038CfgHint + "; INTG-039: GetCityState seven-slot+build_queue/recruit_queue finish_at_ms+complete_focus ETA segment; ListPlayerHeroes loyalty+ListPlayerBag growth item; ListPowerRank/ListKillRank pin refresh; ListGuildMembers role+ListGuildChatMessages id/length; ListPlayerQuests chain+queue ETA HUD deeplink"

// TestINTG039Wave42SmokePath extends INTG-038 with city queue ETA/complete focus, hero growth skim, dual-rank pin refresh, guild chat skim, and quest chain vs queue ETA hints for wave:42 CLIENT readouts.
func TestINTG039Wave42SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-039 wave:42 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG039Wave42Smoke(t)
}

func runINTG039Wave42Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG039Wave42BeforeRestartGateway)
}

func smokeINTG039Wave42BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG038Wave41BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG039GetCityStateSevenSlotsDualQueueCompleteFocusGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG039HeroGrowthBagSkimGateway(t, c, sid, playerID)
	smokeINTG039DualRankPinRefreshGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG039GuildRoleChatSkimGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG039QuestChainQueueETAHUDGateway(t, c, sid, cityID, playerID)
}

func smokeINTG039GetCityStateSevenSlotsDualQueueCompleteFocusGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-039: skip GetCityState seven-slot+dual-queue complete focus (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-039 DOM: gateway GetCityState city_id=%d seven-slot building_cfg_id+build_queue/recruit_queue finish_at_ms+complete_focus ETA", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	nowMs := time.Now().UnixMilli()
	bySlot := make(map[string]struct {
		buildingCfgID     int32
		level             int32
		upgradeFinishAtMs int64
	})
	var nextBuildFinish int64
	idleSlots := 0
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
		if finish <= nowMs {
			idleSlots++
		} else if nextBuildFinish == 0 || finish < nextBuildFinish {
			nextBuildFinish = finish
		}
	}
	var slotParts []string
	for _, wantKey := range smokeINTG025SevenBuildingSlotKeys {
		row, ok := bySlot[wantKey]
		if !ok {
			continue
		}
		completeHint := "complete_focus_residual_ring_hint=idle"
		if row.upgradeFinishAtMs > nowMs {
			remSec := (row.upgradeFinishAtMs - nowMs) / 1000
			completeHint = fmt.Sprintf("eta_segment_hint=%s active_queue=1", smokeINTG035DomesticQueueEtaSegmentHint(remSec))
		}
		slotParts = append(slotParts, fmt.Sprintf("%s(building_cfg_id=%d,level=%d,upgrade_finish_at_ms=%d,%s)",
			wantKey, row.buildingCfgID, row.level, row.upgradeFinishAtMs, completeHint))
	}
	if len(slotParts) > 0 {
		t.Logf("INTG-039: GetCityState city_id=%d seven-slot building_cfg_id [%s] idle_slots=%d next_build_finish_preview_ms=%d slot_margin_ring_hint=client_derived",
			cityID, strings.Join(slotParts, " "), idleSlots, nextBuildFinish)
	} else {
		t.Logf("INTG-039: skip GetCityState seven-slot building_cfg_id summary (no expected slot_key rows; see tools/smoke/README.md)")
	}

	buildLogged := false
	for _, b := range st.GetBuildings() {
		finish := b.GetUpgradeFinishAtMs()
		if finish > nowMs {
			remSec := (finish - nowMs) / 1000
			t.Logf("INTG-039: GetCityState build_queue first upgrade_finish_at_ms=%d building_cfg_id=%d level=%d eta_segment_hint=%s complete_focus_residual_hint=client_derived city_id=%d player_id=%d",
				finish, b.GetBuildingCfgId(), b.GetLevel(), smokeINTG035DomesticQueueEtaSegmentHint(remSec), cityID, playerID)
			buildLogged = true
			break
		}
	}
	if !buildLogged {
		t.Logf("INTG-039: skip GetCityState build_queue upgrade_finish_at_ms (no active queue; hint StartBuildingUpgrade — see tools/smoke/README.md)")
	}
	if !smokeINTG039OptionalRecruitQueueFinishHint(t, c, apiSrv, sid, cityID, playerID) {
		t.Logf("INTG-039: skip GetCityState recruit_queue upgrade_finish_at_ms (no active recruit queue; hint military.v1.RecruitTroop — see tools/smoke/README.md)")
	}
}

func smokeINTG039OptionalRecruitQueueFinishHint(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) bool {
	t.Helper()
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 30)
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitTroop, TraceId: "i39-recruit-queue", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 1,
		}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-039: recruit_queue optional RecruitTroop code=%d msg=%s (non-blocking)", recruitResp.Code, recruitResp.Msg)
		return false
	}
	var out militaryv1.RecruitTroopResponse
	if err := proto.Unmarshal(recruitResp.Data, &out); err != nil {
		intg039Failf(t, "decode recruit troop queue wave42", "player_id=%d err=%v", playerID, err)
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
	t.Logf("INTG-039: GetCityState recruit_queue first upgrade_finish_at_ms=%d unit_cfg_id=%d eta_segment_hint=%s queue_id=%d next_complete_preview_hint=client_derived player_id=%d",
		finish, smokeMarchTroopUnitCfgID, smokeINTG035DomesticQueueEtaSegmentHint(remSec), out.GetQueueId(), playerID)
	return true
}

func smokeINTG039HeroGrowthBagSkimGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-039 HERO: gateway ListPlayerHeroes first hero_id/level+loyalty hint + ListPlayerBag growth item_id/count")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i39-heroes-growth", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg039Failf(t, "list player heroes growth skim", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg039Failf(t, "decode list player heroes growth skim", "player_id=%d err=%v", playerID, err)
	}
	heroes := out.GetHeroes()
	if len(heroes) < 1 || out.GetTotalCount() < 1 {
		t.Logf("INTG-039: skip ListPlayerHeroes loyalty/growth skim (empty roster total=%d; hint RecruitHero — see tools/smoke/README.md)", out.GetTotalCount())
	} else {
		first := heroes[0]
		t.Logf("INTG-039: ListPlayerHeroes player_id=%d hero_id=%d level=%d loyalty=%d exp_hint=loyalty_field panel_state_filter_chip_memory_hint=client_derived",
			playerID, first.GetHeroId(), first.GetLevel(), first.GetLoyalty())
	}

	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i39-bag-growth", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if bagResp.Code != 0 {
		intg039Failf(t, "list player bag growth skim", "player_id=%d code=%d msg=%s", playerID, bagResp.Code, bagResp.Msg)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		intg039Failf(t, "decode list player bag growth skim", "player_id=%d err=%v", playerID, err)
	}
	items := bagOut.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-039: skip ListPlayerBag growth item_id/count (empty bag; hint grant — see tools/smoke/README.md)")
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
	t.Logf("INTG-039: ListPlayerBag player_id=%d growth_item_id=%d count=%d entry_count=%d hero_growth_stack_scan_hint=client_derived",
		playerID, picked.GetItemCfgId(), picked.GetQuantity(), len(items))
}

func smokeINTG039DualRankPinRefreshGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-039 RANK: gateway GetLeaderboard ListPowerRank/ListKillRank length+first player_id+pin refresh hint")
	if pool != nil {
		if _, err := pool.Exec(ctx, `UPDATE player SET power = 3800 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID); err != nil {
			intg039Failf(t, "seed power for rank pin refresh", "err=%v", err)
		}
		if err := apiSrv.RefreshRanks(ctx); err != nil {
			intg039Failf(t, "refresh ranks pin refresh", "err=%v", err)
		}
	}
	for _, board := range []struct {
		lbType rankv1.LeaderboardType
		alias  string
		trace  string
	}{
		{rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER, "ListPowerRank", "i39-rank-power"},
		{rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE, "ListKillRank", "i39-rank-kill"},
	} {
		resp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteGetLeaderboard, TraceId: board.trace, SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
				ServerId: intg006ServerID, Type: board.lbType, Page: 1, PageSize: 20,
			}),
		})
		if resp.Code != 0 {
			intg039Failf(t, "get leaderboard pin refresh", "alias=%s code=%d msg=%s", board.alias, resp.Code, resp.Msg)
		}
		var lbOut rankv1.GetLeaderboardResponse
		if err := proto.Unmarshal(resp.Data, &lbOut); err != nil {
			intg039Failf(t, "decode leaderboard pin refresh", "alias=%s err=%v", board.alias, err)
		}
		entries := lbOut.GetEntries()
		if lbOut.GetTotalCount() < 1 || len(entries) < 1 {
			t.Logf("INTG-039: skip %s (empty total=%d; hint RefreshRanks — see tools/smoke/README.md)", board.alias, lbOut.GetTotalCount())
			continue
		}
		e := entries[0]
		t.Logf("INTG-039: %s entries_len=%d first_player_id=%d first_rank=%d snapshot_refreshed_at_ms=%d pin_row_keep_refresh_cooldown_residual_hint=client_derived viewer_player_id=%d",
			board.alias, len(entries), e.GetEntityId(), e.GetRank(), lbOut.GetSnapshotRefreshedAtMs(), playerID)
	}
}

func smokeINTG039GuildRoleChatSkimGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	var guildID int64
	err := pool.QueryRow(ctx, `SELECT guild_id FROM guild_member WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) || guildID == 0 {
		t.Logf("INTG-039: skip ListGuildMembers+ListGuildChatMessages (player not in guild — see tools/smoke/README.md)")
		return
	}
	if err != nil {
		intg039Failf(t, "lookup guild membership wave42", "player_id=%d err=%v", playerID, err)
	}
	smokeStep(t, fmt.Sprintf("INTG-039 GUILD: gateway ListGuildMembers role/online + ListGuildChatMessages first id/length guild_id=%d", guildID))
	memResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteListGuildMembers, TraceId: "i39-guild-role", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.ListGuildMembersRequest{
			ServerId: intg006ServerID, GuildId: guildID, Page: 1, PageSize: 50,
		}),
	})
	if memResp.Code != 0 {
		intg039Failf(t, "list guild members role skim", "guild_id=%d code=%d msg=%s", guildID, memResp.Code, memResp.Msg)
	}
	var memOut guildv1.ListGuildMembersResponse
	if err := proto.Unmarshal(memResp.Data, &memOut); err != nil {
		intg039Failf(t, "decode list guild members role skim", "guild_id=%d err=%v", guildID, err)
	}
	members := memOut.GetMembers()
	total := memOut.GetTotalCount()
	if total < 1 {
		total = int32(len(members))
	}
	var firstRole guildv1.GuildMemberRole
	if len(members) > 0 {
		firstRole = members[0].GetRole()
	}
	t.Logf("INTG-039: ListGuildMembers guild_id=%d members_total=%d role_first=%s online_field_hint=viewer_session_only guild_role_header_scan_hint=client_derived player_id=%d",
		guildID, total, firstRole.String(), playerID)

	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: chat.RouteListChatMessages, TraceId: "i39-guild-chat", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&chatv1.ListChatMessagesRequest{
			ServerId: intg006ServerID, Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD, GuildId: guildID, Limit: 50,
		}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-039: skip ListGuildChatMessages (guild_id=%d code=%d msg=%s — see tools/smoke/README.md)", guildID, listResp.Code, listResp.Msg)
		return
	}
	var listOut chatv1.ListChatMessagesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg039Failf(t, "decode guild chat messages wave42", "guild_id=%d err=%v", guildID, err)
	}
	messages := listOut.GetMessages()
	if len(messages) < 1 {
		t.Logf("INTG-039: skip ListGuildChatMessages first id/length (empty guild channel guild_id=%d — see tools/smoke/README.md)", guildID)
		return
	}
	first := messages[0]
	t.Logf("INTG-039: ListGuildChatMessages guild_id=%d first_message_id=%d message_list_length=%d unread_separator_scan_hint=client_derived player_id=%d (chat.v1.ListChatMessages ≡ guild.v1.ListGuildChatMessages)",
		guildID, first.GetMessageId(), len(messages), playerID)
}

func smokeINTG039QuestChainQueueETAHUDGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
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

	smokeStep(t, fmt.Sprintf("INTG-039 HUD: gateway ListPlayerQuests chain_id=%d claimable+chain hint vs GetCityState queue ETA", smokeDailyQuestChainID))
	chainHint := fmt.Sprintf("chain_id=%d", smokeDailyQuestChainID)
	chainResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetQuestChainStatus, TraceId: "i39-chain-status", SessionId: sid, ServerId: intg006ServerID,
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
		Route: api.RouteListPlayerQuests, TraceId: "i39-quest-hud-queue", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		}),
	})
	if questResp.Code != 0 {
		intg039Failf(t, "list player quests hud queue eta", "player_id=%d code=%d msg=%s", playerID, questResp.Code, questResp.Msg)
	}
	var questOut questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(questResp.Data, &questOut); err != nil {
		intg039Failf(t, "decode list player quests hud queue eta", "player_id=%d err=%v", playerID, err)
	}
	var claimableCount int
	for _, q := range questOut.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
		}
	}
	if claimableCount < 1 && len(questOut.GetQuests()) < 1 {
		t.Logf("INTG-039: skip ListPlayerQuests chain+queue ETA HUD (%s claimable=0 empty chain; hint daily progress — see tools/smoke/README.md)", chainHint)
		return
	}
	queueEtaHint := "build_queue_finish_at_ms=0"
	if queueFinishMs > 0 {
		remSec := (queueFinishMs - time.Now().UnixMilli()) / 1000
		if remSec < 0 {
			remSec = 0
		}
		queueEtaHint = fmt.Sprintf("build_queue_finish_at_ms=%d eta_segment_hint=%s", queueFinishMs, smokeINTG035DomesticQueueEtaSegmentHint(remSec))
	} else if cityID == 0 {
		queueEtaHint = "build_queue_finish_at_ms=skip_no_city"
	}
	t.Logf("INTG-039: HUD quest_queue player_id=%d %s claimable_count=%d %s hud_todo_bottom_bar_deeplink_hint=client_derived",
		playerID, chainHint, claimableCount, queueEtaHint)
}

func intg039Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG039CfgHint, step, fmt.Sprintf(format, args...))
}
