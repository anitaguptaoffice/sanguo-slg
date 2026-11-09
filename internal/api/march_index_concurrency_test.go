package api

import (
	"context"
	"sync"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func waitMarchIndexWorkers(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("march bookkeeping workers did not finish; possible lock inversion")
	}
}

func TestMarchIndexConcurrentMemoryAccess(t *testing.T) {
	var s Server // Concurrent first use must not lose either lazily created map.
	const workers, perWorker = 16, 32
	ids := make(chan int64, workers*perWorker)
	start, done := make(chan struct{}), make(chan struct{})
	var wg sync.WaitGroup
	for worker := 0; worker < workers; worker++ {
		wg.Add(1)
		go func(player int64) {
			defer wg.Done()
			<-start
			for n := 0; n < perWorker; n++ {
				id := s.allocateMarchArmyID()
				ids <- id
				s.recordPlayerMarch(player, 7, id, id, []march.TroopStack{{UnitCfgID: 1, Count: 3}})
				s.bindMarchHeroServer(id, int32(player))
				if b, ok := s.lookupMarchHero(id); !ok || b.playerID != player || b.heroID != id || b.serverID != int32(player) {
					t.Errorf("binding lost: id=%d binding=%+v found=%v", id, b, ok)
				}
				rows, _ := s.listPlayerMarches(player, 7, 100, 0)
				for _, row := range rows {
					if len(row.troops) != 1 || row.troops[0].Count != 3 {
						t.Error("concurrent list observed a partial or aliased row")
					} else {
						row.troops[0].Count = -1
					}
				}
				if id%2 == 0 {
					s.clearMarchHero(id)
					s.bindMarchHeroServer(id, 99) // A late bind must not recreate a removed entry.
				}
			}
		}(int64(worker%4 + 1))
	}
	go func() { wg.Wait(); close(done) }()
	close(start)
	waitMarchIndexWorkers(t, done)
	close(ids)
	seen := make(map[int64]bool)
	for id := range ids {
		if id <= 0 || seen[id] {
			t.Fatalf("nonpositive or duplicated allocation: %d", id)
		}
		seen[id] = true
		_, ok := s.lookupMarchHero(id)
		if ok != (id%2 != 0) {
			t.Fatalf("binding retention differs for %d", id)
		}
	}
	if len(seen) != workers*perWorker || s.nextArmyID != workers*perWorker {
		t.Fatal("allocator lost increments")
	}
	for player := int64(1); player <= 4; player++ {
		rows, total := s.listPlayerMarches(player, 0, 100, 100)
		if total != 128 || len(rows) != 28 {
			t.Fatalf("player %d lost rows: total=%d tail=%d", player, total, len(rows))
		}
	}
}

func TestMarchIndexSnapshotBoundaries(t *testing.T) {
	var s Server
	input := []march.TroopStack{{UnitCfgID: 1, Count: 4}}
	for id := int64(1); id <= 105; id++ {
		s.recordPlayerMarch(1, 7+id%2, id, id, input)
	}
	s.recordPlayerMarch(2, 7, 106, 106, input)
	input[0].Count = -1
	for _, tc := range []struct {
		name          string
		player, city  int64
		limit, offset int32
		total, count  int
		first         int64
	}{
		{"default", 1, 0, 0, 0, 105, 20, 1},
		{"negative", 1, 0, -1, -2, 105, 20, 1},
		{"cap", 1, 0, 999, 0, 105, 100, 1},
		{"tail", 1, 0, 100, 100, 105, 5, 101},
		{"end", 1, 0, 20, 105, 105, 0, 0},
		{"beyond", 1, 0, 20, 106, 105, 0, 0},
		{"city", 1, 7, 100, 0, 52, 52, 2},
		{"foreign", 2, 7, 100, 0, 1, 1, 106},
		{"empty", 3, 0, 100, 0, 0, 0, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rows, total := s.listPlayerMarches(tc.player, tc.city, tc.limit, tc.offset)
			if int(total) != tc.total || len(rows) != tc.count || (len(rows) > 0 && rows[0].marchID != tc.first) {
				t.Fatalf("pagination total=%d rows=%+v", total, rows)
			}
			for i := range rows {
				if rows[i].troops[0].Count != 4 {
					t.Fatal("input or earlier snapshot mutated retained troops")
				}
				rows[i].troops[0].Count = -2
				rows[i].marchID = -3
			}
		})
	}
	rows, _ := s.listPlayerMarches(1, 0, 1, 0)
	if rows[0].marchID != 1 || rows[0].troops[0].Count != 4 {
		t.Fatal("returned snapshot aliases the retained index")
	}
}

// Actual gateway dispatch and MIL callbacks, with synthetic stock and a bounded
// scheduler advance. This is memory concurrency evidence, not natural gameplay.
func TestMarchIndexGatewayAndHubFinishConcurrency(t *testing.T) {
	s := garrisonServer(t)
	const count = 32
	now := time.Unix(1700000000, 0)
	s.heroSvc = hero.NewService()
	s.SetClock(func() time.Time { return now })
	if err := s.RegisterCityForTest(7, s.citySnapshot(7), 1, 1); err != nil {
		t.Fatal(err)
	}
	s.SeedCityTroopsForTest(7, 1, count)
	ctx := context.Background()
	router := s.GatewayRouter()
	packets := make([]*commonv1.ClientPacket, count)
	for i := range packets {
		h := &hero.Hero{ServerID: 1, PlayerID: 55, TemplateCfgID: 1001, Level: 1, Status: hero.StatusIdle, CreatedAt: now}
		if err := s.heroSvc.Store.CreateHero(ctx, h); err != nil {
			t.Fatal(err)
		}
		packets[i] = &commonv1.ClientPacket{Route: RouteStartMarch, SessionId: "owner", ServerId: 1,
			Payload: mustProto(&militaryv1.StartMarchRequest{CityId: 7, HeroId: h.HeroID, ToX: 2, ToY: 1,
				Purpose: 1, Troops: []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 1}}})}
	}
	results := make(chan *militaryv1.StartMarchResponse, count)
	var wg sync.WaitGroup
	for _, packet := range packets {
		wg.Add(1)
		go func(pkt *commonv1.ClientPacket) {
			defer wg.Done()
			resp := router.Dispatch(ctx, pkt)
			var out militaryv1.StartMarchResponse
			if resp.Code != 0 || unmarshal(resp.Data, &out) != nil || out.March == nil {
				t.Errorf("dispatch failed: %v", resp)
				return
			}
			results <- &out
		}(packet)
	}
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	waitMarchIndexWorkers(t, done)
	close(results)
	armies := make(map[int64]bool)
	for out := range results {
		id := out.March.ArmyId
		if id <= 0 || armies[id] {
			t.Fatalf("gateway published duplicate army ID %d", id)
		}
		armies[id] = true
	}
	if len(armies) != count || s.military.SnapshotCity(7).Troops[1] != 0 {
		t.Fatal("dispatch count or troop deduction differs")
	}
	// Finish only already registered marches. The earlier registration window is
	// deliberately not presented as fixed by the memory-bookkeeping lock.
	start, finished := make(chan struct{}), make(chan struct{})
	go func() {
		<-start
		if got := s.military.Scheduler().PollDue(now.Add(time.Hour)); got != count {
			t.Errorf("scheduled finish count=%d", got)
		}
		close(finished)
	}()
	listed := make(chan struct{})
	go func() {
		defer close(listed)
		<-start
		for i := int64(1000); i < 1100; i++ {
			s.recordPlayerMarch(56, 8, i, i, nil)
			s.bindMarchHeroServer(i, 1)
			s.clearMarchHero(i)
			resp := router.Dispatch(ctx, &commonv1.ClientPacket{Route: RouteListMarches, SessionId: "owner", ServerId: 1,
				Payload: mustProto(&militaryv1.ListMarchesRequest{CityId: 7, Limit: count})})
			var out militaryv1.ListMarchesResponse
			if resp.Code != 0 || unmarshal(resp.Data, &out) != nil || out.Total != count || len(out.Marches) != count {
				t.Errorf("concurrent gateway history changed: %v", resp)
			}
		}
	}()
	close(start)
	waitMarchIndexWorkers(t, finished)
	waitMarchIndexWorkers(t, listed)
	rows, total := s.listPlayerMarches(55, 7, 100, 0)
	if total != count || len(rows) != count {
		t.Fatal("finish removed retained ownership history")
	}
	for _, row := range rows {
		if _, ok := s.lookupMarchHero(row.marchID); ok {
			t.Fatal("finished binding was not removed")
		}
		h, err := s.heroSvc.Store.GetHero(ctx, 1, row.heroID)
		if err != nil || h == nil || h.Status != hero.StatusIdle {
			t.Fatalf("already registered hero did not finish: %+v %v", h, err)
		}
	}
}
