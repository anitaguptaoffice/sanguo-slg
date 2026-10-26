package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

const smokeINTG025CfgHint = smokeINTG024CfgHint + "; INTG-025: GetCityState seven-slot slot_key+level+upgrade_finish_at_ms+production_rates; ListPlayerHeroes total_count+first hero_id+level+loyalty"

// MAIN_CITY_SLOTS layout keys (CLIENT-128..131); gateway may omit slots on fresh cities.
var smokeINTG025SevenBuildingSlotKeys = []string{"wall", "iron", "farm", "lumber", "quarry", "barracks", "hall"}

// TestINTG025Wave28SmokePath extends INTG-024 with seven-slot city buildings, hero list summary, and HUD production_rates.
func TestINTG025Wave28SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-025 wave:28 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG025Wave28Smoke(t)
}

func runINTG025Wave28Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg025Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg025Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg025Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg025_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeINTG023ListPlayerBagGateway(t, c, sid, playerID)
	smokeINTG020ListShopShelfOfferPricesGateway(t, c, sid, playerID)
	smokeINTG018GetHeroDetailLevelLoyaltyGateway(t, c, sid, playerID)
	smokeINTG025ListPlayerHeroesFirstHeroGateway(t, c, sid, playerID)
	smokeINTG023GetHeroDetailFirstHeroGateway(t, c, sid, playerID)

	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG017ListMarchesGridGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	smokeINTG023ListMarchesPhaseArriveAtGateway(t, c, sid, cityID, marchID)
	smokeINTG024ListMarchesPhaseCountsGateway(t, c, sid, cityID, marchID)
	smokeINTG017ListBattleReportsTimeOutcomeGateway(t, c, sid, playerID)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
	smokeINTG024ListBattleReportsWinLoseGateway(t, c, sid, playerID)
	smokeINTG014GetBattleReportGateway(t, c, sid, playerID, reportID)
	smokeINTG018GetBattleReportRoundsGateway(t, c, sid, playerID, reportID)

	smokeINTG016ListPlayerMailPaginationGateway(t, c, sid, playerID)
	smokeINTG016GetCityStateBuildingsGateway(t, c, sid, playerID)
	smokeINTG020GetCityStateBuildingLevelGateway(t, c, sid, playerID)
	smokeINTG019GetCityStateResourcesProductionRatesGateway(t, c, sid, playerID)
	smokeINTG022ListPlayerCitiesXYNameGateway(t, c, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG022GetCityStateInProgressBuildSlotsGateway(t, c, sid, playerID)
	smokeINTG025GetCityStateSevenSlotsProductionRatesGateway(t, c, sid, playerID)
	ext.Base.Bag2003 += smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG022ListPlayerQuestsChain400TodoGateway(t, c, sid, playerID)
	smokeINTG024ListPlayerQuestsChain400ClaimableGateway(t, c, sid, playerID)

	ext.Base.Gold = smokeINTG021DualLeaderboardMyRankScoreGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	bagBeforeUse := smokeINTG023ListPlayerBagGateway(t, c, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG023VerifyBagStackAfterUseOptional(t, c, sid, playerID, smokeItemRewardCfgID, bagBeforeUse, consumed2001)
	shopGold, shopItems, shopBought := smokeINTG023PurchaseShopOfferOptional(t, ctx, c, apiSrv, sid, playerID)
	ext.Base.Gold += shopGold
	ext.Bag2001 += shopItems
	ext.Base.ShopDailyBought += shopBought
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG021ListGuildMembersRoleGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG021RecruitHeroOptional(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG012MailMarkReadGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG020ListPlayerMailUnclaimedAttachmentGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG022ListPlayerMailUnreadCountGateway(t, c, sid, playerID)
	smokeINTG024ListPlayerMailUnreadUnclaimedGateway(t, c, sid, playerID)
	mailGranted := smokeINTG013MailClaimAttachmentsGateway(t, ctx, c, pool, apiSrv, sid, playerID)
	smokeINTG023RecruitTroopOptional(t, c, sid, cityID, marchID)

	want := intg009PersistSnapshot{intg008PersistSnapshot: ext, MarchID: marchID}
	if consumed2001 > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 -= consumed2001
	}
	if speedupUsed > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Base.Bag2003 -= speedupUsed
	}
	if mailGranted > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 += mailGranted
	}

	ts.Close()
	_ = c.Close()

	pool2 := reopenDBPool(t)
	apiSrv2, ts2, wsURL2 := startData002SmokeGateway(t, log, pool2, worldStore)
	defer ts2.Close()

	c2 := dial(t, wsURL2)
	defer func() { _ = c2.Close() }()

	sid2, _ := smokeLoginOnly(t, c2, loginName)
	assertINTG009Persistence(t, ctx, pool2, apiSrv2, c2, sid2, playerID, want)
	runData002M3Subset(t, ctx, c2, apiSrv2, pool2, sid2, playerID)
}

// smokeINTG025GetCityStateSevenSlotsProductionRatesGateway logs seven MAIN_CITY slot rows and production_rates on one GetCityState (CLIENT-130/131/134).
func smokeINTG025GetCityStateSevenSlotsProductionRatesGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		intg025Failf(t, "get city state seven slots", "player_id=%d no player city", playerID)
	}
	smokeStep(t, fmt.Sprintf("INTG-025 DOM: gateway GetCityState city_id=%d seven-slot buildings+production_rates", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	bySlot := make(map[string]struct {
		level             int32
		upgradeFinishAtMs int64
	})
	for _, b := range st.GetBuildings() {
		key := b.GetSlotKey()
		if key == "" {
			continue
		}
		bySlot[key] = struct {
			level             int32
			upgradeFinishAtMs int64
		}{level: b.GetLevel(), upgradeFinishAtMs: b.GetUpgradeFinishAtMs()}
	}
	var slotParts []string
	var missing []string
	for _, wantKey := range smokeINTG025SevenBuildingSlotKeys {
		row, ok := bySlot[wantKey]
		if !ok {
			missing = append(missing, wantKey)
			continue
		}
		slotParts = append(slotParts, fmt.Sprintf("%s(level=%d,upgrade_finish_at_ms=%d)", wantKey, row.level, row.upgradeFinishAtMs))
	}
	rates := st.GetProductionRates()
	if rates == nil {
		intg025Failf(t, "get city state production_rates", "city_id=%d missing production_rates field", cityID)
	}
	rateFood, rateWood, rateIron, rateStone := rates.GetFood(), rates.GetWood(), rates.GetIron(), rates.GetStone()
	t.Logf("INTG-025: GetCityState city_id=%d production_rates food=%d/h wood=%d/h iron=%d/h stone=%d/h | seven-slot buildings [%s]",
		cityID, rateFood, rateWood, rateIron, rateStone, strings.Join(slotParts, " "))
	if len(missing) > 0 {
		t.Logf("INTG-025: skip missing building slots (hint seed or DOM may not expose all seven yet): %s", strings.Join(missing, ", "))
	}
	if len(slotParts) == 0 {
		t.Logf("INTG-025: skip seven-slot summary (no expected slot_key rows in GetCityState.buildings; see tools/smoke/README.md)")
	}
}

// smokeINTG025ListPlayerHeroesFirstHeroGateway logs total_count and first hero level/loyalty (CLIENT-132/133).
func smokeINTG025ListPlayerHeroesFirstHeroGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-025 HERO: gateway ListPlayerHeroes total_count + first hero_id+level+loyalty")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i25-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg025Failf(t, "list player heroes", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg025Failf(t, "decode list player heroes", "player_id=%d err=%v", playerID, err)
	}
	total := out.GetTotalCount()
	heroes := out.GetHeroes()
	if len(heroes) == 0 || total < 1 {
		t.Logf("INTG-025: skip ListPlayerHeroes first hero (no heroes total_count=%d; hint recruit via hero.v1.RecruitHero — see tools/smoke/README.md)", total)
		return
	}
	first := heroes[0]
	t.Logf("INTG-025: ListPlayerHeroes player_id=%d total_count=%d first_hero_id=%d level=%d loyalty=%d",
		playerID, total, first.GetHeroId(), first.GetLevel(), first.GetLoyalty())
	if first.GetHeroId() == 0 {
		intg025Failf(t, "list player heroes", "player_id=%d first row missing hero_id", playerID)
	}
}

func intg025Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG025CfgHint, step, fmt.Sprintf(format, args...))
}
