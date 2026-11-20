package api

import (
	"context"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

func TestPGOwnedFieldsGateway(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	svc := world.NewService(world.NewPGStore(pool))
	wild, err := world.LoadWildConfig("../../spec/data/generated/world_wild.json")
	if err != nil {
		t.Fatal(err)
	}
	svc.Wild = wild
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id, login_name, password_hash) OVERRIDING SYSTEM VALUE VALUES (1, 'of', 'x');
		INSERT INTO player(server_id, player_id, account_id, display_name) VALUES (1, 7, 1, '领主');
		INSERT INTO player_city(server_id, city_id, player_id, name, x, y) VALUES (1, 100, 7, '主城', 60, 60);
		INSERT INTO player_city(server_id, city_id, player_id, name, x, y) VALUES (1, 200, 8, '敌城', 61, 61);
		INSERT INTO map_cell(server_id, x, y, terrain, level, max_level, province_id, owner_city_id)
			VALUES (1, 30, 40, 3, 3, 10, 1, 100)`); err != nil {
		t.Fatal(err)
	}
	srv := NewServer(nil, pool, svc, nil, nil)
	srv.BindSession("sess", 1, 7, 1)

	list := func(cityID int64) *commonv1.ServerPacket {
		t.Helper()
		return srv.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{
			Route: RouteListOwnedFields, SessionId: "sess", ServerId: 1, TraceId: "list",
			Payload: mustProto(&worldv1.ListOwnedFieldsRequest{CityId: cityID}),
		})
	}
	reply := list(100)
	if reply.GetCode() != 0 {
		t.Fatalf("list: %+v", reply)
	}
	var fields worldv1.ListOwnedFieldsResponse
	if err := unmarshal(reply.GetData(), &fields); err != nil {
		t.Fatal(err)
	}
	if len(fields.GetFields()) != 1 {
		t.Fatalf("fields: %+v", fields.GetFields())
	}
	field := fields.GetFields()[0]
	if field.GetX() != 30 || field.GetName() != "森林 Lv3" || field.GetBonusPercent() != 10 {
		t.Fatalf("field: %+v", field)
	}
	if foreign := list(200); foreign.GetCode() != int32(commonv1.ErrorCode_WORLD_CITY_NOT_FOUND) {
		t.Fatalf("foreign city code %d", foreign.GetCode())
	}

	abandon := srv.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{
		Route: RouteAbandonField, SessionId: "sess", ServerId: 1, TraceId: "abandon",
		Payload: mustProto(&worldv1.AbandonFieldRequest{CityId: 100, X: 30, Y: 40}),
	})
	if abandon.GetCode() != 0 {
		t.Fatalf("abandon: %+v", abandon)
	}
	var result worldv1.AbandonFieldResponse
	if err := unmarshal(abandon.GetData(), &result); err != nil || !result.GetAbandoned() {
		t.Fatalf("abandon result: %+v %v", &result, err)
	}
	if again := list(100); again.GetCode() != 0 {
		t.Fatalf("list after abandon: %+v", again)
	} else {
		var empty worldv1.ListOwnedFieldsResponse
		if err := unmarshal(again.GetData(), &empty); err != nil || len(empty.GetFields()) != 0 {
			t.Fatalf("fields after abandon: %+v %v", empty.GetFields(), err)
		}
	}
}
