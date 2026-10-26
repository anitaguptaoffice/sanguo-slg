package api

import (
	"bytes"
	"context"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

func garrisonServer(t *testing.T) *Server {
	t.Helper()
	now := time.Unix(1700000000, 0)
	hub := domestic.NewHub(func() time.Time { return now })
	if err := hub.RegisterCity(&domestic.CityState{ID: 7, PlayerID: 55, LastSettleAt: now, Buildings: map[string]*domestic.BuildingInstance{}}); err != nil {
		t.Fatal(err)
	}
	s := NewServer(nil, nil, ownershipWorld(world.City{ServerID: 1, CityID: 7, PlayerID: 55}), hub, march.NewHub(func() time.Time { return now }))
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 55})
	return s
}

func garrisonCall(s *Server) (*commonv1.ServerPacket, error) {
	return s.handleGetCityState(context.Background(), &commonv1.ClientPacket{SessionId: "owner", ServerId: 1, Payload: mustProto(&domesticv1.GetCityStateRequest{CityId: 7})})
}

func TestCityGarrisonPresenceAndValidation(t *testing.T) {
	for _, tc := range []struct {
		name                 string
		city                 *march.CityState
		unavailable, invalid bool
		want                 []*domesticv1.ReadyTroopCount
	}{
		{name: "unavailable", unavailable: true},
		{name: "unregistered"},
		{name: "empty", city: &march.CityState{ID: 7, PlayerID: 55}},
		{name: "zero", city: &march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{1: 0}}},
		{name: "ready-only-sorted", city: &march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{3: 2, 1: 1, 2: 0}, RecruitJobs: []*march.RecruitJob{{UnitCfgID: 2, Count: 99, Status: march.QueueActive}}}, want: []*domesticv1.ReadyTroopCount{{UnitCfgId: 1, Count: 1}, {UnitCfgId: 3, Count: 2}}},
		{name: "wrong-owner", city: &march.CityState{ID: 7, PlayerID: 56}, invalid: true},
		{name: "negative-count", city: &march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{1: -1}}, invalid: true},
		{name: "unknown-unit", city: &march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{999: 1}}, invalid: true},
		{name: "invalid-zero-row", city: &march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{0: 0}}, invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := garrisonServer(t)
			if tc.unavailable {
				s.military = nil
			} else if tc.city != nil {
				s.military.EnsureCity(tc.city)
			}
			before := s.citySnapshot(7)
			out, err := garrisonCall(s)
			if tc.invalid {
				if err == nil || out != nil {
					t.Fatalf("invalid state accepted: %v %v", out, err)
				}
				if !reflect.DeepEqual(before, s.citySnapshot(7)) {
					t.Fatal("invalid snapshot accrued city")
				}
				return
			}
			if err != nil || out.Code != 0 {
				t.Fatalf("read: %v %v", out, err)
			}
			var decoded domesticv1.GetCityStateResponse
			if err = proto.Unmarshal(out.Data, &decoded); err != nil {
				t.Fatal(err)
			}
			if tc.city == nil {
				if decoded.Garrison != nil {
					t.Fatal("unknown became empty")
				}
				if s.military != nil && s.military.SnapshotCity(7) != nil {
					t.Fatal("read initialized military city")
				}
			} else {
				if decoded.Garrison == nil {
					t.Fatal("known snapshot lost binary presence")
				}
				if !proto.Equal(decoded.Garrison, &domesticv1.CityGarrisonSnapshot{Troops: tc.want}) {
					t.Fatalf("ready rows: %v", decoded.Garrison)
				}
				encoded, _ := proto.Marshal(&domesticv1.GetCityStateResponse{Garrison: decoded.Garrison})
				if len(tc.want) == 0 && !bytes.Equal(encoded, []byte{0x22, 0}) {
					t.Fatalf("empty encoding: %x", encoded)
				}
			}
		})
	}
}

func TestCityGarrisonAuthorizationBeforeRead(t *testing.T) {
	s := garrisonServer(t)
	// Poison the military state: denied requests must never reach validation.
	s.military.EnsureCity(&march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{1: -1}})
	s.sessions.Bind("foreign", PlayerContext{ServerID: 1, PlayerID: 56})
	s.sessions.Bind("other-shard", PlayerContext{ServerID: 2, PlayerID: 55})
	before := s.citySnapshot(7)
	for _, tc := range []struct {
		session string
		sid     int32
		city    int64
		code    commonv1.ErrorCode
	}{
		{"foreign", 1, 7, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND},
		{"other-shard", 2, 7, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND},
		{"owner", 2, 7, commonv1.ErrorCode_COMMON_INVALID_PACKET},
		{"owner", 1, 999, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND},
	} {
		out, err := s.handleGetCityState(context.Background(), &commonv1.ClientPacket{SessionId: tc.session, ServerId: tc.sid, Payload: mustProto(&domesticv1.GetCityStateRequest{CityId: tc.city})})
		if err != nil || out.Code != int32(tc.code) || len(out.Data) != 0 {
			t.Fatalf("denial %+v: %v %v", tc, out, err)
		}
	}
	if !reflect.DeepEqual(before, s.citySnapshot(7)) {
		t.Fatal("denial accrued city")
	}
}

func TestCityGarrisonConcurrentCompletionSnapshot(t *testing.T) {
	var clock atomic.Int64
	clock.Store(1700000000)
	h := march.NewHub(func() time.Time { return time.Unix(clock.Load(), 0) })
	h.EnsureCity(&march.CityState{ID: 7, PlayerID: 55})
	s := &Server{military: h}
	job, err := h.RecruitWithWallet(march.RecruitRequest{CityID: 7, UnitCfgID: 1, Count: 1}, func(march.Resources) (march.Resources, error) { return march.Resources{}, nil })
	if err != nil {
		t.Fatal(err)
	}
	clock.Store(job.FinishAt.Unix())
	// Passing a deadline alone must not manufacture completion.
	before, err := s.readyGarrison(7, 55)
	if err != nil || len(before.Troops) != 0 {
		t.Fatalf("deadline inferred: %v %v", before, err)
	}
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			h.Tick()
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			got, e := s.readyGarrison(7, 55)
			if e != nil || got == nil || len(got.Troops) > 1 {
				t.Errorf("torn snapshot %v %v", got, e)
				return
			}
			if len(got.Troops) == 1 {
				if got.Troops[0].Count != 1 {
					t.Error("bad count")
				}
				got.Troops[0].Count = 999
			}
			// Hub snapshot itself is independently owned, not the live map.
			copy := h.SnapshotCity(7)
			copy.Troops[1] = 888
		}
	}()
	wg.Wait()
	after, err := s.readyGarrison(7, 55)
	if err != nil || len(after.Troops) != 1 || after.Troops[0].Count != 1 {
		t.Fatalf("completion: %v %v", after, err)
	}
}

// Exercise the production PostgreSQL ownership port as well as the handler wire.
// Military state is deliberately in memory: this test makes no durability claim.
func TestCityGarrisonPostgresOwnership(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	store := world.NewPGStore(pool)
	if err := store.CreateCity(ctx, world.City{ServerID: 1, CityID: 7, PlayerID: 55, Name: "garrison-test", X: 1, Y: 1}); err != nil {
		t.Fatal(err)
	}
	s := garrisonServer(t)
	s.world = world.NewService(store)
	s.military.EnsureCity(&march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{1: 1}})
	out, err := garrisonCall(s)
	if err != nil || out.Code != 0 {
		t.Fatalf("owned PG city: %v %v", out, err)
	}
	var decoded domesticv1.GetCityStateResponse
	if err := proto.Unmarshal(out.Data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Garrison == nil || len(decoded.Garrison.Troops) != 1 || decoded.Garrison.Troops[0].Count != 1 {
		t.Fatalf("PG authorized snapshot: %v", &decoded)
	}
	s.sessions.Bind("owner", PlayerContext{ServerID: 2, PlayerID: 55})
	out, err = s.handleGetCityState(ctx, &commonv1.ClientPacket{SessionId: "owner", ServerId: 2, Payload: mustProto(&domesticv1.GetCityStateRequest{CityId: 7})})
	if err != nil || out.Code != int32(commonv1.ErrorCode_WORLD_CITY_NOT_FOUND) || len(out.Data) != 0 {
		t.Fatalf("PG shard denial: %v %v", out, err)
	}
}
