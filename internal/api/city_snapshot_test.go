package api

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

func TestGetCityStateConcurrentDomesticTick(t *testing.T) {
	now := time.Unix(1700000000, 0)
	h := domestic.NewHub(func() time.Time { return now })
	c := &domestic.CityState{ID: 77, PlayerID: 5151, LastSettleAt: now.Add(-time.Hour),
		Wallet:    domestic.Resources{Food: 1000},
		Buildings: map[string]*domestic.BuildingInstance{"farm": {CfgID: 2, Level: 1}}}
	if err := h.RegisterCity(c); err != nil {
		t.Fatal(err)
	}
	s := NewServer(nil, nil, nil, h, nil)
	s.cacheCity(77, c)
	s.world = ownershipWorld(world.City{ServerID: 1, CityID: 77, PlayerID: 5151})
	s.sessions.Bind("snapshot-test", PlayerContext{ServerID: 1, PlayerID: 5151})
	payload, err := marshal(&domesticv1.GetCityStateRequest{CityId: 77})
	if err != nil {
		t.Fatal(err)
	}
	pkt := &commonv1.ClientPacket{SessionId: "snapshot-test", Payload: payload}
	var wg sync.WaitGroup
	errs := make(chan error, 1)
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < 300; i++ {
			h.Tick()
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 300; i++ {
			resp, err := s.handleGetCityState(context.Background(), pkt)
			if err != nil || resp.Code != 0 {
				errs <- fmt.Errorf("get city: %v %v", resp, err)
				return
			}
		}
	}()
	wg.Wait()
	select {
	case err := <-errs:
		t.Fatal(err)
	default:
	}
	snapshot := s.citySnapshot(77)
	snapshot.Buildings["farm"].Level = 99
	if s.citySnapshot(77).Buildings["farm"].Level != 1 {
		t.Fatal("snapshot aliases Hub state")
	}
}
