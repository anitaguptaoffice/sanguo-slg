package api

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

// Embedding the unused interface makes accidental extra store operations fail.
type cityOwnershipStore struct {
	world.Store
	cities []world.City
	err    error
}

func (s *cityOwnershipStore) PlayerCities(_ context.Context, sid int32, pid int64) ([]world.City, error) {
	if s.err != nil {
		return nil, s.err
	}
	var out []world.City
	for _, c := range s.cities {
		if c.ServerID == sid && c.PlayerID == pid {
			out = append(out, c)
		}
	}
	return out, nil
}
func ownershipWorld(cities ...world.City) *world.Service {
	return world.NewService(&cityOwnershipStore{cities: cities})
}

func TestDomesticCityOwnership(t *testing.T) {
	for _, upgrade := range []bool{false, true} {
		name := "read"
		if upgrade {
			name = "upgrade"
		}
		t.Run(name, func(t *testing.T) {
			now := time.Unix(1700000000, 0)
			hub := domestic.NewHub(func() time.Time { return now })
			store := &cityOwnershipStore{cities: []world.City{{ServerID: 1, CityID: 7, PlayerID: 55}, {ServerID: 1, CityID: 8, PlayerID: 56}, {ServerID: 2, CityID: 9, PlayerID: 55}}}
			s := NewServer(nil, nil, world.NewService(store), hub, nil)
			s.now = func() time.Time { return now }
			qs := quest.NewMemStore()
			s.questSvc = quest.NewService(qs, quest.NewMemCatalog([]quest.QuestCfg{{QuestCfgID: 1012, QuestType: quest.QuestTypeDaily, ChainID: quest.DailyChainID, Repeatable: true, UnlockLevel: 1, Objectives: []quest.Objective{{Type: "collect_resource", Resource: "food", Count: 100}}}}), nil, nil)
			s.questSvc.SetClock(s.now)
			for _, c := range store.cities {
				if err := hub.RegisterCity(&domestic.CityState{ID: c.CityID, PlayerID: c.PlayerID, LastSettleAt: now, Wallet: domestic.Resources{Food: 50000, Wood: 50000, Iron: 50000, Stone: 50000}, Buildings: map[string]*domestic.BuildingInstance{"hall": {CfgID: 1, Level: 3}, "farm": {CfgID: 2, Level: 1}}}); err != nil {
					t.Fatal(err)
				}
				if _, _, err := s.questSvc.AcceptQuest(context.Background(), quest.Actor{ServerID: c.ServerID, PlayerID: c.PlayerID}, 1012); err != nil {
					t.Fatal(err)
				}
			}
			now = now.Add(time.Hour)
			s.sessions.Bind("a", PlayerContext{ServerID: 1, PlayerID: 55})
			s.sessions.Bind("b", PlayerContext{ServerID: 1, PlayerID: 56})
			s.sessions.Bind("a-shard2", PlayerContext{ServerID: 2, PlayerID: 55})
			call := func(session string, sid int32, city int64) *commonv1.ServerPacket {
				pkt := &commonv1.ClientPacket{SessionId: session, ServerId: sid, TraceId: "ownership"}
				var out *commonv1.ServerPacket
				var err error
				if upgrade {
					pkt.Payload = mustProto(&domesticv1.StartBuildingUpgradeRequest{CityId: city, SlotKey: "farm", BuildingCfgId: 2})
					out, err = s.handleStartBuildingUpgrade(context.Background(), pkt)
				} else {
					pkt.Payload = mustProto(&domesticv1.GetCityStateRequest{CityId: city})
					out, err = s.handleGetCityState(context.Background(), pkt)
				}
				if err != nil || out == nil {
					t.Fatalf("handler err=%v packet=%v", err, out)
				}
				return out
			}
			before := map[int64]*domestic.CityState{}
			for _, c := range store.cities {
				before[c.CityID] = s.citySnapshot(c.CityID)
			}
			for _, tc := range []struct {
				session string
				sid     int32
				city    int64
			}{{"a", 1, 8}, {"b", 1, 7}, {"a", 1, 9}, {"a-shard2", 2, 7}, {"a", 1, 999}, {"a", 1, 0}, {"a", 1, -1}, {"a", 2, 7}} {
				out := call(tc.session, tc.sid, tc.city)
				expected := commonv1.ErrorCode_WORLD_CITY_NOT_FOUND
				if tc.session == "a" && tc.sid == 2 {
					expected = commonv1.ErrorCode_COMMON_INVALID_PACKET
				}
				if out.Code != int32(expected) || len(out.Data) != 0 {
					t.Fatalf("denial for %+v: %v", tc, out)
				}
			}
			for _, c := range store.cities {
				if !reflect.DeepEqual(before[c.CityID], s.citySnapshot(c.CityID)) {
					t.Fatalf("denial mutated city %d", c.CityID)
				}
				row, _, err := qs.GetPlayerQuest(context.Background(), c.ServerID, c.PlayerID, 1012)
				if err != nil || row.Progress.Count != 0 {
					t.Fatalf("denial changed quest: %+v err=%v", row, err)
				}
			}
			// Unavailable ownership data must fail closed, even when the cache matches.
			store.err = errors.New("unavailable")
			if out := call("a", 1, 7); out.Code != int32(commonv1.ErrorCode_WORLD_CITY_NOT_FOUND) {
				t.Fatalf("store failure: %v", out)
			}
			store.err = nil
			saved := s.world
			s.world = nil
			if out := call("a", 1, 7); out.Code != int32(commonv1.ErrorCode_WORLD_CITY_NOT_FOUND) {
				t.Fatalf("nil world: %v", out)
			}
			s.world = &world.Service{}
			if out := call("a", 1, 7); out.Code != int32(commonv1.ErrorCode_WORLD_CITY_NOT_FOUND) {
				t.Fatalf("nil store: %v", out)
			}
			s.world = saved
			// A world row alone cannot authorize a stale or unloaded domestic cache.
			store.cities = append(store.cities, world.City{ServerID: 1, CityID: 777, PlayerID: 55})
			if out := call("a", 1, 777); out.Code != int32(commonv1.ErrorCode_WORLD_CITY_NOT_FOUND) {
				t.Fatalf("unloaded city: %v", out)
			}
			if err := hub.RegisterCity(&domestic.CityState{ID: 777, PlayerID: 56}); err != nil {
				t.Fatal(err)
			}
			if out := call("a", 1, 777); out.Code != int32(commonv1.ErrorCode_WORLD_CITY_NOT_FOUND) {
				t.Fatalf("stale owner: %v", out)
			}
			for _, tc := range []struct {
				session string
				sid     int32
				city    int64
			}{{"a", 1, 7}, {"b", 1, 8}, {"a-shard2", 2, 9}} {
				if out := call(tc.session, tc.sid, tc.city); out.Code != 0 || len(out.Data) == 0 {
					t.Fatalf("owner %+v: %v", tc, out)
				}
				after := s.citySnapshot(tc.city)
				if upgrade && len(after.BuildJobs) != 1 {
					t.Fatalf("owner queue missing: %+v", after)
				}
				if !upgrade && after.Wallet.Food <= before[tc.city].Wallet.Food {
					t.Fatalf("owner production not accrued city=%d before=%+v after=%+v", tc.city, before[tc.city].Wallet, after.Wallet)
				}
			}
		})
	}
}
