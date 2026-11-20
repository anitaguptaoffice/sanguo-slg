package api

import (
	"context"
	"testing"
	"time"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

func TestDemolishBuildingGateway(t *testing.T) {
	now := time.Unix(1797000000, 0)
	hub := domestic.NewHub(func() time.Time { return now })
	if err := hub.RegisterCity(&domestic.CityState{ID: 7, PlayerID: 55, LastSettleAt: now,
		Wallet: domestic.Resources{Food: 1000, Wood: 1000, Stone: 1000, Iron: 1000},
		Buildings: map[string]*domestic.BuildingInstance{
			"hall": {CfgID: 1, Level: 3},
			"farm": {CfgID: 2, Level: 2},
		}}); err != nil {
		t.Fatal(err)
	}
	s := NewServer(nil, nil, ownershipWorld(world.City{ServerID: 1, CityID: 7, PlayerID: 55}), hub, march.NewHub(func() time.Time { return now }))
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 55})
	call := func() (*commonv1.ServerPacket, error) {
		return s.handleDemolishBuilding(context.Background(), &commonv1.ClientPacket{
			SessionId: "owner", ServerId: 1,
			Payload: mustProto(&domesticv1.DemolishBuildingRequest{CityId: 7, SlotKey: "farm"}),
		})
	}

	out, err := call()
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("first demolish: %v %v", out, err)
	}
	var res domesticv1.DemolishBuildingResponse
	if err = proto.Unmarshal(out.GetData(), &res); err != nil {
		t.Fatal(err)
	}
	if res.GetRemoved() || res.GetBuilding().GetLevel() != 1 || res.GetRefund().GetFood() != 20 ||
		res.GetWallet().GetFood() != 1020 {
		t.Fatalf("first result: %+v", &res)
	}

	out, err = call()
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("second demolish: %v %v", out, err)
	}
	res.Reset()
	if err = proto.Unmarshal(out.GetData(), &res); err != nil {
		t.Fatal(err)
	}
	if !res.GetRemoved() || res.GetBuilding() != nil {
		t.Fatalf("second result: %+v", &res)
	}
	if city := s.citySnapshot(7); city.Buildings["farm"] != nil {
		t.Fatalf("farm still present: %+v", city.Buildings["farm"])
	}

	out, err = call()
	if err != nil || out.GetCode() != int32(commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING) {
		t.Fatalf("missing slot: %v %v", out, err)
	}
}
