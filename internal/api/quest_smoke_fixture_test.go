package api_test

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

// smokeRejectPublicProgress verifies the actual gateway boundary, including
// replay, against unchanged persisted progress, reward receipts and inventory.
func smokeRejectPublicProgress(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, playerID int64, questID, value int32) {
	t.Helper()
	type snapshot struct {
		quest, items, wallet string
		grants               int64
	}
	read := func() snapshot {
		t.Helper()
		var s snapshot
		err := pool.QueryRow(ctx, `SELECT to_jsonb(q)::text,
			(SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2),
			COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY item_cfg_id) FROM player_item i WHERE server_id=$1 AND player_id=$2),'[]'::jsonb)::text,
			(SELECT to_jsonb(w)::text FROM player_wallet w WHERE server_id=$1 AND player_id=$2)
			FROM player_quest q WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=$3`,
			intg006ServerID, playerID, questID).Scan(&s.quest, &s.grants, &s.items, &s.wallet)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	before := read()
	for replay := 0; replay < 2; replay++ {
		resp := mustSend(t, c, &commonv1.ClientPacket{Route: api.RouteReportQuestProgress, TraceId: "unsafe-progress",
			SessionId: sid, ServerId: intg006ServerID, Payload: mustMarshal(&questv1.ReportQuestProgressRequest{
				ServerId: intg006ServerID, QuestCfgId: questID, Absolute: true, ProgressValue: value, EventType: "build_level",
			})})
		if resp.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || read() != before {
			t.Fatalf("public progress/replay changed state: %+v", resp)
		}
	}
}

// smokeCompleteAcceptedHall uses paid gameplay and a deterministic test clock;
// this is an integration fixture, not natural browser timing evidence. Callers
// retain their normal Claim and all existing reward/stock/restart assertions.
func smokeCompleteAcceptedHall(t *testing.T, ctx context.Context, c *websocket.Conn, srv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeRejectPublicProgress(t, ctx, c, pool, sid, playerID, smokeQuestCfgID, 2)
	// Reserve a different validated tile from the later MarchCamp scenario.
	var tile world.Coord
	for _, cell := range world.GenerateChunk(intg006ServerID, 1, 1) {
		if cell.Buildable() && cell.X >= 50 && cell.Y >= 50 {
			tile = world.Coord{X: cell.X, Y: cell.Y}
			break
		}
	}
	if tile.X == 0 {
		t.Fatal("no valid separate tutorial tile")
	}
	created := mustSend(t, c, &commonv1.ClientPacket{Route: api.RouteCreateCity, TraceId: "tutorial-city",
		SessionId: sid, ServerId: intg006ServerID, Payload: mustMarshal(&worldv1.CreateCityRequest{
			ServerId: intg006ServerID, Name: "TutorialHall", X: int32(tile.X), Y: int32(tile.Y),
		})})
	var city worldv1.CreateCityResponse
	if created.Code != 0 || proto.Unmarshal(created.Data, &city) != nil || city.GetCity().GetCityId() == 0 {
		t.Fatalf("create tutorial city: %+v", created)
	}
	cityID := city.GetCity().GetCityId()
	var beforeFood, afterFood int64
	if err := pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=$1 AND player_id=$2`, intg006ServerID, playerID).Scan(&beforeFood); err != nil {
		t.Fatal(err)
	}
	started := mustSend(t, c, &commonv1.ClientPacket{Route: api.RouteStartBuildingUpgrade, TraceId: "tutorial-upgrade",
		SessionId: sid, ServerId: intg006ServerID, Payload: mustMarshal(&domesticv1.StartBuildingUpgradeRequest{
			CityId: cityID, SlotKey: "hall", BuildingCfgId: 1,
		})})
	var upgrade domesticv1.StartBuildingUpgradeResponse
	if started.Code != 0 || proto.Unmarshal(started.Data, &upgrade) != nil || upgrade.GetFinishAtMs() <= 0 {
		t.Fatalf("paid hall upgrade: %+v", started)
	}
	if err := pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=$1 AND player_id=$2`, intg006ServerID, playerID).Scan(&afterFood); err != nil || afterFood >= beforeFood {
		t.Fatalf("hall upgrade did not debit persisted wallet: %d -> %d: %v", beforeFood, afterFood, err)
	}
	check := func(wantLevel, wantState, wantProof int32) {
		t.Helper()
		var level, state, proof int32
		err := pool.QueryRow(ctx, `SELECT b.level,q.state,COALESCE((q.progress->>'server_verified_version')::int,0)
			FROM city_building b JOIN player_city c USING(server_id,city_id)
			JOIN player_quest q ON q.server_id=c.server_id AND q.player_id=c.player_id
			WHERE c.server_id=$1 AND c.player_id=$2 AND c.city_id=$3 AND b.slot_key='hall' AND q.quest_cfg_id=$4`,
			intg006ServerID, playerID, cityID, smokeQuestCfgID).Scan(&level, &state, &proof)
		if err != nil || level != wantLevel || state != wantState || proof != wantProof {
			t.Fatalf("persisted hall/progress: level=%d state=%d proof=%d: %v", level, state, proof, err)
		}
	}
	check(1, 1, 0) // Queue target is not completed proof.
	srv.AdvanceSmokeTimeTo(time.UnixMilli(upgrade.GetFinishAtMs()).Add(time.Millisecond))
	state := mustSend(t, c, &commonv1.ClientPacket{Route: api.RouteGetCityState, TraceId: "tutorial-finish",
		SessionId: sid, ServerId: intg006ServerID, Payload: mustMarshal(&domesticv1.GetCityStateRequest{CityId: cityID})})
	if state.Code != 0 {
		t.Fatalf("finish hall: %+v", state)
	}
	refresh := mustSend(t, c, &commonv1.ClientPacket{Route: api.RouteListPlayerQuests, TraceId: "tutorial-refresh",
		SessionId: sid, ServerId: intg006ServerID, Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{ChainId: smokeQuestChainID})})
	if refresh.Code != 0 {
		t.Fatalf("refresh tutorial: %+v", refresh)
	}
	check(2, 2, 1)
}
