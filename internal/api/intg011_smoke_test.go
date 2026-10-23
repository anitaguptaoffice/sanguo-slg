package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const (
	smokeDailyMarchQuestCfgID  = int32(1033)
	smokeMarchRationItemCfgID  = int32(2020)
	smokeDailyMarchUnlockLvl   = int32(14)
	smokeINTG011BuildSpeedSlot = "hall"
	smokeINTG011BuildSpeedCfg  = int32(1)
)

const smokeINTG011CfgHint = smokeINTG010CfgHint + "; INTG-011: UseConsumable item_cfg_id=2003 build speedup; daily_train_1 quest_cfg_id=1014 or daily_build_1 quest_cfg_id=1032; optional daily_march_1 quest_cfg_id=1033 item_cfg_id=2020"

// TestINTG011Wave14SmokePath extends INTG-010 with DOM-003 build speedup and QUEST-003 mandatory daily train/build.
func TestINTG011Wave14SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-011 wave:14 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG011Wave14Smoke(t)
}

func runINTG011Wave14Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg011Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg011Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg011Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg011_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	marchID := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)

	smokeINTG010DualLeaderboardGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)

	want := intg009PersistSnapshot{intg008PersistSnapshot: ext, MarchID: marchID}
	if consumed2001 > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 -= consumed2001
	}
	if speedupUsed > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Base.Bag2003 -= speedupUsed
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

// smokeINTG011BuildSpeedupGateway returns 1 when item_cfg_id 2003 was consumed for an active build job.
func smokeINTG011BuildSpeedupGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) int32 {
	t.Helper()
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		intg011Failf(t, "build speedup", "no player city for GetCityState")
	}
	smokeStep(t, fmt.Sprintf("INTG-011 DOM-003: StartBuildingUpgrade slot=%s building_cfg_id=%d", smokeINTG011BuildSpeedSlot, smokeINTG011BuildSpeedCfg))
	upResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartBuildingUpgrade, TraceId: "i11-up", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&domesticv1.StartBuildingUpgradeRequest{
			CityId: cityID, SlotKey: smokeINTG011BuildSpeedSlot, BuildingCfgId: smokeINTG011BuildSpeedCfg,
		}),
	})
	if upResp.Code != 0 {
		intg011Failf(t, "start building upgrade", "slot=%s code=%d msg=%s", smokeINTG011BuildSpeedSlot, upResp.Code, upResp.Msg)
	}
	slotKey, beforeMS := smokeActiveUpgradeFinishMS(t, c, sid, cityID)
	if beforeMS <= 0 {
		intg011Failf(t, "build speedup before", "slot=%s upgrade_finish_at_ms=%d", slotKey, beforeMS)
	}

	smokeStep(t, fmt.Sprintf("INTG-011 DOM-003: UseConsumable item_cfg_id=%d on active build", smokeItemGrantCfgID))
	useResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteUseConsumable, TraceId: "i11-speed", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.UseConsumableRequest{
			ServerId: intg006ServerID, ItemCfgId: smokeItemGrantCfgID, Count: 1,
		}),
	})
	if useResp.Code != 0 {
		intg011Failf(t, "use build speedup", "item_cfg_id=%d code=%d msg=%s", smokeItemGrantCfgID, useResp.Code, useResp.Msg)
	}
	var useOut contentv1.UseConsumableResponse
	if err := proto.Unmarshal(useResp.Data, &useOut); err != nil {
		intg011Failf(t, "decode use build speedup", "err=%v", err)
	}
	if useOut.GetSpeedupSeconds() <= 0 {
		intg011Failf(t, "use build speedup", "item_cfg_id=%d speedup_seconds=%d", smokeItemGrantCfgID, useOut.GetSpeedupSeconds())
	}

	_, afterMS := smokeActiveUpgradeFinishMS(t, c, sid, cityID)
	if afterMS >= beforeMS {
		intg011Failf(t, "build speedup finish_at", "slot_key=%s before_ms=%d after_ms=%d", slotKey, beforeMS, afterMS)
	}
	deltaMS := beforeMS - afterMS
	t.Logf("INTG-011: build speedup slot_key=%s delta_ms=%d (before=%d after=%d)", slotKey, deltaMS, beforeMS, afterMS)
	_ = ctx
	_ = apiSrv
	_ = playerID
	return 1
}

func smokeActiveUpgradeFinishMS(t *testing.T, c *websocket.Conn, sid string, cityID int64) (slotKey string, finishMS int64) {
	t.Helper()
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	var bestSlot string
	var bestFinish int64
	for _, b := range st.GetBuildings() {
		f := b.GetUpgradeFinishAtMs()
		if f > bestFinish {
			bestFinish = f
			bestSlot = b.GetSlotKey()
		}
	}
	return bestSlot, bestFinish
}

func smokeGatewayGetCityState(t *testing.T, c *websocket.Conn, sid string, cityID int64) *domesticv1.GetCityStateResponse {
	t.Helper()
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetCityState, TraceId: "i11-city", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&domesticv1.GetCityStateRequest{CityId: cityID}),
	})
	if resp.Code != 0 {
		intg011Failf(t, "get city state", "city_id=%d code=%d msg=%s", cityID, resp.Code, resp.Msg)
	}
	var out domesticv1.GetCityStateResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg011Failf(t, "decode city state", "err=%v", err)
	}
	return &out
}

func smokeINTG011DailyTrainOrBuildMandatory(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	if smokeINTG011TryTrainDailyMandatory(t, ctx, c, apiSrv, pool, sid, playerID) {
		return
	}
	if smokeINTG011TryBuildDailyMandatory(t, ctx, c, apiSrv, pool, sid, playerID) {
		return
	}
	intg011Failf(t, "daily quest chain", "quest_cfg_id=%d and quest_cfg_id=%d not claimable",
		smokeDailyTrainQuestCfgID, smokeDailyBuildQuestCfgID)
}

func smokeINTG011TryTrainDailyMandatory(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) bool {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-011 QUEST-003: accept daily_train_1 quest_cfg_id=%d", smokeDailyTrainQuestCfgID))
	_, err := pool.Exec(ctx, `UPDATE player SET level = $3 WHERE server_id = $1 AND player_id = $2`,
		intg006ServerID, playerID, smokeDailyTrainUnlockLvl)
	if err != nil {
		intg011Failf(t, "seed level for daily_train_1", "quest_cfg_id=%d err=%v", smokeDailyTrainQuestCfgID, err)
	}
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "i11-train-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyTrainQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		t.Logf("INTG-011: daily_train_1 accept failed quest_cfg_id=%d code=%d msg=%s", smokeDailyTrainQuestCfgID, acceptResp.Code, acceptResp.Msg)
		return false
	}
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		t.Logf("INTG-011: daily_train_1 skipped quest_cfg_id=%d (no city)", smokeDailyTrainQuestCfgID)
		return false
	}
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 0)
	for i := 0; i < 3; i++ {
		recruitResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteRecruitTroop, TraceId: fmt.Sprintf("i11-train-r%d", i), SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
				CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 20,
			}),
		})
		if recruitResp.Code != 0 {
			t.Logf("INTG-011: daily_train_1 recruit failed quest_cfg_id=%d code=%d msg=%s", smokeDailyTrainQuestCfgID, recruitResp.Code, recruitResp.Msg)
			return false
		}
	}
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "i11-train-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyTrainQuestCfgID}),
	})
	if claimResp.Code != 0 {
		t.Logf("INTG-011: daily_train_1 claim failed quest_cfg_id=%d code=%d msg=%s", smokeDailyTrainQuestCfgID, claimResp.Code, claimResp.Msg)
		return false
	}
	t.Logf("INTG-011: daily_train_1 claimed quest_cfg_id=%d", smokeDailyTrainQuestCfgID)
	return true
}

func smokeINTG011TryBuildDailyMandatory(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) bool {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-011 QUEST-003: accept daily_build_1 quest_cfg_id=%d", smokeDailyBuildQuestCfgID))
	_, err := pool.Exec(ctx, `UPDATE player SET level = $3 WHERE server_id = $1 AND player_id = $2`,
		intg006ServerID, playerID, smokeDailyBuildUnlockLvl)
	if err != nil {
		intg011Failf(t, "seed level for daily_build_1", "quest_cfg_id=%d err=%v", smokeDailyBuildQuestCfgID, err)
	}
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "i11-build-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyBuildQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		t.Logf("INTG-011: daily_build_1 accept failed quest_cfg_id=%d code=%d msg=%s", smokeDailyBuildQuestCfgID, acceptResp.Code, acceptResp.Msg)
		return false
	}
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		t.Logf("INTG-011: daily_build_1 skipped quest_cfg_id=%d (no city)", smokeDailyBuildQuestCfgID)
		return false
	}
	if !smokeINTG011GatewayStartUpgrade(t, c, sid, cityID, "hall", 1) {
		return false
	}
	smokeINTG011FinishActiveBuildWithSpeedup(t, ctx, c, apiSrv, playerID, sid, cityID, "hall")
	if !smokeINTG011GatewayStartUpgrade(t, c, sid, cityID, "farm", 2) {
		return false
	}
	smokeINTG011FinishActiveBuildWithSpeedup(t, ctx, c, apiSrv, playerID, sid, cityID, "farm")
	_ = smokeGatewayGetCityState(t, c, sid, cityID)

	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "i11-build-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyBuildQuestCfgID}),
	})
	if claimResp.Code != 0 {
		t.Logf("INTG-011: daily_build_1 claim failed quest_cfg_id=%d code=%d msg=%s", smokeDailyBuildQuestCfgID, claimResp.Code, claimResp.Msg)
		return false
	}
	t.Logf("INTG-011: daily_build_1 claimed quest_cfg_id=%d", smokeDailyBuildQuestCfgID)
	return true
}

func smokeINTG011GatewayStartUpgrade(t *testing.T, c *websocket.Conn, sid string, cityID int64, slot string, buildingCfgID int32) bool {
	t.Helper()
	upResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartBuildingUpgrade, TraceId: "i11-bup-"+slot, SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&domesticv1.StartBuildingUpgradeRequest{
			CityId: cityID, SlotKey: slot, BuildingCfgId: buildingCfgID,
		}),
	})
	if upResp.Code != 0 {
		t.Logf("INTG-011: start upgrade slot=%s building_cfg_id=%d code=%d msg=%s", slot, buildingCfgID, upResp.Code, upResp.Msg)
		return false
	}
	return true
}

func smokeINTG011FinishActiveBuildWithSpeedup(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, playerID int64, sid string, cityID int64, slot string) {
	t.Helper()
	for attempt := 0; attempt < 6; attempt++ {
		_, finishMS := smokeBuildingSlotFinishMS(t, c, sid, cityID, slot)
		if finishMS == 0 {
			return
		}
		smokeINTG011GrantSpeedupItem(t, ctx, apiSrv, playerID, 1)
		useResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteUseConsumable, TraceId: fmt.Sprintf("i11-bsp-%s-%d", slot, attempt), SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&contentv1.UseConsumableRequest{
				ServerId: intg006ServerID, ItemCfgId: smokeItemGrantCfgID, Count: 1,
			}),
		})
		if useResp.Code != 0 {
			intg011Failf(t, "finish build with speedup", "slot=%s code=%d msg=%s", slot, useResp.Code, useResp.Msg)
		}
		_ = smokeGatewayGetCityState(t, c, sid, cityID)
	}
	intg011Failf(t, "finish build with speedup", "slot=%s still upgrading after speedup attempts", slot)
}

func smokeBuildingSlotFinishMS(t *testing.T, c *websocket.Conn, sid string, cityID int64, slot string) (level int32, finishMS int64) {
	t.Helper()
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	for _, b := range st.GetBuildings() {
		if b.GetSlotKey() == slot {
			return b.GetLevel(), b.GetUpgradeFinishAtMs()
		}
	}
	return 0, 0
}

func smokeINTG011GrantSpeedupItem(t *testing.T, ctx context.Context, apiSrv *api.Server, playerID int64, qty int32) {
	t.Helper()
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-011", TicketID: "T-i11-spd"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID,
		content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: smokeItemGrantCfgID, Qty: qty}}}, "intg-011-speedup-grant")
	if err != nil {
		intg011Failf(t, "gm grant speedup item", "item_cfg_id=%d err=%v", smokeItemGrantCfgID, err)
	}
}

// smokeINTG011DailyMarchOptional exercises march_ration + daily_march_1; failures never block the main path.
func smokeINTG011DailyMarchOptional(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-011 optional: daily_march_1 quest_cfg_id=%d item_cfg_id=%d", smokeDailyMarchQuestCfgID, smokeMarchRationItemCfgID))
	_, err := pool.Exec(ctx, `UPDATE player SET level = $3 WHERE server_id = $1 AND player_id = $2`,
		intg006ServerID, playerID, smokeDailyMarchUnlockLvl)
	if err != nil {
		t.Logf("INTG-011 optional march daily skipped: seed level err=%v", err)
		return
	}
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "i11-march-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyMarchQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		t.Logf("INTG-011 optional march daily skipped: quest_cfg_id=%d accept code=%d msg=%s", smokeDailyMarchQuestCfgID, acceptResp.Code, acceptResp.Msg)
		return
	}
	grantAudit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-011", TicketID: "T-i11-ration"}
	_, _, err = apiSrv.Gm().GrantReward(ctx, "", grantAudit, intg006ServerID, playerID,
		content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: smokeMarchRationItemCfgID, Qty: 1}}}, "intg-011-march-ration")
	if err != nil {
		t.Logf("INTG-011 optional march daily skipped: grant item_cfg_id=%d err=%v", smokeMarchRationItemCfgID, err)
		return
	}
	useResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteUseConsumable, TraceId: "i11-march-use", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.UseConsumableRequest{
			ServerId: intg006ServerID, ItemCfgId: smokeMarchRationItemCfgID, Count: 1,
		}),
	})
	if useResp.Code != 0 {
		t.Logf("INTG-011 optional march daily skipped: quest_cfg_id=%d use item_cfg_id=%d code=%d msg=%s",
			smokeDailyMarchQuestCfgID, smokeMarchRationItemCfgID, useResp.Code, useResp.Msg)
		return
	}
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "i11-march-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyMarchQuestCfgID}),
	})
	if claimResp.Code != 0 {
		t.Logf("INTG-011 optional march daily skipped: quest_cfg_id=%d claim code=%d msg=%s", smokeDailyMarchQuestCfgID, claimResp.Code, claimResp.Msg)
		return
	}
	t.Logf("INTG-011 optional: daily_march_1 claimed quest_cfg_id=%d", smokeDailyMarchQuestCfgID)
}

func intg011Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG011CfgHint, step, fmt.Sprintf(format, args...))
}
