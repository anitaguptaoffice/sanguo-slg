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
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
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

const smokeINTG033CfgHint = smokeINTG032CfgHint + "; INTG-033: GetCityState build_queue upgrade_finish_at_ms+building_cfg_id/level; ListPlayerHeroes hero_id/level+loyalty hint; ListGuildMembers role counts+ListChatMessages guild first message_id; RecruitHero validation/success hero_id+ListPlayerBag growth item_id; ListPlayerQuests claimable+ListPlayerMail unclaimed HUD merge"

// TestINTG033Wave36SmokePath extends INTG-032 with city queue remaining, hero growth contrast, guild/chat empty hints, recruit/bag form feedback, and HUD center-panel deep-link field hints for wave:36 CLIENT readouts.
func TestINTG033Wave36SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-033 wave:36 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG033Wave36Smoke(t)
}

func runINTG033Wave36Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG033Wave36BeforeRestartGateway)
}

func smokeINTG033Wave36BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG032Wave35BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG033GetCityStateBuildQueueRemainingGateway(t, c, sid, cityID, playerID)
	smokeINTG033ListPlayerHeroesLevelLoyaltyHintGateway(t, c, sid, playerID)
	smokeINTG033ListGuildMembersRoleCountsAndGuildChatGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG033RecruitHeroHintAndBagGrowthItemGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG033HUDQuestMailTodoMergedHintGateway(t, c, sid, playerID)
}

// smokeINTG033GetCityStateBuildQueueRemainingGateway logs first active build_queue upgrade_finish_at_ms with building_cfg_id/level (CLIENT-196/197).
func smokeINTG033GetCityStateBuildQueueRemainingGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-033: skip GetCityState build_queue remaining (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-033 DOM: gateway GetCityState city_id=%d build_queue first upgrade_finish_at_ms+building_cfg_id/level", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	buildings := st.GetBuildings()
	if len(buildings) < 1 {
		t.Logf("INTG-033: skip GetCityState build_queue (empty buildings; hint DOM gateway — see tools/smoke/README.md)")
		return
	}
	nowMs := time.Now().UnixMilli()
	for _, b := range buildings {
		finish := b.GetUpgradeFinishAtMs()
		if finish > nowMs {
			t.Logf("INTG-033: GetCityState build_queue upgrade_finish_at_ms=%d building_cfg_id=%d level=%d slot_key=%s city_id=%d player_id=%d",
				finish, b.GetBuildingCfgId(), b.GetLevel(), b.GetSlotKey(), cityID, playerID)
			return
		}
	}
	t.Logf("INTG-033: skip GetCityState build_queue upgrade_finish_at_ms (no active queue; hint StartBuildingUpgrade — see tools/smoke/README.md)")
}

// smokeINTG033ListPlayerHeroesLevelLoyaltyHintGateway logs first hero_id/level and loyalty as growth contrast hint (CLIENT-198/199).
func smokeINTG033ListPlayerHeroesLevelLoyaltyHintGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-033 HERO: gateway ListPlayerHeroes first hero_id/level+loyalty hint")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i33-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg033Failf(t, "list player heroes", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg033Failf(t, "decode list player heroes", "player_id=%d err=%v", playerID, err)
	}
	heroes := out.GetHeroes()
	if len(heroes) < 1 || out.GetTotalCount() < 1 {
		t.Logf("INTG-033: skip ListPlayerHeroes level+loyalty hint (empty list total=%d; hint hero.v1.RecruitHero — see tools/smoke/README.md)", out.GetTotalCount())
		return
	}
	first := heroes[0]
	t.Logf("INTG-033: ListPlayerHeroes player_id=%d first_hero_id=%d level=%d loyalty=%d exp_hint=loyalty_field (no exp on summary proto)",
		playerID, first.GetHeroId(), first.GetLevel(), first.GetLoyalty())
}

// smokeINTG033ListGuildMembersRoleCountsAndGuildChatGateway logs per-role counts and first guild chat message_id via chat.v1.ListChatMessages (CLIENT-200).
func smokeINTG033ListGuildMembersRoleCountsAndGuildChatGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	var guildID int64
	err := pool.QueryRow(ctx, `SELECT guild_id FROM guild_member WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) || guildID == 0 {
		t.Logf("INTG-033: skip ListGuildMembers+guild chat (player not in guild — join via guild.v1.CreateGuild or INTG-010 optional social; see tools/smoke/README.md)")
		return
	}
	if err != nil {
		intg033Failf(t, "lookup guild membership", "player_id=%d err=%v", playerID, err)
	}
	smokeStep(t, fmt.Sprintf("INTG-033 GUILD: gateway ListGuildMembers guild_id=%d role counts + guild ListChatMessages", guildID))
	memResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteListGuildMembers, TraceId: "i33-guild-roles", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.ListGuildMembersRequest{
			ServerId: intg006ServerID,
			GuildId:  guildID,
			Page:     1,
			PageSize: 50,
		}),
	})
	if memResp.Code != 0 {
		intg033Failf(t, "list guild members", "guild_id=%d code=%d msg=%s", guildID, memResp.Code, memResp.Msg)
	}
	var memOut guildv1.ListGuildMembersResponse
	if err := proto.Unmarshal(memResp.Data, &memOut); err != nil {
		intg033Failf(t, "decode list guild members", "guild_id=%d err=%v", guildID, err)
	}
	members := memOut.GetMembers()
	roleCounts := make(map[guildv1.GuildMemberRole]int)
	for _, m := range members {
		roleCounts[m.GetRole()]++
	}
	var roleParts []string
	for role, count := range roleCounts {
		roleParts = append(roleParts, fmt.Sprintf("%s=%d", role.String(), count))
	}
	t.Logf("INTG-033: ListGuildMembers guild_id=%d members_count=%d role_counts=[%s]",
		guildID, len(members), strings.Join(roleParts, " "))

	smokeINTG033GuildChatFirstMessageIDHint(t, c, sid, guildID, playerID)
}

func smokeINTG033GuildChatFirstMessageIDHint(t *testing.T, c *websocket.Conn, sid string, guildID int64, playerID int64) {
	t.Helper()
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: chat.RouteListChatMessages, TraceId: "i33-guild-chat", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&chatv1.ListChatMessagesRequest{
			ServerId: intg006ServerID,
			Channel:  chatv1.ChatChannel_CHAT_CHANNEL_GUILD,
			GuildId:  guildID,
			Limit:    20,
		}),
	})
	if listResp.Code != 0 {
		t.Logf("INTG-033: skip guild ListChatMessages (guild_id=%d code=%d msg=%s — see tools/smoke/README.md)", guildID, listResp.Code, listResp.Msg)
		return
	}
	var listOut chatv1.ListChatMessagesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg033Failf(t, "decode guild chat list", "guild_id=%d err=%v", guildID, err)
	}
	messages := listOut.GetMessages()
	if len(messages) < 1 {
		sendResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: chat.RouteSendChatMessage, TraceId: "i33-guild-chat-send", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&chatv1.SendChatMessageRequest{
				ServerId: intg006ServerID,
				Channel:  chatv1.ChatChannel_CHAT_CHANNEL_GUILD,
				GuildId:  guildID,
				Content:  "intg-033 guild smoke",
			}),
		})
		if sendResp.Code != 0 {
			t.Logf("INTG-033: skip guild chat message_id hint (empty chat; send code=%d msg=%s — see tools/smoke/README.md)", sendResp.Code, sendResp.Msg)
			return
		}
		listResp = mustSend(t, c, &commonv1.ClientPacket{
			Route: chat.RouteListChatMessages, TraceId: "i33-guild-chat-relist", SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&chatv1.ListChatMessagesRequest{
				ServerId: intg006ServerID,
				Channel:  chatv1.ChatChannel_CHAT_CHANNEL_GUILD,
				GuildId:  guildID,
				Limit:    20,
			}),
		})
		if listResp.Code != 0 {
			t.Logf("INTG-033: skip guild chat message_id hint (relist code=%d msg=%s)", listResp.Code, listResp.Msg)
			return
		}
		if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
			intg033Failf(t, "decode guild chat relist", "guild_id=%d err=%v", guildID, err)
		}
		messages = listOut.GetMessages()
	}
	if len(messages) < 1 {
		t.Logf("INTG-033: skip guild ListChatMessages first message_id (empty guild channel guild_id=%d — see tools/smoke/README.md)", guildID)
		return
	}
	first := messages[0]
	t.Logf("INTG-033: ListChatMessages GUILD guild_id=%d first_message_id=%d player_id=%d",
		guildID, first.GetMessageId(), playerID)
}

// smokeINTG033RecruitHeroHintAndBagGrowthItemGateway logs RecruitHero validation or success hero_id and first growth bag item_id (CLIENT-201).
func smokeINTG033RecruitHeroHintAndBagGrowthItemGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-033 HERO: gateway RecruitHero validation/success hero_id hint")
	tplResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListRecruitTemplates, TraceId: "i33-recruit-tpl", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListRecruitTemplatesRequest{ServerId: intg006ServerID, PageSize: 50}),
	})
	if tplResp.Code != 0 {
		t.Logf("INTG-033: skip RecruitHero hint (ListRecruitTemplates code=%d msg=%s — see tools/smoke/README.md)", tplResp.Code, tplResp.Msg)
		smokeINTG033ListPlayerBagGrowthItemHintGateway(t, c, sid, playerID)
		return
	}
	var tplOut herov1.ListRecruitTemplatesResponse
	if err := proto.Unmarshal(tplResp.Data, &tplOut); err != nil {
		intg033Failf(t, "decode recruit templates", "player_id=%d err=%v", playerID, err)
	}
	var hasTemplate bool
	for _, row := range tplOut.GetTemplates() {
		if row.GetTemplateCfgId() == smokeHeroTemplateCfgID {
			hasTemplate = true
			break
		}
	}
	if !hasTemplate {
		t.Logf("INTG-033: skip RecruitHero hint (template_cfg_id=%d missing; hint DATA-002 cfg_hero_template — see tools/smoke/README.md)", smokeHeroTemplateCfgID)
		smokeINTG033ListPlayerBagGrowthItemHintGateway(t, c, sid, playerID)
		return
	}

	failResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitHero, TraceId: "i33-recruit-fail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RecruitHeroRequest{ServerId: intg006ServerID, TemplateCfgId: smokeHeroTemplateCfgID}),
	})
	heroHint := fmt.Sprintf("validation code=%d msg=%s", failResp.Code, failResp.Msg)
	if failResp.Code == 0 {
		var recruitOut herov1.RecruitHeroResponse
		if err := proto.Unmarshal(failResp.Data, &recruitOut); err == nil && recruitOut.GetHeroId() > 0 {
			heroHint = fmt.Sprintf("success hero_id=%d template_cfg_id=%d", recruitOut.GetHeroId(), recruitOut.GetTemplateCfgId())
		}
	} else {
		audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-033", TicketID: "T-i33-hero"}
		_, _, grantErr := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
			Items: []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 2}},
			Resources: map[string]int64{
				"food": 25000, "wood": 25000, "iron": 25000, "stone": 25000,
			},
		}, "intg-033-hero-seed")
		if grantErr != nil {
			t.Logf("INTG-033: RecruitHero hint=%s (gm grant err=%v)", heroHint, grantErr)
		} else {
			okResp := mustSend(t, c, &commonv1.ClientPacket{
				Route: api.RouteRecruitHero, TraceId: "i33-recruit-ok", SessionId: sid, ServerId: intg006ServerID,
				Payload: mustMarshal(&herov1.RecruitHeroRequest{ServerId: intg006ServerID, TemplateCfgId: smokeHeroTemplateCfgID}),
			})
			if okResp.Code == 0 {
				var recruitOut herov1.RecruitHeroResponse
				if err := proto.Unmarshal(okResp.Data, &recruitOut); err == nil && recruitOut.GetHeroId() > 0 {
					heroHint = fmt.Sprintf("success hero_id=%d template_cfg_id=%d", recruitOut.GetHeroId(), recruitOut.GetTemplateCfgId())
				}
			} else {
				heroHint = fmt.Sprintf("post-grant code=%d msg=%s", okResp.Code, okResp.Msg)
			}
		}
	}
	t.Logf("INTG-033: RecruitHero player_id=%d template_cfg_id=%d %s", playerID, smokeHeroTemplateCfgID, heroHint)
	smokeINTG033ListPlayerBagGrowthItemHintGateway(t, c, sid, playerID)
}

func smokeINTG033ListPlayerBagGrowthItemHintGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-033 BAG: gateway ListPlayerBag first growth item_id hint")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i33-bag-growth", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg033Failf(t, "list player bag growth", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg033Failf(t, "decode list player bag growth", "player_id=%d err=%v", playerID, err)
	}
	items := out.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-033: skip ListPlayerBag growth item_id (empty bag; hint M4 grant — see tools/smoke/README.md)")
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
	t.Logf("INTG-033: ListPlayerBag player_id=%d growth_item_id=%d quantity=%d entry_count=%d",
		playerID, picked.GetItemCfgId(), picked.GetQuantity(), len(items))
}

// smokeINTG033HUDQuestMailTodoMergedHintGateway merges daily claimable quest count and unclaimed mail attachment count for HUD deep links (CLIENT-202).
func smokeINTG033HUDQuestMailTodoMergedHintGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-033 HUD: gateway ListPlayerQuests chain_id=%d claimable + ListPlayerMail unclaimed merge hint", smokeDailyQuestChainID))
	questResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i33-hud-quests", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          smokeDailyQuestChainID,
			IncludeCompleted: true,
		}),
	})
	if questResp.Code != 0 {
		intg033Failf(t, "list player quests hud", "player_id=%d code=%d msg=%s", playerID, questResp.Code, questResp.Msg)
	}
	var questOut questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(questResp.Data, &questOut); err != nil {
		intg033Failf(t, "decode list player quests hud", "player_id=%d err=%v", playerID, err)
	}
	var claimableCount int
	for _, q := range questOut.GetQuests() {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimableCount++
		}
	}

	const pageSize = 50
	mailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i33-hud-mail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if mailResp.Code != 0 {
		intg033Failf(t, "list player mail hud", "player_id=%d code=%d msg=%s", playerID, mailResp.Code, mailResp.Msg)
	}
	var mailOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(mailResp.Data, &mailOut); err != nil {
		intg033Failf(t, "decode list player mail hud", "player_id=%d err=%v", playerID, err)
	}
	unclaimedMail := smokeINTG020CountMailsWithUnclaimedAttachments(mailOut.GetMails())

	if claimableCount < 1 && unclaimedMail < 1 && mailOut.GetTotalCount() < 1 && len(questOut.GetQuests()) < 1 {
		t.Logf("INTG-033: skip HUD merge hint (chain_id=%d claimable=0 unclaimed_mail=0; hint quest progress + GM send-mail — see tools/smoke/README.md)",
			smokeDailyQuestChainID)
		return
	}
	t.Logf("INTG-033: HUD todo merge player_id=%d quest_chain_id=%d claimable_quest_count=%d unclaimed_attachment_count=%d mail_total=%d",
		playerID, smokeDailyQuestChainID, claimableCount, unclaimedMail, mailOut.GetTotalCount())
}

func intg033Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG033CfgHint, step, fmt.Sprintf(format, args...))
}
