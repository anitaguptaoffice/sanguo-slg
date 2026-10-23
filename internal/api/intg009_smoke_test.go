package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const (
	smokeDailyTrainQuestCfgID = int32(1014)
	smokeDailyBuildQuestCfgID = int32(1032)
	smokeDailyTrainUnlockLvl  = int32(6)
	smokeDailyBuildUnlockLvl  = int32(13)
	smokeMarchTroopUnitCfgID  = int32(1)
)

const smokeINTG009CfgHint = smokeINTG008CfgHint + "; INTG-009: StartMarch+ListMarches; mail inbox; optional daily_train_1 quest_cfg_id=1014 or daily_build_1 quest_cfg_id=1032"

type intg009PersistSnapshot struct {
	intg008PersistSnapshot
	MarchID int64
}

// TestINTG009Wave12SmokePath extends INTG-008 with military march listing and QUEST-003 optional daily train/build.
func TestINTG009Wave12SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-009 wave:12 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG009Wave12Smoke(t)
}

func runINTG009Wave12Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg009Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg009Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg009Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg009_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	marchID, _, _, _, _, _ := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeQuest003TrainOrBuildOptional(t, ctx, c, apiSrv, pool, sid, playerID)

	ts.Close()
	_ = c.Close()

	pool2 := reopenDBPool(t)
	apiSrv2, ts2, wsURL2 := startData002SmokeGateway(t, log, pool2, worldStore)
	defer ts2.Close()

	c2 := dial(t, wsURL2)
	defer func() { _ = c2.Close() }()

	sid2, _ := smokeLoginOnly(t, c2, loginName)
	want := intg009PersistSnapshot{intg008PersistSnapshot: ext, MarchID: marchID}
	assertINTG009Persistence(t, ctx, pool2, apiSrv2, c2, sid2, playerID, want)
	runData002M3Subset(t, ctx, c2, apiSrv2, pool2, sid2, playerID)
}

const smokeWorldMapTiles = 500

func smokeValidWorldTileCoord(v int32) bool {
	return v >= 0 && v < smokeWorldMapTiles
}

// smokeStartMarchListMarchesGateway starts a march and asserts ListMarches contains it with destination coords.
func smokeStartMarchListMarchesGateway(t *testing.T, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) (marchID int64, cityID int64, toX int32, toY int32, departAtMs int64, arriveAtMs int64) {
	t.Helper()
	cityX := int32(12 + (playerID % 20))
	cityY := int32(14 + (playerID % 18))
	smokeStep(t, fmt.Sprintf("MIL: gateway CreateCity x=%d y=%d for march smoke", cityX, cityY))
	createResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteCreateCity, TraceId: "i9-city", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&worldv1.CreateCityRequest{
			ServerId: intg006ServerID, Name: "MarchCamp", X: cityX, Y: cityY,
		}),
	})
	if createResp.Code != 0 {
		intg009Failf(t, "create city for march", "code=%d msg=%s", createResp.Code, createResp.Msg)
	}
	var created worldv1.CreateCityResponse
	if err := proto.Unmarshal(createResp.Data, &created); err != nil {
		intg009Failf(t, "decode create city", "err=%v", err)
	}
	cityID = created.GetCity().GetCityId()
	if cityID == 0 {
		intg009Failf(t, "create city for march", "missing city_id")
	}

	const troopCount = int32(25)
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, troopCount)
	toX, toY = cityX+3, cityY+2
	const marchPurpose = int32(1)
	smokeStep(t, fmt.Sprintf("MIL: gateway StartMarch purpose=%d to=(%d,%d)", marchPurpose, toX, toY))
	marchResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartMarch, TraceId: "i9-march", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.StartMarchRequest{
			CityId: cityID, ToX: toX, ToY: toY, Purpose: marchPurpose,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: smokeMarchTroopUnitCfgID, Count: 10}},
		}),
	})
	if marchResp.Code != 0 {
		intg009Failf(t, "start march", "purpose=%d code=%d msg=%s", marchPurpose, marchResp.Code, marchResp.Msg)
	}
	var marchOut militaryv1.StartMarchResponse
	if err := proto.Unmarshal(marchResp.Data, &marchOut); err != nil {
		intg009Failf(t, "decode start march", "err=%v", err)
	}
	march := marchOut.GetMarch()
	marchID = march.GetMarchId()
	if marchID == 0 {
		phase := march.GetPhase()
		intg009Failf(t, "start march", "missing march_id purpose=%d phase=%v", marchPurpose, phase)
	}
	departAtMs = march.GetDepartAtMs()
	arriveAtMs = march.GetArriveAtMs()

	smokeStep(t, "MIL: gateway ListMarches contains march_id")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i9-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg009Failf(t, "list marches", "march_id=%d code=%d msg=%s", marchID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg009Failf(t, "decode list marches", "err=%v", err)
	}
	if len(listOut.GetMarches()) > 0 {
		first := listOut.GetMarches()[0]
		if !smokeValidWorldTileCoord(first.GetToX()) || !smokeValidWorldTileCoord(first.GetToY()) {
			intg009Failf(t, "list marches first row coords", "march_id=%d to_x=%d to_y=%d", first.GetMarchId(), first.GetToX(), first.GetToY())
		}
	}
	for _, row := range listOut.GetMarches() {
		if row.GetMarchId() == marchID {
			if !smokeValidWorldTileCoord(row.GetToX()) || !smokeValidWorldTileCoord(row.GetToY()) {
				intg009Failf(t, "list marches destination coords", "march_id=%d to_x=%d to_y=%d", marchID, row.GetToX(), row.GetToY())
			}
			if row.GetToX() != toX || row.GetToY() != toY {
				intg009Failf(t, "list marches destination", "march_id=%d want=(%d,%d) got=(%d,%d)", marchID, toX, toY, row.GetToX(), row.GetToY())
			}
			t.Logf("MIL: ListMarches ok march_id=%d to_x=%d to_y=%d", marchID, row.GetToX(), row.GetToY())
			return marchID, cityID, toX, toY, departAtMs, arriveAtMs
		}
	}
	intg009Failf(t, "list marches", "march_id=%d not in list total=%d purpose=%d", marchID, listOut.GetTotal(), marchPurpose)
	return marchID, cityID, toX, toY, departAtMs, arriveAtMs
}

// smokeQuest003TrainOrBuildOptional advances daily_train_1 or daily_build_1 when QUEST-003 hooks are live; never fails the main path.
func smokeQuest003TrainOrBuildOptional(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	if smokeQuest003TryTrainDaily(t, ctx, c, apiSrv, pool, sid, playerID) {
		return
	}
	if smokeQuest003TryBuildDaily(t, ctx, c, pool, sid, playerID) {
		return
	}
	t.Log("QUEST-003 optional: daily_train_1 / daily_build_1 not claimable (non-blocking; see tools/smoke/README.md)")
}

func smokeQuest003TryTrainDaily(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) bool {
	t.Helper()
	smokeStep(t, fmt.Sprintf("QUEST-003 optional: daily_train_1 quest_cfg_id=%d", smokeDailyTrainQuestCfgID))
	_, err := pool.Exec(ctx, `UPDATE player SET level = $3 WHERE server_id = $1 AND player_id = $2`,
		intg006ServerID, playerID, smokeDailyTrainUnlockLvl)
	if err != nil {
		t.Logf("QUEST-003 optional train skipped: seed level err=%v", err)
		return false
	}
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "i9-train-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyTrainQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		t.Logf("QUEST-003 optional train skipped: accept code=%d msg=%s", acceptResp.Code, acceptResp.Msg)
		return false
	}
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		t.Log("QUEST-003 optional train skipped: no city for RecruitTroop")
		return false
	}
	apiSrv.SeedCityTroopsForTest(cityID, smokeMarchTroopUnitCfgID, 0)
	for i := 0; i < 3; i++ {
		recruitResp := mustSend(t, c, &commonv1.ClientPacket{
			Route: api.RouteRecruitTroop, TraceId: fmt.Sprintf("i9-train-r%d", i), SessionId: sid, ServerId: intg006ServerID,
			Payload: mustMarshal(&militaryv1.RecruitTroopRequest{
				CityId: cityID, UnitCfgId: smokeMarchTroopUnitCfgID, Count: 20,
			}),
		})
		if recruitResp.Code != 0 {
			t.Logf("QUEST-003 optional train skipped: recruit code=%d msg=%s", recruitResp.Code, recruitResp.Msg)
			return false
		}
	}
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "i9-train-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyTrainQuestCfgID}),
	})
	if claimResp.Code != 0 {
		t.Logf("QUEST-003 optional train skipped: claim code=%d msg=%s", claimResp.Code, claimResp.Msg)
		return false
	}
	t.Log("QUEST-003 optional: daily_train_1 claimed")
	return true
}

func smokeQuest003TryBuildDaily(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, playerID int64) bool {
	t.Helper()
	smokeStep(t, fmt.Sprintf("QUEST-003 optional: daily_build_1 quest_cfg_id=%d", smokeDailyBuildQuestCfgID))
	_, err := pool.Exec(ctx, `UPDATE player SET level = $3 WHERE server_id = $1 AND player_id = $2`,
		intg006ServerID, playerID, smokeDailyBuildUnlockLvl)
	if err != nil {
		t.Logf("QUEST-003 optional build skipped: seed level err=%v", err)
		return false
	}
	acceptResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteAcceptQuest, TraceId: "i9-build-a", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.AcceptQuestRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyBuildQuestCfgID}),
	})
	if acceptResp.Code != 0 {
		t.Logf("QUEST-003 optional build skipped: accept code=%d msg=%s", acceptResp.Code, acceptResp.Msg)
		return false
	}
	claimResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteClaimQuestReward, TraceId: "i9-build-c", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{ServerId: intg006ServerID, QuestCfgId: smokeDailyBuildQuestCfgID}),
	})
	if claimResp.Code != 0 {
		t.Logf("QUEST-003 optional build skipped: claim code=%d msg=%s (needs build_level hook)", claimResp.Code, claimResp.Msg)
		return false
	}
	t.Log("QUEST-003 optional: daily_build_1 claimed")
	return true
}

func smokeFirstPlayerCityID(t *testing.T, c *websocket.Conn, sid string) int64 {
	t.Helper()
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerCities, TraceId: "i9-cities", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&worldv1.ListPlayerCitiesRequest{}),
	})
	if listResp.Code != 0 {
		return 0
	}
	var listOut worldv1.ListPlayerCitiesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		return 0
	}
	if len(listOut.GetCities()) == 0 {
		return 0
	}
	return listOut.GetCities()[0].GetCityId()
}

func assertINTG009Persistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, apiSrv *api.Server, c *websocket.Conn, sid string, playerID int64, want intg009PersistSnapshot) {
	t.Helper()
	assertINTG008Persistence(t, ctx, pool, apiSrv, c, sid, playerID, want.intg008PersistSnapshot)
	_ = want.MarchID // march orders are in-memory; not expected after process restart
}

func intg009Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG009CfgHint, step, fmt.Sprintf(format, args...))
}
