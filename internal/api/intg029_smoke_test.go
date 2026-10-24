package api_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeSecondaryQuestChainID = int32(401)

const smokeINTG029CfgHint = smokeINTG028CfgHint + "; INTG-029: GetCityState build_queue upgrade_finish_at_ms+first level; GetHeroDetail level+loyalty+upgrade_item hint; ListPlayerBag growth item_id+quantity; ListShopShelf price+currency; GetLeaderboard power Top1 player_id; ListPlayerQuests chain400/401 in_progress; ListPlayerCities x/y/name"

// TestINTG029Wave32SmokePath extends INTG-028 with build queue, hero detail growth items, bag, shop currency, leaderboard deep link, multi-chain daily tabs, and world grid for wave:32 CLIENT readouts.
func TestINTG029Wave32SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-029 wave:32 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG029Wave32Smoke(t)
}

func runINTG029Wave32Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG029Wave32BeforeRestartGateway)
}

func smokeINTG029Wave32BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG028Wave31BeforeRestartGateway(t, ctx, c, apiSrv, pool, sid, playerID, cityID)
	smokeINTG029GetCityStateBuildQueueFirstLevelGateway(t, c, sid, cityID, playerID)
	smokeINTG029GetHeroDetailLevelLoyaltyUpgradeItemGateway(t, c, sid, playerID)
	smokeINTG029ListPlayerBagGrowthItemGateway(t, c, sid, playerID)
	smokeINTG029ListShopShelfPriceCurrencyGateway(t, c, sid, playerID)
	smokeINTG029GetLeaderboardPowerTop1Gateway(t, c, sid, playerID)
	smokeINTG029ListPlayerQuestsChainsInProgressGateway(t, c, sid, playerID)
	smokeINTG029ListPlayerCitiesXYNameGateway(t, c, sid, playerID)
}

// smokeINTG029GetCityStateBuildQueueFirstLevelGateway logs first active build queue slot (upgrade_finish_at_ms) and first building level (CLIENT-164).
func smokeINTG029GetCityStateBuildQueueFirstLevelGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, playerID int64) {
	t.Helper()
	if cityID == 0 {
		cityID = smokeFirstPlayerCityID(t, c, sid)
	}
	if cityID == 0 {
		t.Logf("INTG-029: skip GetCityState build_queue+level (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-029 DOM: gateway GetCityState city_id=%d build_queue+first level", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	buildings := st.GetBuildings()
	if len(buildings) < 1 {
		t.Logf("INTG-029: skip GetCityState build_queue+level (empty buildings; hint DOM gateway — see tools/smoke/README.md)")
		return
	}
	first := buildings[0]
	nowMs := time.Now().UnixMilli()
	var queueSlot string
	var queueFinish int64
	for _, b := range buildings {
		finish := b.GetUpgradeFinishAtMs()
		if finish > nowMs {
			queueSlot = b.GetSlotKey()
			queueFinish = finish
			break
		}
	}
	if queueSlot == "" {
		t.Logf("INTG-029: skip GetCityState build_queue (no active upgrade_finish_at_ms>now; first_level=%d slot_key=%q; hint StartBuildingUpgrade — see tools/smoke/README.md)",
			first.GetLevel(), first.GetSlotKey())
	} else {
		t.Logf("INTG-029: GetCityState build_queue slot_key=%s upgrade_finish_at_ms=%d first_building_level=%d city_id=%d",
			queueSlot, queueFinish, first.GetLevel(), cityID)
		return
	}
	t.Logf("INTG-029: GetCityState first_building slot_key=%s level=%d upgrade_finish_at_ms=%d city_id=%d player_id=%d",
		first.GetSlotKey(), first.GetLevel(), first.GetUpgradeFinishAtMs(), cityID, playerID)
}

// smokeINTG029GetHeroDetailLevelLoyaltyUpgradeItemGateway logs level/loyalty and recruit-item hint when upgrade fields are absent on GetHeroDetail (CLIENT-165).
func smokeINTG029GetHeroDetailLevelLoyaltyUpgradeItemGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-029 HERO: gateway ListPlayerHeroes → GetHeroDetail level+loyalty+upgrade_item hint")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i29-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		intg029Failf(t, "list player heroes", "player_id=%d code=%d msg=%s", playerID, listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg029Failf(t, "decode list player heroes", "player_id=%d err=%v", playerID, err)
	}
	if len(listOut.GetHeroes()) < 1 {
		t.Logf("INTG-029: skip GetHeroDetail level+loyalty (no heroes; hint hero.v1.RecruitHero — see tools/smoke/README.md)")
		return
	}
	heroID := listOut.GetHeroes()[0].GetHeroId()
	detailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetHeroDetail, TraceId: "i29-hero-detail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.GetHeroDetailRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if detailResp.Code != 0 {
		intg029Failf(t, "get hero detail", "hero_id=%d code=%d msg=%s", heroID, detailResp.Code, detailResp.Msg)
	}
	var detailOut herov1.GetHeroDetailResponse
	if err := proto.Unmarshal(detailResp.Data, &detailOut); err != nil {
		intg029Failf(t, "decode hero detail", "hero_id=%d err=%v", heroID, err)
	}
	level, loyalty := detailOut.GetLevel(), detailOut.GetLoyalty()
	tplCfgID := detailOut.GetTemplateCfgId()

	tplResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListRecruitTemplates, TraceId: "i29-recruit-tpl", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListRecruitTemplatesRequest{ServerId: intg006ServerID, PageSize: 50}),
	})
	var upgradeItemID int32
	var upgradeQty int32
	if tplResp.Code == 0 {
		var tplOut herov1.ListRecruitTemplatesResponse
		if err := proto.Unmarshal(tplResp.Data, &tplOut); err == nil {
			for _, row := range tplOut.GetTemplates() {
				if row.GetTemplateCfgId() == tplCfgID {
					if item := row.GetRecruitItem(); item != nil && item.GetItemCfgId() > 0 {
						upgradeItemID = item.GetItemCfgId()
						upgradeQty = item.GetQuantity()
					}
					break
				}
			}
		}
	}
	if upgradeItemID > 0 {
		t.Logf("INTG-029: GetHeroDetail hero_id=%d level=%d loyalty=%d upgrade_item_item_id=%d quantity=%d (recruit_template_cfg_id=%d)",
			heroID, level, loyalty, upgradeItemID, upgradeQty, tplCfgID)
		return
	}
	t.Logf("INTG-029: GetHeroDetail hero_id=%d level=%d loyalty=%d (hint only: no upgrade_item fields on detail; recruit_item absent for template_cfg_id=%d — see tools/smoke/README.md)",
		heroID, level, loyalty, tplCfgID)
}

// smokeINTG029ListPlayerBagGrowthItemGateway logs first growth-related stack item_id (item_cfg_id) and quantity (CLIENT-165).
func smokeINTG029ListPlayerBagGrowthItemGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-029 BAG: gateway ListPlayerBag growth item_id+quantity")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i29-bag-growth", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg029Failf(t, "list player bag", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg029Failf(t, "decode list player bag", "player_id=%d err=%v", playerID, err)
	}
	items := out.GetItems()
	if len(items) < 1 {
		t.Logf("INTG-029: skip ListPlayerBag growth item (empty bag; hint M4 grant / quest reward — see tools/smoke/README.md)")
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
	t.Logf("INTG-029: ListPlayerBag player_id=%d item_id=%d quantity=%d entry_count=%d",
		playerID, picked.GetItemCfgId(), picked.GetQuantity(), len(items))
}

// smokeINTG029ListShopShelfPriceCurrencyGateway logs first offer price and currency label (CLIENT-167).
func smokeINTG029ListShopShelfPriceCurrencyGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-029 SHOP: gateway ListShopShelf first SKU price+currency")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "i29-shop", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg029Failf(t, "list shop shelf", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out shopv1.ListShopShelfResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg029Failf(t, "decode list shop shelf", "player_id=%d err=%v", playerID, err)
	}
	offers := out.GetOffers()
	if len(offers) < 1 {
		t.Logf("INTG-029: skip ListShopShelf price+currency (empty offers; hint shop catalog — see tools/smoke/README.md)")
		return
	}
	first := offers[0]
	price, currency := smokeINTG029ShopOfferPriceCurrency(first)
	t.Logf("INTG-029: ListShopShelf first_offer_id=%d price=%d currency=%s",
		first.GetOfferId(), price, currency)
}

func smokeINTG029ShopOfferPriceCurrency(offer *shopv1.ShopOffer) (price int64, currency string) {
	if offer == nil {
		return 0, "unknown"
	}
	pr := offer.GetPriceResources()
	if pr != nil {
		if pr.GetGold() > 0 {
			return pr.GetGold(), "gold"
		}
		if pr.GetFood() > 0 {
			return pr.GetFood(), "food"
		}
		if pr.GetWood() > 0 {
			return pr.GetWood(), "wood"
		}
		if pr.GetIron() > 0 {
			return pr.GetIron(), "iron"
		}
		if pr.GetStone() > 0 {
			return pr.GetStone(), "stone"
		}
	}
	if items := offer.GetPriceItems(); len(items) > 0 && items[0].GetItemCfgId() > 0 {
		return int64(items[0].GetQuantity()), fmt.Sprintf("item_cfg_id=%d", items[0].GetItemCfgId())
	}
	return 0, "resources"
}

// smokeINTG029GetLeaderboardPowerTop1Gateway logs rank-1 entity_id as player_id on the power board (CLIENT-168).
func smokeINTG029GetLeaderboardPowerTop1Gateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-029 RANK: gateway GetLeaderboard PLAYER_POWER Top1 player_id")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetLeaderboard, TraceId: "i29-rank-top1", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
			ServerId: intg006ServerID,
			Type:     rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER,
			Page:     1,
			PageSize: 5,
		}),
	})
	if resp.Code != 0 {
		intg029Failf(t, "get leaderboard top1", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg029Failf(t, "decode leaderboard top1", "player_id=%d err=%v", playerID, err)
	}
	entries := out.GetEntries()
	if out.GetTotalCount() < 1 || len(entries) < 1 {
		t.Logf("INTG-029: GetLeaderboard PLAYER_POWER Top1 hint only (empty board total=%d; RefreshRanks / make dev-up — see tools/smoke/README.md)",
			out.GetTotalCount())
		return
	}
	top := entries[0]
	topPlayerID := top.GetEntityId()
	t.Logf("INTG-029: GetLeaderboard PLAYER_POWER Top1 rank=%d player_id=%d score=%d viewer_player_id=%d total_count=%d",
		top.GetRank(), topPlayerID, top.GetScore(), playerID, out.GetTotalCount())
}

// smokeINTG029ListPlayerQuestsChainsInProgressGateway logs in-progress quest counts for daily chains 400 and 401 (CLIENT-169).
func smokeINTG029ListPlayerQuestsChainsInProgressGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeINTG029ListPlayerQuestsChainInProgressGateway(t, c, sid, playerID, smokeDailyQuestChainID)
	smokeINTG029ListPlayerQuestsChainInProgressGateway(t, c, sid, playerID, smokeSecondaryQuestChainID)
}

func smokeINTG029ListPlayerQuestsChainInProgressGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64, chainID int32) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-029 QUEST: gateway ListPlayerQuests chain_id=%d in_progress_count", chainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: fmt.Sprintf("i29-quests-%d", chainID), SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          chainID,
			IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg029Failf(t, "list player quests in progress", "chain_id=%d player_id=%d code=%d msg=%s", chainID, playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg029Failf(t, "decode list player quests in progress", "chain_id=%d player_id=%d err=%v", chainID, playerID, err)
	}
	quests := out.GetQuests()
	if len(quests) < 1 {
		t.Logf("INTG-029: ListPlayerQuests chain_id=%d hint only (empty chain; seed or CLIENT tab — see tools/smoke/README.md)", chainID)
		return
	}
	var inProgress int32
	for _, q := range quests {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_IN_PROGRESS {
			inProgress++
		}
	}
	t.Logf("INTG-029: ListPlayerQuests chain_id=%d in_progress_count=%d quest_count=%d player_id=%d",
		chainID, inProgress, len(quests), playerID)
}

// smokeINTG029ListPlayerCitiesXYNameGateway logs first city grid cell and name (CLIENT-170).
func smokeINTG029ListPlayerCitiesXYNameGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-029 WORLD: gateway ListPlayerCities x/y/name")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerCities, TraceId: "i29-cities", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&worldv1.ListPlayerCitiesRequest{}),
	})
	if resp.Code != 0 {
		intg029Failf(t, "list player cities", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out worldv1.ListPlayerCitiesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg029Failf(t, "decode list player cities", "player_id=%d err=%v", playerID, err)
	}
	cities := out.GetCities()
	if len(cities) < 1 {
		t.Logf("INTG-029: skip ListPlayerCities x/y/name (no cities; hint create city — see tools/smoke/README.md)")
		return
	}
	first := cities[0]
	t.Logf("INTG-029: ListPlayerCities player_id=%d cities_count=%d first_city_id=%d x=%d y=%d name=%q",
		playerID, len(cities), first.GetCityId(), first.GetX(), first.GetY(), first.GetName())
}

func intg029Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG029CfgHint, step, fmt.Sprintf(format, args...))
}
