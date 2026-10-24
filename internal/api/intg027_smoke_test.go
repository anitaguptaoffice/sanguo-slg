package api_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG027CfgHint = smokeINTG026CfgHint + "; INTG-027: GetCityState production_rates+wallet; ListPlayerQuests chain400 claimable+progress; ListPlayerHeroes level+loyalty; GetLeaderboard my_rank+my_score; ListPlayerBag quantity"

// TestINTG027Wave30SmokePath extends INTG-026 with HUD economy, daily progress, hero list, dual leaderboard, and bag stack fields for wave:30 CLIENT readouts.
func TestINTG027Wave30SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-027 wave:30 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG027Wave30Smoke(t)
}

func runINTG027Wave30Smoke(t *testing.T) {
	runINTG026SmokePath(t, smokeINTG027Wave30BeforeRestartGateway)
}

func smokeINTG027Wave30BeforeRestartGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64, cityID int64) {
	t.Helper()
	smokeINTG027GetCityStateProductionRatesWalletGateway(t, c, sid, playerID)
	smokeINTG027ListPlayerQuestsChain400ClaimableProgressGateway(t, c, sid, playerID)
	smokeINTG027ListPlayerHeroesLevelLoyaltyGateway(t, c, sid, playerID)
	smokeINTG027DualLeaderboardMyRankScoreGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG027ListPlayerBagQuantityGateway(t, c, sid, playerID)
}

// smokeINTG027GetCityStateProductionRatesWalletGateway logs production_rates and wallet balances on one line (CLIENT-148).
func smokeINTG027GetCityStateProductionRatesWalletGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		t.Logf("INTG-027: skip GetCityState production_rates+wallet (no city_id; hint create city — see tools/smoke/README.md)")
		return
	}
	smokeStep(t, fmt.Sprintf("INTG-027 DOM: gateway GetCityState city_id=%d production_rates+wallet", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	wallet := st.GetWallet()
	rates := st.GetProductionRates()
	if wallet == nil && rates == nil {
		t.Logf("INTG-027: skip GetCityState production_rates+wallet (missing wallet and production_rates; hint DOM gateway — see tools/smoke/README.md)")
		return
	}
	if wallet == nil {
		t.Logf("INTG-027: skip GetCityState wallet balances (missing wallet field; production_rates may still be present)")
	}
	if rates == nil {
		t.Logf("INTG-027: skip GetCityState production_rates (missing production_rates field; wallet may still be present)")
	}
	var resFood, resWood, resIron, resStone int64
	if wallet != nil {
		resFood, resWood, resIron, resStone = wallet.GetFood(), wallet.GetWood(), wallet.GetIron(), wallet.GetStone()
	}
	var rateFood, rateWood, rateIron, rateStone int64
	if rates != nil {
		rateFood, rateWood, rateIron, rateStone = rates.GetFood(), rates.GetWood(), rates.GetIron(), rates.GetStone()
	}
	t.Logf("INTG-027: GetCityState city_id=%d production_rates food=%d/h wood=%d/h iron=%d/h stone=%d/h | wallet food=%d wood=%d iron=%d stone=%d",
		cityID, rateFood, rateWood, rateIron, rateStone, resFood, resWood, resIron, resStone)
}

// smokeINTG027ListPlayerQuestsChain400ClaimableProgressGateway logs claimable count and first quest progress (CLIENT-150).
func smokeINTG027ListPlayerQuestsChain400ClaimableProgressGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-027 QUEST: gateway ListPlayerQuests chain_id=%d claimable+first progress", smokeDailyQuestChainID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerQuests, TraceId: "i27-quests", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId:         intg006ServerID,
			ChainId:          smokeDailyQuestChainID,
			IncludeCompleted: true,
		}),
	})
	if resp.Code != 0 {
		intg027Failf(t, "list player quests chain 400", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out questv1.ListPlayerQuestsResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg027Failf(t, "decode list player quests chain 400", "player_id=%d err=%v", playerID, err)
	}
	quests := out.GetQuests()
	if len(quests) < 1 {
		t.Logf("INTG-027: skip ListPlayerQuests chain_id=%d (empty chain; hint QUEST-002 seed — see tools/smoke/README.md)", smokeDailyQuestChainID)
		return
	}
	var claimable int32
	for _, q := range quests {
		if q.GetState() == questv1.PlayerQuestState_PLAYER_QUEST_STATE_CLAIMABLE {
			claimable++
		}
	}
	first := quests[0]
	cur, tgt := first.GetProgressCurrent(), first.GetProgressTarget()
	t.Logf("INTG-027: ListPlayerQuests chain_id=%d claimable_count=%d first progress_current=%d progress_target=%d",
		smokeDailyQuestChainID, claimable, cur, tgt)
}

// smokeINTG027ListPlayerHeroesLevelLoyaltyGateway logs total_count and first hero level/loyalty (CLIENT-151).
func smokeINTG027ListPlayerHeroesLevelLoyaltyGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-027 HERO: gateway ListPlayerHeroes total_count + first level+loyalty")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i27-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg027Failf(t, "list player heroes", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg027Failf(t, "decode list player heroes", "player_id=%d err=%v", playerID, err)
	}
	total := out.GetTotalCount()
	heroes := out.GetHeroes()
	if len(heroes) == 0 || total < 1 {
		t.Logf("INTG-027: skip ListPlayerHeroes level+loyalty (no heroes total_count=%d; hint hero.v1.RecruitHero — see tools/smoke/README.md)", total)
		return
	}
	first := heroes[0]
	t.Logf("INTG-027: ListPlayerHeroes player_id=%d total_count=%d first level=%d loyalty=%d",
		playerID, total, first.GetLevel(), first.GetLoyalty())
}

// smokeINTG027DualLeaderboardMyRankScoreGateway logs my_rank and my_score on power and resource boards (CLIENT-152).
func smokeINTG027DualLeaderboardMyRankScoreGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-027 RANK: seed power + RefreshRanks for PLAYER_POWER leaderboard")
	_, err := pool.Exec(ctx, `UPDATE player SET power = 3300 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg027Failf(t, "seed power for leaderboard", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		intg027Failf(t, "refresh ranks power", "err=%v", err)
	}
	smokeINTG027AssertLeaderboardMyRankScore(t, c, sid, rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER, playerID)

	smokeStep(t, "INTG-027 RANK: seed wallet + RefreshRanks for PLAYER_RESOURCE leaderboard")
	_, err = pool.Exec(ctx, `
		UPDATE player_wallet SET food = 8100, wood = 7100, iron = 1100, stone = 600, gold = 0
		WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg027Failf(t, "seed wallet for resource rank", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		intg027Failf(t, "refresh ranks resource", "err=%v", err)
	}
	smokeINTG027AssertLeaderboardMyRankScore(t, c, sid, rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE, playerID)
}

func smokeINTG027AssertLeaderboardMyRankScore(t *testing.T, c *websocket.Conn, sid string, lbType rankv1.LeaderboardType, viewerPlayerID int64) {
	t.Helper()
	trace := "i27-rank-power"
	typeLabel := "PLAYER_POWER"
	if lbType == rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE {
		trace = "i27-rank-resource"
		typeLabel = "PLAYER_RESOURCE"
	}
	smokeStep(t, fmt.Sprintf("INTG-027 RANK: gateway GetLeaderboard type=%s my_rank+my_score", typeLabel))
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
		intg027Failf(t, "get leaderboard", "type=%s code=%d msg=%s", typeLabel, resp.Code, resp.Msg)
	}
	var out rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg027Failf(t, "decode leaderboard", "type=%s err=%v", typeLabel, err)
	}
	myRank := out.GetMyRank()
	myScore := out.GetMyScore()
	t.Logf("INTG-027: GetLeaderboard type=%s total_count=%d my_rank=%d my_score=%d viewer_player_id=%d",
		typeLabel, out.GetTotalCount(), myRank, myScore, viewerPlayerID)
	if out.GetTotalCount() < 1 || len(out.GetEntries()) == 0 {
		t.Logf("INTG-027: dev empty leaderboard type=%s — my_rank=%d hint only (RefreshRanks / make dev-up); see tools/smoke/README.md", typeLabel, myRank)
		return
	}
	if myRank == 0 {
		intg027Failf(t, "leaderboard my_rank", "type=%s viewer_player_id=%d total=%d my_rank=0 want>0", typeLabel, viewerPlayerID, out.GetTotalCount())
	}
}

// smokeINTG027ListPlayerBagQuantityGateway logs entry count and first stack quantity (CLIENT-153).
func smokeINTG027ListPlayerBagQuantityGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-027 BAG: gateway ListPlayerBag entry_count + first quantity")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerBag, TraceId: "i27-bag", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerBagRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg027Failf(t, "list player bag", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg027Failf(t, "decode list player bag", "player_id=%d err=%v", playerID, err)
	}
	items := out.GetItems()
	entryCount := int32(len(items))
	if entryCount < 1 {
		t.Logf("INTG-027: skip ListPlayerBag quantity (empty bag; hint M4 grant / quest reward — see tools/smoke/README.md)")
		return
	}
	first := items[0]
	t.Logf("INTG-027: ListPlayerBag player_id=%d entry_count=%d first_quantity=%d first_item_cfg_id=%d",
		playerID, entryCount, first.GetQuantity(), first.GetItemCfgId())
}

func intg027Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG027CfgHint, step, fmt.Sprintf(format, args...))
}
