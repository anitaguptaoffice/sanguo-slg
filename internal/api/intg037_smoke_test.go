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

const smokeINTG037CfgHint = smokeINTG036CfgHint + "; INTG-037: GetCityState seven-slot building_cfg_id+build_queue/recruit_queue finish_at_ms; ListPlayerHeroes first hero_id/level panel shell; ListPlayerBag consumable+UseConsumable hint; ListPlayerQuests claimable+first quest_id; ListGuildMembers role/online+ListGuildChatMessages length"

// TestINTG037Wave40SmokePath extends INTG-036 with city slot/queue polish, hero panel shell, bag UseConsumable, daily claim UX, and guild social skim hints for wave:40 CLIENT readouts.
func TestINTG037Wave40SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-037 wave:40 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG037Wave40Smoke(t)
}

func runINTG037Wave40Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG037Wave40BeforeRestartGateway)
}

func smokeINTG037Wave40BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG036Wave39BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG037GetCityStateSevenSlotsQueuePolishGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG037ListPlayerHeroesPanelShellGateway(t, c, sid, playerID)
	smokeINTG037ListPlayerBagUseConsumableGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG037ListPlayerQuestsDailyClaimGateway(t, c, sid, playerID)
	smokeINTG037GuildSocialSkimGateway(t, ctx, pool, c, sid, playerID)
}

// smokeINTG037GetCityStateSevenSlotsQueuePolishGateway logs seven MAIN_CITY slot building_cfg_id rows and first build/recruit queue finish timestamps (CLIENT-228/229).
func smokeINTG037GetCityStateSevenSlotsQueuePolishGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-037: skip GetCityState seven-slot+queue polish (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-037 DOM: gateway GetCityState city_id=%d seven-slot building_cfg_id+queue finish_at_ms", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	bySlot := make(map[string]struct {
		buildingCfgID     int32
		level             int32
		upgradeFinishAtMs int64
	})
	for _, b := range st.GetBuildings() {
		key := b.GetSlotKey()
		if key == "" {
			continue
		}
		bySlot[key] = struct {
			buildingCfgID     int32
			level             int32
			upgradeFinishAtMs int64
		}{buildingCfgID: b.GetBuildingCfgId(), level: b.GetLevel(), upgradeFinishAtMs: b.GetUpgradeFinishAtMs()}
	}
	var slotParts []string
	var missing []string
	for _, wantKey := range smokeINTG025SevenBuildingSlotKeys {
		row, ok := bySlot[wantKey]
		if !ok {
			missing = append(missing, wantKey)
			continue
		}
		slotParts = append(slotParts, fmt.Sprintf("%s(building_cfg_id=%d,level=%d,upgrade_finish_at_ms=%d)",
			wantKey, row.buildingCfgID, row.level, row.upgradeFinishAtMs))
	}
	t.Logf("INTG-037: GetCityState city_id=%d seven-slot building_cfg_id [%s]", cityID, strings.Join(slotParts, " "))
	if len(missing) > 0 {
		t.Logf("INTG-037: skip missing building slots (hint seed or DOM may not expose all seven yet): %s", strings.Join(missing, ", "))
	}
	if len(slotParts) == 0 {
		t.Logf("INTG-037: skip seven-slot building_cfg_id summary (no expected slot_key rows; see tools/smoke/README.md)")
	}

	nowMs := time.Now().UnixMilli()
	var buildFinish int64
	for _, b := range st.GetBuildings() {
		finish := b.GetUpgradeFinishAtMs()
		if finish > nowMs {
			buildFinish = finish
			t.Logf("INTG-037: GetCityState build_queue first upgrade_finish_at_ms=%d building_cfg_id=%d level=%d slot_key=%s city_id=%d player_id=%d",
				finish, b.GetBuildingCfgId(), b.GetLevel(), b.GetSlotKey(), cityID, playerID)
			break
		}
	}
	if buildFinish == 0 {
		t.Logf("INTG-037: skip GetCityState build_queue upgrade_finish_at_ms (no active queue; hint StartBuildingUpgrade — see tools/smoke/README.md)")
	}
	if !smokeINTG037OptionalRecruitQueueFinishMsHint(t, c, apiSrv, sid, cityID, playerID) {
		t.Logf("INTG-037: skip GetCityState recruit_queue upgrade_finish_at_ms (no active recruit queue; hint military.v1.RecruitTroop — see tools/smoke/README.md)")
	}
}

func smokeINTG037OptionalRecruitQueueFinishMsHint(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) bool {
	t.Helper()
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 30)
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitTroop, TraceId: "i37-recruit-queue", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 1,
		}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-037: recruit_queue optional RecruitTroop code=%d msg=%s (non-blocking)", recruitResp.Code, recruitResp.Msg)
		return false
	}
	var out militaryv1.RecruitTroopResponse
	if err := proto.Unmarshal(recruitResp.Data, &out); err != nil {
		intg037Failf(t, "decode recruit troop queue polish", "player_id=%d err=%v", playerID, err)
	}
	finish := out.GetFinishAtMs()
	if finish == 0 && out.GetQueueId() == 0 {
		return false
	}
	t.Logf("INTG-037: GetCityState recruit_queue first upgrade_finish_at_ms=%d unit_cfg_id=%d queue_id=%d player_id=%d",
		finish, smokeMarchTroopUnitCfgID, out.GetQueueId(), playerID)
	return true
}

// smokeINTG037ListPlayerHeroesPanelShellGateway logs first hero_id/level for hero panel shell mount (CLIENT-230/231).
func smokeINTG037ListPlayerHeroesPanelShellGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-037 HERO: gateway ListPlayerHeroes first hero_id/level panel shell hint")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i37-heroes-shell", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg037Failf(t, "list player heroes panel shell", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg037Failf(t, "decode list player heroes panel shell", "player_id=%d err=%v", playerID, err)
	}
	heroes := out.GetHeroes()
	if len(heroes) < 1 {
		t.Logf("INTG-037: skip ListPlayerHeroes panel shell (empty roster; hint RecruitHero — see tools/smoke/README.md)")
		return
	}
	first := heroes[0]
	t.Logf("INTG-037: ListPlayerHeroes player_id=%d hero_id=%d level=%d total_count=%d hero_panel_shell_mount_hint=client_derived",
		playerID, first.GetHeroId(), first.GetLevel(), out.GetTotalCount())
}

// smokeINTG037ListPlayerBagUseConsumableGateway logs first consumable stack and UseConsumable result hint (CLIENT-232).
func smokeINTG037ListPlayerBagUseConsumableGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-037 BAG: gateway ListPlayerBag first consumable item_id/count + UseConsumable result hint")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i37-bag-use", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg037Failf(t, "list player bag consumable", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg037Failf(t, "decode list player bag consumable", "player_id=%d err=%v", playerID, err)
	}
	items := out.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-037: skip ListPlayerBag consumable+UseConsumable (empty bag; hint quest reward / GM grant — see tools/smoke/README.md)")
		return
	}
	var picked *contentv1.PlayerItemStack
	for _, it := range items {
		if it.GetQuantity() < 1 {
			continue
		}
		if smokeINTG037ItemLooksConsumable(ctx, pool, it.GetItemCfgId()) {
			picked = it
			break
		}
	}
	if picked == nil {
		t.Logf("INTG-037: skip ListPlayerBag consumable (no consumable stack in bag; hint item_cfg_id=2001 grant — see tools/smoke/README.md)")
		return
	}
	itemCfgID := picked.GetItemCfgId()
	count := picked.GetQuantity()
	t.Logf("INTG-037: ListPlayerBag player_id=%d consumable item_id=%d count=%d entry_count=%d",
		playerID, itemCfgID, count, len(items))

	useResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteUseConsumable, TraceId: "i37-use-consumable", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.UseConsumableRequest{
			ServerId: intg006ServerID, ItemCfgId: itemCfgID, Count: 1,
		}),
	})
	if useResp.Code != 0 {
		t.Logf("INTG-037: UseConsumable item_id=%d code=%d msg=%s (non-fatal expected failure; see INTG-010)", itemCfgID, useResp.Code, useResp.Msg)
		return
	}
	var useOut contentv1.UseConsumableResponse
	if err := proto.Unmarshal(useResp.Data, &useOut); err != nil {
		intg037Failf(t, "decode use consumable", "item_id=%d err=%v", itemCfgID, err)
	}
	t.Logf("INTG-037: UseConsumable item_id=%d remaining=%d effect_summary=%q player_id=%d bag_use_result_hint=client_derived",
		itemCfgID, useOut.GetRemaining(), useOut.GetEffectSummary(), playerID)
}

func smokeINTG037ItemLooksConsumable(ctx context.Context, pool *pgxpool.Pool, itemCfgID int32) bool {
	if itemCfgID <= 0 {
		return false
	}
	if pool != nil {
		var itemType int32
		err := pool.QueryRow(ctx, `SELECT item_type FROM cfg_item WHERE item_cfg_id = $1`, itemCfgID).Scan(&itemType)
		if err == nil {
			return itemType == 1 || itemType == 2
		}
	}
	return itemCfgID >= 2000 && itemCfgID < 2200
}

// smokeINTG037ListPlayerQuestsDailyClaimGateway logs claimable count and first claimable quest id on daily chain (CLIENT-233).
func smokeINTG037ListPlayerQuestsDailyClaimGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-037 QUEST: gateway ListPlayerQuests chain_id=%d claimable+first quest_id daily claim hint", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i37-daily-claim", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg037Failf(t, "list player quests daily claim", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg037Failf(t, "decode list player quests daily claim", "player_id=%d err=%v", playerID, err)
	}
	quests := out.GetQuests()
	if len(quests) < 1 {
		t.Logf("INTG-037: skip ListPlayerQuests daily claim (empty chain_id=%d; hint quest progress — see tools/smoke/README.md)", smokeDailyQuestChainID)
		return
	}
	var claimableCount int
	var firstClaimable *questv1.PlayerQuestProgress
	for _, q := range quests {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
			if firstClaimable == nil {
				firstClaimable = q
			}
		}
	}
	if claimableCount < 1 || firstClaimable == nil {
		t.Logf("INTG-037: skip ListPlayerQuests daily claim (chain_id=%d claimable_count=0; hint daily progress hook — see tools/smoke/README.md)", smokeDailyQuestChainID)
		return
	}
	t.Logf("INTG-037: ListPlayerQuests chain_id=%d claimable_count=%d first_quest_id=%d player_id=%d daily_claim_ux_hint=client_derived",
		smokeDailyQuestChainID, claimableCount, firstClaimable.GetQuestCfgId(), playerID)
}

// smokeINTG037GuildSocialSkimGateway logs guild member role/online hints and guild chat list length (CLIENT-234).
func smokeINTG037GuildSocialSkimGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	var guildID int64
	err := pool.QueryRow(ctx, `SELECT guild_id FROM guild_member WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) || guildID == 0 {
		t.Logf("INTG-037: skip ListGuildMembers social skim (player not in guild — join via guild.v1.CreateGuild or INTG-010 optional social; see tools/smoke/README.md)")
		return
	}
	if err != nil {
		intg037Failf(t, "lookup guild membership social skim", "player_id=%d err=%v", playerID, err)
	}
	smokeStep(t, fmt.Sprintf("INTG-037 GUILD: gateway ListGuildMembers role/online + ListGuildChatMessages length guild_id=%d", guildID))
	memResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteListGuildMembers, TraceId: "i37-guild-skim", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.ListGuildMembersRequest{
			ServerId: intg006ServerID, GuildId: guildID, Page: 1, PageSize: 50,
		}),
	})
	if memResp.Code != 0 {
		intg037Failf(t, "list guild members social skim", "guild_id=%d code=%d msg=%s", guildID, memResp.Code, memResp.Msg)
	}
	var memOut guildv1.ListGuildMembersResponse
	if err := proto.Unmarshal(memResp.Data, &memOut); err != nil {
		intg037Failf(t, "decode list guild members social skim", "guild_id=%d err=%v", guildID, err)
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
	onlineHint := fmt.Sprintf("members_total=%d online_count_hint=viewer_session_only role_first=%s", total, firstRole.String())
	t.Logf("INTG-037: ListGuildMembers guild_id=%d %s player_id=%d", guildID, onlineHint, playerID)

	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: chat.RouteListChatMessages, TraceId: "i37-guild-chat-len", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&chatv1.ListChatMessagesRequest{
			ServerId: intg006ServerID, Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD, GuildId: guildID, Limit: 50,
		}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-037: skip ListGuildChatMessages length (guild_id=%d code=%d msg=%s — see tools/smoke/README.md)", guildID, listResp.Code, listResp.Msg)
		return
	}
	var listOut chatv1.ListChatMessagesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg037Failf(t, "decode guild chat messages length", "guild_id=%d err=%v", guildID, err)
	}
	messages := listOut.GetMessages()
	if len(messages) < 1 {
		t.Logf("INTG-037: skip ListGuildChatMessages length (empty guild channel guild_id=%d — see tools/smoke/README.md)", guildID)
		return
	}
	t.Logf("INTG-037: ListGuildChatMessages guild_id=%d message_list_length=%d player_id=%d (chat.v1.ListChatMessages ≡ guild.v1.ListGuildChatMessages)",
		guildID, len(messages), playerID)
}

func intg037Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG037CfgHint, step, fmt.Sprintf(format, args...))
}
