package api

import (
	"context"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

func TestPGWorldViewportGateway(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	store := world.NewPGStore(pool)
	svc := world.NewService(store)
	wild, err := world.LoadWildConfig("../../spec/data/generated/world_wild.json")
	if err != nil {
		t.Fatal(err)
	}
	svc.Wild = wild
	if err := store.SaveChunk(ctx, 1, []world.Cell{
		{X: 20, Y: 20, Terrain: world.TerrainForest, Level: 5, MaxLevel: 10, ProvinceID: 2, NpcKind: 1},
		{X: 21, Y: 20, Terrain: world.TerrainPlain, Level: 3, MaxLevel: 10, ProvinceID: 2, OwnerCityID: 4},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id, login_name, password_hash) OVERRIDING SYSTEM VALUE VALUES (1, 'vp', 'x');
		INSERT INTO player(server_id, player_id, account_id, display_name) VALUES (1, 7, 1, '领主');
		INSERT INTO player_city(server_id, city_id, player_id, name, x, y, is_capital) VALUES (1, 4, 7, '主城', 21, 20, true)`); err != nil {
		t.Fatal(err)
	}

	srv := NewServer(nil, pool, svc, nil, nil)
	srv.BindSession("sess", 1, 7, 1)

	reply := srv.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{
		Route: RouteGetWorldViewport, SessionId: "sess", ServerId: 1, TraceId: "vp",
		Payload: mustProto(&worldv1.GetWorldViewportRequest{CenterX: 20, CenterY: 20, RadiusX: 1, RadiusY: 0}),
	})
	if reply.GetCode() != 0 {
		t.Fatalf("viewport failed: %+v", reply)
	}
	var view worldv1.GetWorldViewportResponse
	if err := unmarshal(reply.GetData(), &view); err != nil {
		t.Fatal(err)
	}
	if len(view.GetTiles()) != 2 {
		t.Fatalf("viewport tiles %d, want 2", len(view.GetTiles()))
	}
	if view.GetTiles()[0].GetProvinceName() == "" || view.GetTiles()[0].GetNpcKind() != 1 {
		t.Fatalf("tile summary: %+v", view.GetTiles()[0])
	}

	detail := srv.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{
		Route: RouteGetWorldTileDetail, SessionId: "sess", ServerId: 1, TraceId: "detail",
		Payload: mustProto(&worldv1.GetWorldTileDetailRequest{X: 21, Y: 20}),
	})
	if detail.GetCode() != 0 {
		t.Fatalf("detail failed: %+v", detail)
	}
	var tile worldv1.GetWorldTileDetailResponse
	if err := unmarshal(detail.GetData(), &tile); err != nil {
		t.Fatal(err)
	}
	if tile.GetTile().GetOwnerPlayerId() != 7 || tile.GetDistanceFromCapital() != 0 {
		t.Fatalf("detail ownership/distance: %+v", &tile)
	}
	if len(tile.GetActions()) == 0 {
		t.Fatal("detail actions empty")
	}

	out := srv.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{
		Route: RouteGetWorldTileDetail, SessionId: "sess", ServerId: 1, TraceId: "oob",
		Payload: mustProto(&worldv1.GetWorldTileDetailRequest{X: -1, Y: 0}),
	})
	if out.GetCode() != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
		t.Fatalf("out of bounds code %d", out.GetCode())
	}
}
