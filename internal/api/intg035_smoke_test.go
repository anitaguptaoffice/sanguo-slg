package api_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
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

const smokeINTG035CfgHint = smokeINTG034CfgHint + "; INTG-035: GetCityState build_queue+recruit_queue finish_at_ms+ETA segment; ListPlayerHeroes loyalty+ListPlayerBag growth item; ListPowerRank/ListKillRank length+first player_id; ListRecruitTemplates currency+ListShopShelf price/currency; ListPlayerQuests claimable+chain hint+mail unclaimed; ListGuildMembers online hint+guild chat first id"

// TestINTG035Wave38SmokePath extends INTG-034 with city dual-queue ETA segments, hero loyalty/bag growth, dual rank lists, recruit/shop currency contrast, quest chain HUD, and guild online/chat hints for wave:38 CLIENT readouts.
func TestINTG035Wave38SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-035 wave:38 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG035Wave38Smoke(t)
}

func runINTG035Wave38Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG035Wave38BeforeRestartGateway)
}

func smokeINTG035Wave38BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG034Wave37BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG035GetCityStateBuildRecruitQueueEtaSegmentGateway(t, c, apiSrv, sid, cityID, playerID)
	smokeINTG035ListPlayerHeroesLoyaltyAndBagGrowthGateway(t, c, sid, playerID)
	smokeINTG035DualRankListLengthGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG035RecruitCurrencyAndShopSKUGateway(t, c, sid, playerID)
	smokeINTG035QuestChainMailHUDGateway(t, c, sid, playerID)
	smokeINTG035GuildOnlineAndChatGateway(t, ctx, pool, c, sid, playerID)
}

// smokeINTG035GetCityStateBuildRecruitQueueEtaSegmentGateway logs first active build_queue upgrade_finish_at_ms with ETA segment hint and optional recruit_queue finish_at_ms (CLIENT-212/218).
func smokeINTG035GetCityStateBuildRecruitQueueEtaSegmentGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-035: skip GetCityState build_queue+recruit_queue ETA segment (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-035 DOM: gateway GetCityState city_id=%d build_queue+recruit_queue finish_at_ms+ETA segment hint", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	nowMs := time.Now().UnixMilli()
	buildLogged := false
	for _, b := range st.GetBuildings() {
		finish := b.GetUpgradeFinishAtMs()
		if finish > nowMs {
			remainingSec := (finish - nowMs) / 1000
			if remainingSec < 0 {
				remainingSec = 0
			}
			t.Logf("INTG-035: GetCityState build_queue upgrade_finish_at_ms=%d building_cfg_id=%d level=%d eta_segment_hint=%s city_id=%d player_id=%d",
				finish, b.GetBuildingCfgId(), b.GetLevel(), smokeINTG035DomesticQueueEtaSegmentHint(remainingSec), cityID, playerID)
			buildLogged = true
			break
		}
	}
	if !buildLogged {
		t.Logf("INTG-035: skip GetCityState build_queue ETA segment (no active queue; hint StartBuildingUpgrade — see tools/smoke/README.md)")
	}

	recruitLogged := smokeINTG035OptionalRecruitQueueFinishHint(t, c, apiSrv, sid, cityID, playerID)
	if !recruitLogged {
		t.Logf("INTG-035: skip GetCityState recruit_queue finish_at_ms (no active recruit queue; hint military.v1.RecruitTroop — see tools/smoke/README.md)")
	}
}

func smokeINTG035OptionalRecruitQueueFinishHint(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, cityID int64, playerID int64) bool {
	t.Helper()
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 30)
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitTroop, TraceId: "i35-recruit-queue", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
			CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 2,
		}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-035: recruit_queue optional RecruitTroop code=%d msg=%s (non-blocking)", recruitResp.Code, recruitResp.Msg)
		return false
	}
	var out militaryv1.RecruitTroopResponse
	if err := proto.Unmarshal(recruitResp.Data, &out); err != nil {
		intg035Failf(t, "decode recruit troop queue", "player_id=%d err=%v", playerID, err)
	}
	finish := out.GetFinishAtMs()
	if finish == 0 && out.GetQueueId() == 0 {
		return false
	}
	nowMs := time.Now().UnixMilli()
	remainingSec := (finish - nowMs) / 1000
	if remainingSec < 0 {
		remainingSec = 0
	}
	t.Logf("INTG-035: GetCityState recruit_queue finish_at_ms=%d unit_cfg_id=%d level_hint=n/a eta_segment_hint=%s queue_id=%d player_id=%d",
		finish, smokeMarchTroopUnitCfgID, smokeINTG035DomesticQueueEtaSegmentHint(remainingSec), out.GetQueueId(), playerID)
	return true
}

// smokeINTG035DomesticQueueEtaSegmentHint mirrors CLIENT-212 formatDomesticQueueEtaSegmentLabel for smoke log contrast.
func smokeINTG035DomesticQueueEtaSegmentHint(remainingSec int64) string {
	if remainingSec < 1 {
		return "complete"
	}
	if remainingSec < 3600 {
		return "<1h"
	}
	if remainingSec >= 86400 {
		return ">1d"
	}
	return "今日内"
}

// smokeINTG035ListPlayerHeroesLoyaltyAndBagGrowthGateway logs first hero loyalty/exp hint and first growth bag item (CLIENT-213).
func smokeINTG035ListPlayerHeroesLoyaltyAndBagGrowthGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-035 HERO: gateway ListPlayerHeroes first hero_id/level+loyalty hint + ListPlayerBag growth item_id/count")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i35-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg035Failf(t, "list player heroes", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg035Failf(t, "decode list player heroes", "player_id=%d err=%v", playerID, err)
	}
	heroes := out.GetHeroes()
	if len(heroes) < 1 || out.GetTotalCount() < 1 {
		t.Logf("INTG-035: skip ListPlayerHeroes loyalty hint (empty list total=%d; hint hero.v1.RecruitHero — see tools/smoke/README.md)", out.GetTotalCount())
	} else {
		first := heroes[0]
		t.Logf("INTG-035: ListPlayerHeroes player_id=%d first_hero_id=%d level=%d loyalty=%d exp_hint=loyalty_field (no exp on summary proto)",
			playerID, first.GetHeroId(), first.GetLevel(), first.GetLoyalty())
	}

	bagResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i35-bag-growth", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if bagResp.Code != 0 {
		intg035Failf(t, "list player bag growth", "player_id=%d code=%d msg=%s", playerID, bagResp.Code, bagResp.Msg)
	}
	var bagOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(bagResp.Data, &bagOut); err != nil {
		intg035Failf(t, "decode list player bag growth", "player_id=%d err=%v", playerID, err)
	}
	items := bagOut.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-035: skip ListPlayerBag growth item_id/count (empty bag; hint M4 grant — see tools/smoke/README.md)")
		return
	}
	var picked *contentv1.PlayerItemStack
	for _, it := range items {
		if it.GetItemCfgId() >= 2000 {
			picked = it
			break
		}
	}
	if picked == nil {
		picked = items[0]
	}
	t.Logf("INTG-035: ListPlayerBag player_id=%d growth_item_id=%d count=%d entry_count=%d",
		playerID, picked.GetItemCfgId(), picked.GetQuantity(), len(items))
}

// smokeINTG035DualRankListLengthGateway logs list length and first player_id on power/resource boards (rank.v1.GetLeaderboard ≡ ListPowerRank/ListKillRank) (CLIENT-214).
func smokeINTG035DualRankListLengthGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-035 RANK: gateway GetLeaderboard PLAYER_POWER+PLAYER_RESOURCE (ListPowerRank/ListKillRank) length+first player_id+cooldown hint")
	_, err := pool.Exec(ctx, `UPDATE player SET power = 3600 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg035Failf(t, "seed power for dual rank", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		intg035Failf(t, "refresh ranks dual board", "err=%v", err)
	}
	smokeINTG035LogRankBoardHint(t, c, sid, playerID, rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER, "ListPowerRank")
	smokeINTG035LogRankBoardHint(t, c, sid, playerID, rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE, "ListKillRank")
}

func smokeINTG035LogRankBoardHint(t *testing.T, c *websocket.Conn, sid string, playerID int64, lbType rankv1.LeaderboardType, alias string) {
	t.Helper()
	trace := "i35-rank-power"
	if lbType == rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE {
		trace = "i35-rank-kill"
	}
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetLeaderboard, TraceId: trace, SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
			ServerId: intg006ServerID,
			Type:     lbType,
			Page:     1,
			PageSize: 20,
		}),
	})
	if resp.Code != 0 {
		intg035Failf(t, "get leaderboard dual rank", "alias=%s type=%v code=%d msg=%s", alias, lbType, resp.Code, resp.Msg)
	}
	var out rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg035Failf(t, "decode leaderboard dual rank", "alias=%s err=%v", alias, err)
	}
	entries := out.GetEntries()
	if out.GetTotalCount() < 1 || len(entries) < 1 {
		t.Logf("INTG-035: skip %s (GetLeaderboard type=%v empty total=%d; hint RefreshRanks — see tools/smoke/README.md)", alias, lbType, out.GetTotalCount())
		return
	}
	first := entries[0]
	t.Logf("INTG-035: %s entries_len=%d total_count=%d first_player_id=%d first_rank=%d snapshot_refreshed_at_ms=%d refresh_cooldown_hint=client_derived viewer_player_id=%d",
		alias, len(entries), out.GetTotalCount(), first.GetEntityId(), first.GetRank(), out.GetSnapshotRefreshedAtMs(), playerID)
}

// smokeINTG035RecruitCurrencyAndShopSKUGateway logs recruit template currency fields and first shop SKU price/currency on one contrast line (CLIENT-215).
func smokeINTG035RecruitCurrencyAndShopSKUGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-035 HERO+SHOP: gateway ListRecruitTemplates currency + ListShopShelf price/currency (ListShopShelf ≡ ListShopProducts)")
	tplResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListRecruitTemplates, TraceId: "i35-recruit-currency", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListRecruitTemplatesRequest{ServerId: intg006ServerID, PageSize: 50}),
	})
	currencyHint := "recruit_currency=skip"
	if tplResp.Code != 0 {
		t.Logf("INTG-035: skip ListRecruitTemplates currency (code=%d msg=%s — see tools/smoke/README.md)", tplResp.Code, tplResp.Msg)
	} else {
		var tplOut herov1.ListRecruitTemplatesResponse
		if err := proto.Unmarshal(tplResp.Data, &tplOut); err != nil {
			intg035Failf(t, "decode recruit templates currency", "player_id=%d err=%v", playerID, err)
		}
		var tpl *herov1.RecruitTemplatePreview
		for _, row := range tplOut.GetTemplates() {
			if row.GetTemplateCfgId() == smokeHeroTemplateCfgID {
				tpl = row
				break
			}
		}
		if tpl == nil && len(tplOut.GetTemplates()) > 0 {
			tpl = tplOut.GetTemplates()[0]
		}
		if tpl != nil {
			currencyHint = "recruit_" + smokeINTG031RecruitTemplateCurrencyHint(tpl)
		} else {
			currencyHint = "recruit_currency=no_templates"
		}
	}

	shopResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "i35-shop-currency", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	if shopResp.Code != 0 {
		intg035Failf(t, "list shop shelf currency contrast", "player_id=%d code=%d msg=%s", playerID, shopResp.Code, shopResp.Msg)
	}
	var shopOut shopv1.ListShopShelfResponse
	if err := proto.Unmarshal(shopResp.Data, &shopOut); err != nil {
		intg035Failf(t, "decode shop shelf currency contrast", "player_id=%d err=%v", playerID, err)
	}
	offers := shopOut.GetOffers()
	if len(offers) < 1 {
		t.Logf("INTG-035: skip ListShopShelf price/currency (%s; empty offers — see tools/smoke/README.md)", currencyHint)
		return
	}
	firstOffer := offers[0]
	price, currency := smokeINTG029ShopOfferPriceCurrency(firstOffer)
	t.Logf("INTG-035: recruit_shop_contrast player_id=%d %s first_offer_id=%d price=%d currency=%s",
		playerID, currencyHint, firstOffer.GetOfferId(), price, currency)
}

// smokeINTG035QuestChainMailHUDGateway logs claimable quest count, chain type hint, and unclaimed mail attachments (CLIENT-216/218).
func smokeINTG035QuestChainMailHUDGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-035 HUD: gateway ListPlayerQuests chain_id=%d claimable+chain hint + ListPlayerMail unclaimed", smokeDailyQuestChainID))

	chainHint := fmt.Sprintf("chain_id=%d", smokeDailyQuestChainID)
	chainResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetQuestChainStatus, TraceId: "i35-chain-status", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.GetQuestChainStatusRequest{ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID}),
	})
	if chainResp.Code == 0 {
		var chainOut questv1.GetQuestChainStatusResponse
		if err := proto.Unmarshal(chainResp.Data, &chainOut); err == nil && chainOut.GetChain() != nil {
			ch := chainOut.GetChain()
			chainHint = fmt.Sprintf("chain_id=%d chain_name=%q chain_state=%s completed=%d/%d",
				ch.GetChainId(), ch.GetChainName(), ch.GetChainState().String(),
				ch.GetCompletedQuestCount(), ch.GetTotalQuestCount())
		}
	}

	questResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i35-hud-quests", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		}),
	})
	if questResp.Code != 0 {
		intg035Failf(t, "list player quests hud chain", "player_id=%d code=%d msg=%s", playerID, questResp.Code, questResp.Msg)
	}
	var questOut questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(questResp.Data, &questOut); err != nil {
		intg035Failf(t, "decode list player quests hud chain", "player_id=%d err=%v", playerID, err)
	}
	var claimableCount int
	for _, q := range questOut.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
		}
	}

	const pageSize = 50
	mailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i35-hud-mail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId: intg006ServerID, Filter: contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize: pageSize, PageOffset: 0,
		}),
	})
	if mailResp.Code != 0 {
		intg035Failf(t, "list player mail hud chain", "player_id=%d code=%d msg=%s", playerID, mailResp.Code, mailResp.Msg)
	}
	var mailOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(mailResp.Data, &mailOut); err != nil {
		intg035Failf(t, "decode list player mail hud chain", "player_id=%d err=%v", playerID, err)
	}
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(mailOut.GetMails())

	if claimableCount < 1 && unclaimed < 1 && mailOut.GetTotalCount() < 1 {
		t.Logf("INTG-035: skip quest+mail HUD hint (%s claimable=0 unclaimed_mail=0; hint quest progress + GM send-mail — see tools/smoke/README.md)", chainHint)
		return
	}
	t.Logf("INTG-035: HUD quest_mail player_id=%d %s claimable_quest_count=%d unclaimed_attachment_count=%d mail_total=%d",
		playerID, chainHint, claimableCount, unclaimed, mailOut.GetTotalCount())
}

// smokeINTG035GuildOnlineAndChatGateway logs guild member online summary hint and first guild chat message id (CLIENT-217).
func smokeINTG035GuildOnlineAndChatGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	var guildID int64
	err := pool.QueryRow(ctx, `SELECT guild_id FROM guild_member WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) || guildID == 0 {
		t.Logf("INTG-035: skip ListGuildMembers online+chat (player not in guild — join via guild.v1.CreateGuild or INTG-010 optional social; see tools/smoke/README.md)")
		return
	}
	if err != nil {
		intg035Failf(t, "lookup guild membership", "player_id=%d err=%v", playerID, err)
	}
	smokeStep(t, fmt.Sprintf("INTG-035 GUILD: gateway ListGuildMembers guild_id=%d online hint + ListGuildChatMessages first id", guildID))
	memResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteListGuildMembers, TraceId: "i35-guild-online", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.ListGuildMembersRequest{
			ServerId: intg006ServerID, GuildId: guildID, Page: 1, PageSize: 50,
		}),
	})
	if memResp.Code != 0 {
		intg035Failf(t, "list guild members online", "guild_id=%d code=%d msg=%s", guildID, memResp.Code, memResp.Msg)
	}
	var memOut guildv1.ListGuildMembersResponse
	if err := proto.Unmarshal(memResp.Data, &memOut); err != nil {
		intg035Failf(t, "decode list guild members online", "guild_id=%d err=%v", guildID, err)
	}
	members := memOut.GetMembers()
	total := memOut.GetTotalCount()
	if total < 1 {
		total = int32(len(members))
	}
	onlineHint := fmt.Sprintf("members_total=%d online_count_hint=viewer_session_only online=1 (proto has no is_online)", total)
	t.Logf("INTG-035: ListGuildMembers guild_id=%d %s", guildID, onlineHint)

	smokeINTG035GuildChatFirstMessageIDHint(t, c, sid, guildID, playerID)
}

func smokeINTG035GuildChatFirstMessageIDHint(t *testing.T, c *websocket.Conn, sid string, guildID int64, playerID int64) {
	t.Helper()
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: chat.RouteListChatMessages, TraceId: "i35-guild-chat", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&chatv1.ListChatMessagesRequest{
			ServerId: intg006ServerID, Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD, GuildId: guildID, Limit: 20,
		}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-035: skip ListGuildChatMessages first id (guild_id=%d code=%d msg=%s — see tools/smoke/README.md)", guildID, listResp.Code, listResp.Msg)
		return
	}
	var listOut chatv1.ListChatMessagesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg035Failf(t, "decode guild chat messages", "guild_id=%d err=%v", guildID, err)
	}
	messages := listOut.GetMessages()
	if len(messages) < 1 {
		sendResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: chat.RouteSendChatMessage, TraceId: "i35-guild-chat-seed", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&chatv1.SendChatMessageRequest{
				ServerId: intg006ServerID, Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD, GuildId: guildID,
				Content: "INTG-035 guild chat seed",
			}),
		})
		if sendResp.Code != 0 {
			t.Logf("INTG-035: skip ListGuildChatMessages first id (empty chat send code=%d msg=%s — see tools/smoke/README.md)", sendResp.Code, sendResp.Msg)
			return
		}
		listResp = mustSend(t, c, &commonv1.ClientPacket{
			Route: chat.RouteListChatMessages, TraceId: "i35-guild-chat-relist", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&chatv1.ListChatMessagesRequest{
				ServerId: intg006ServerID, Channel: chatv1.ChatChannel_CHAT_CHANNEL_GUILD, GuildId: guildID, Limit: 20,
			}),
		})
		if listResp.Code != 0 {
			t.Logf("INTG-035: skip ListGuildChatMessages first id (relist code=%d msg=%s)", listResp.Code, listResp.Msg)
			return
		}
		if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
			intg035Failf(t, "decode guild chat relist", "guild_id=%d err=%v", guildID, err)
		}
		messages = listOut.GetMessages()
	}
	if len(messages) < 1 {
		t.Logf("INTG-035: skip ListGuildChatMessages first id (empty guild channel guild_id=%d — see tools/smoke/README.md)", guildID)
		return
	}
	first := messages[0]
	t.Logf("INTG-035: ListGuildChatMessages guild_id=%d first_message_id=%d player_id=%d (chat.v1.ListChatMessages ≡ guild.v1.ListGuildChatMessages)",
		guildID, first.GetMessageId(), playerID)
}

func intg035Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG035CfgHint, step, fmt.Sprintf(format, args...))
}
