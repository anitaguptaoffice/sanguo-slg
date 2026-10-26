package api

import (
	"context"
	"testing"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

// Synthetic engineering coverage of actual Hub settlement and gateway history.
// PostgreSQL supplies ownership only; armies remain process-local, not durable.
func TestReturnedMarchHistoryPaginationAndAuthorization(t *testing.T) {
	for _, postgres := range []bool{false, true} {
		name := "memory"
		if postgres {
			name = "postgres-ownership"
		}
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			s := garrisonServer(t)
			cities := []world.City{
				{ServerID: 1, CityID: 7, PlayerID: 55, Name: "home", X: 1, Y: 1},
				{ServerID: 1, CityID: 8, PlayerID: 55, Name: "second", X: 2, Y: 2},
				{ServerID: 1, CityID: 9, PlayerID: 56, Name: "foreign", X: 3, Y: 3},
				{ServerID: 2, CityID: 7, PlayerID: 55, Name: "other-shard", X: 1, Y: 1},
			}
			s.world = ownershipWorld(cities[:3]...)
			if postgres {
				pool := walletBoundaryPool(t, true)
				store := world.NewPGStore(pool)
				s.players.Pool = pool
				s.domestic.UseStore(domestic.NewPGStore(pool), 1, 0)
				for _, city := range cities {
					if err := store.CreateCity(ctx, city); err != nil {
						t.Fatal(err)
					}
				}
				s.world = world.NewService(store)
			}
			s.sessions.Bind("foreign", PlayerContext{ServerID: 1, PlayerID: 56})
			s.sessions.Bind("other-shard", PlayerContext{ServerID: 2, PlayerID: 55})
			now := time.Unix(1700000000, 0)
			hub := march.NewHub(func() time.Time { return now })
			s.military = hub
			for _, city := range cities[:3] {
				hub.EnsureCity(&march.CityState{ID: city.CityID, PlayerID: city.PlayerID, Troops: map[int32]int32{1: 1000}})
			}
			hub.SetMarchArrivalHandler(func(context.Context, march.MarchArrivalEvent) (march.MarchArrivalOutcome, error) {
				return march.MarchArrivalOutcome{BattleRan: true, ReportID: 17, RemainingTroops: []march.TroopStack{{UnitCfgID: 1, Count: 1}}}, nil
			})
			var nextArmy int64
			create := func(city, player int64) *march.MarchOrder {
				t.Helper()
				troops := []march.TroopStack{{UnitCfgID: 1, Count: 1}}
				nextArmy++
				o, err := hub.CreateMarch(march.StartMarchRequest{OriginCityID: city, PlayerID: player, ArmyID: nextArmy, ToX: 10, Purpose: 1, Troops: troops})
				if err != nil {
					t.Fatal(err)
				}
				s.recordPlayerMarch(player, city, o.ID, 0, troops)
				return o
			}
			var cityIDs []int64
			for i := 0; i < 103; i++ {
				cityIDs = append(cityIDs, create(7, 55).ID)
			}
			second := create(8, 55)
			foreign := create(9, 56)
			now = second.ArriveAt
			if hub.Tick() != 105 {
				t.Fatal("arrival batch incomplete")
			}
			now = hub.March(second.ID).ReturnFinishAt
			if hub.Tick() != 105 {
				t.Fatal("return batch incomplete")
			}
			active := create(7, 55)
			allIDs := append(append([]int64(nil), cityIDs...), second.ID, active.ID)
			cityIDs = append(cityIDs, active.ID)
			router := s.GatewayRouter()
			call := func(session string, shard int32, city int64, limit, offset int32) *commonv1.ServerPacket {
				return router.Dispatch(ctx, &commonv1.ClientPacket{Route: RouteListMarches, SessionId: session, ServerId: shard,
					Payload: mustProto(&militaryv1.ListMarchesRequest{CityId: city, Limit: limit, Offset: offset})})
			}
			for _, tc := range []struct {
				name          string
				city          int64
				limit, offset int32
				total         int32
				ids           []int64
			}{
				{"default", 7, 0, 0, 104, cityIDs[:20]},
				{"negative", 7, -1, -3, 104, cityIDs[:20]},
				{"cap", 7, 101, 0, 104, cityIDs[:100]},
				{"tail", 7, 100, 100, 104, cityIDs[100:]},
				{"end", 7, 1, 104, 104, nil},
				{"beyond", 7, 1, 1000, 104, nil},
				{"other-city", 8, 20, 0, 1, []int64{second.ID}},
				{"all-cities", 0, 100, 100, 105, allIDs[100:]},
			} {
				t.Run(tc.name, func(t *testing.T) {
					resp := call("owner", 1, tc.city, tc.limit, tc.offset)
					var out militaryv1.ListMarchesResponse
					if resp.Code != 0 || unmarshal(resp.Data, &out) != nil || out.Total != tc.total || len(out.Marches) != len(tc.ids) {
						t.Fatalf("history pagination: packet=%v out=%v", resp, &out)
					}
					for i, row := range out.Marches {
						phase := militaryv1.MarchPhase_MARCH_PHASE_RETURNED
						if row.MarchId == active.ID {
							phase = militaryv1.MarchPhase_MARCH_PHASE_MARCHING
						}
						if row.MarchId != tc.ids[i] || row.Phase != phase || row.ReturnFinishAtMs != 0 || len(row.Troops) != 1 || row.Troops[0].Count != 1 {
							t.Fatalf("history order/phase/survivors: %v", row)
						}
					}
				})
			}
			for _, tc := range []struct {
				session string
				shard   int32
				city    int64
				code    commonv1.ErrorCode
			}{
				{"missing", 1, 0, commonv1.ErrorCode_COMMON_UNAUTHORIZED},
				{"foreign", 1, 7, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND},
				{"other-shard", 2, 7, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND},
				{"other-shard", 2, 0, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND},
				{"owner", 2, 7, commonv1.ErrorCode_COMMON_INVALID_PACKET},
				{"owner", 1, 999, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND},
			} {
				// Unfiltered cross-shard rejection belongs to production pool-bound wiring.
				if !postgres && tc.session == "other-shard" && tc.city == 0 {
					continue
				}
				if out := call(tc.session, tc.shard, tc.city, 20, 0); out.Code != int32(tc.code) || len(out.Data) != 0 {
					t.Fatalf("authorization %+v: %v", tc, out)
				}
			}
			var own militaryv1.ListMarchesResponse
			resp := call("foreign", 1, 0, 20, 0)
			if resp.Code != 0 || unmarshal(resp.Data, &own) != nil || own.Total != 1 || len(own.Marches) != 1 || own.Marches[0].MarchId != foreign.ID {
				t.Fatalf("player history isolation: %v", &own)
			}
			for i := 0; i < 3; i++ {
				if hub.Tick() != 0 || call("owner", 1, 7, 20, 0).Code != 0 || hub.SnapshotCity(7).Troops[1] != 999 {
					t.Fatal("history read/tick recredited returned armies")
				}
			}
		})
	}
}
