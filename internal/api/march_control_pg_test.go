package api

import (
	"testing"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestPGMarchRecallAndSpeedupGateway(t *testing.T) {
	f := newPreparedMarchPG(t, nil)
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	svc := content.NewService(cat)
	f.s.contentSvc = svc
	f.s.contentCatalog = &contentCatalogBinding{service: svc, catalog: cat}
	returnPGExec(t, f.ctx, f.observer, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,1,2100,1)`)

	start, err := f.request(f.ctx, "owner", 10, 5)
	if err != nil || start.GetCode() != 0 {
		t.Fatalf("start march: %+v %v", start, err)
	}
	var started militaryv1.StartMarchResponse
	returnPGOK(t, unmarshal(start.GetData(), &started))
	marchID := started.GetMarch().GetMarchId()
	if marchID == 0 {
		t.Fatal("start march returned no id")
	}

	speedup := f.s.GatewayRouter().Dispatch(f.ctx, &commonv1.ClientPacket{
		Route: RouteSpeedupMarch, SessionId: "owner", ServerId: 1, TraceId: "speedup",
		Payload: mustProto(&militaryv1.SpeedupMarchRequest{MarchId: marchID, ItemCfgId: 2100}),
	})
	if speedup.GetCode() != 0 {
		t.Fatalf("speedup failed: %+v", speedup)
	}
	var sped militaryv1.SpeedupMarchResponse
	returnPGOK(t, unmarshal(speedup.GetData(), &sped))
	if sped.GetReducedSec() <= 0 || sped.GetMarch().GetArriveAtMs() >= started.GetMarch().GetArriveAtMs() {
		t.Fatalf("speedup response: %+v", &sped)
	}

	empty := f.s.GatewayRouter().Dispatch(f.ctx, &commonv1.ClientPacket{
		Route: RouteSpeedupMarch, SessionId: "owner", ServerId: 1, TraceId: "speedup-empty",
		Payload: mustProto(&militaryv1.SpeedupMarchRequest{MarchId: marchID, ItemCfgId: 2100}),
	})
	if empty.GetCode() != int32(commonv1.ErrorCode_MILITARY_INVALID_MARCH) {
		t.Fatalf("empty stock code %d", empty.GetCode())
	}

	recall := f.s.GatewayRouter().Dispatch(f.ctx, &commonv1.ClientPacket{
		Route: RouteRecallMarch, SessionId: "owner", ServerId: 1, TraceId: "recall",
		Payload: mustProto(&militaryv1.RecallMarchRequest{MarchId: marchID}),
	})
	if recall.GetCode() != 0 {
		t.Fatalf("recall failed: %+v", recall)
	}
	var recalled militaryv1.RecallMarchResponse
	returnPGOK(t, unmarshal(recall.GetData(), &recalled))
	if recalled.GetMarch().GetPhase() != 4 || recalled.GetMarch().GetReturnFinishAtMs() == 0 {
		t.Fatalf("recall response: %+v", recalled.GetMarch())
	}
	if order, _ := f.s.military.SnapshotMarch(marchID); order == nil || order.Phase != march.PhaseReturning {
		t.Fatalf("hub not returning: %+v", order)
	}

	f.s.BindSession("foreign", 1, 99, 1)
	foreign := f.s.GatewayRouter().Dispatch(f.ctx, &commonv1.ClientPacket{
		Route: RouteRecallMarch, SessionId: "foreign", ServerId: 1, TraceId: "foreign",
		Payload: mustProto(&militaryv1.RecallMarchRequest{MarchId: marchID}),
	})
	if foreign.GetCode() != int32(commonv1.ErrorCode_MILITARY_INVALID_MARCH) {
		t.Fatalf("foreign recall code %d", foreign.GetCode())
	}
}
