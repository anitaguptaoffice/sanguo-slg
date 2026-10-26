package march

import (
	"errors"
	"math"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestHubMarchDuplicateOverdraw(t *testing.T) {
	h := NewHub(func() time.Time { return time.Unix(100, 0) })
	h.EnsureCity(&CityState{ID: 42, Troops: map[int32]int32{1: 100}})
	order, err := h.CreateMarch(StartMarchRequest{OriginCityID: 42, ToX: 10,
		Troops: []TroopStack{{UnitCfgID: 1, Count: 80}, {UnitCfgID: 1, Count: 80}},
	})
	t.Logf("order=%+v error=%v ready=%d runtime=%+v scheduled=%d", order, err,
		h.SnapshotCity(42).Troops[1], h.marchCtx, len(h.scheduler.events))
	if !errors.Is(err, ErrInsufficientTroops) || order != nil || h.SnapshotCity(42).Troops[1] != 100 {
		t.Fatal("duplicate request must be rejected without deducting ready troops")
	}
}

func TestNormalizeMarchTroops(t *testing.T) {
	for _, tc := range []struct {
		name     string
		in, want []TroopStack
	}{
		{"unique order", []TroopStack{{3, 7}, {1, 9}, {2, 1}}, []TroopStack{{3, 7}, {1, 9}, {2, 1}}},
		{"duplicates", []TroopStack{{3, 7}, {1, 9}, {3, 4}, {2, 1}, {1, 2}}, []TroopStack{{3, 11}, {1, 11}, {2, 1}}},
		{"max count", []TroopStack{{1, math.MaxInt32 - 1}, {1, 1}}, []TroopStack{{1, math.MaxInt32}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := cloneStacks(tc.in)
			cat := DefaultUnitCatalog()
			got, err := NormalizeMarchTroops(cat, tc.in)
			if err != nil || !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %+v, %v; want %+v", got, err, tc.want)
			}
			if !reflect.DeepEqual(tc.in, before) || !reflect.DeepEqual(cat, DefaultUnitCatalog()) {
				t.Fatal("normalization changed its input")
			}
			got[0].Count = 0
			if !reflect.DeepEqual(tc.in, before) {
				t.Fatal("normalized output aliases caller troops")
			}
		})
	}
}

func TestMarchInvalidTroopsDoNotPublish(t *testing.T) {
	for _, tc := range []struct {
		name   string
		troops []TroopStack
		want   error
	}{
		{"empty", nil, ErrNoTroopsToMarch},
		{"zero", []TroopStack{{1, 10}, {2, 0}}, ErrInvalidMarch},
		{"negative", []TroopStack{{1, 10}, {2, -5}}, ErrInvalidMarch},
		{"min count", []TroopStack{{1, math.MinInt32}}, ErrInvalidMarch},
		{"unknown", []TroopStack{{1, 10}, {99, 1}}, ErrUnknownUnit},
		{"zero id", []TroopStack{{0, 1}}, ErrUnknownUnit},
		{"negative id", []TroopStack{{-1, 1}}, ErrUnknownUnit},
		{"overflow", []TroopStack{{1, math.MaxInt32}, {1, 1}}, ErrInvalidMarch},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := cloneStacks(tc.troops)
			got, err := NormalizeMarchTroops(DefaultUnitCatalog(), tc.troops)
			if got != nil || !errors.Is(err, tc.want) {
				t.Fatalf("normalize %+v, %v; want %v", got, err, tc.want)
			}
			now := time.Unix(100, 0)
			for _, origin := range []int64{0, 42} {
				h := NewHub(func() time.Time { return now })
				h.EnsureCity(&CityState{ID: 42, Wallet: Resources{Food: 500}, Troops: map[int32]int32{1: 100, 2: 100, 99: 100}})
				cityBefore := h.SnapshotCity(42)
				req := StartMarchRequest{OriginCityID: origin, ToX: 10, Troops: tc.troops}
				if order, err := BeginMarch(h.catalog, now, req); order != nil || !errors.Is(err, tc.want) {
					t.Fatalf("BeginMarch %+v, %v; want %v", order, err, tc.want)
				}
				if order, err := h.CreateMarch(req); order != nil || !errors.Is(err, tc.want) {
					t.Fatalf("CreateMarch %+v, %v; want %v", order, err, tc.want)
				}
				if !reflect.DeepEqual(h.SnapshotCity(42), cityBefore) || h.nextMarch != 0 || len(h.marches) != 0 || len(h.marchCtx) != 0 || h.scheduler.seq != 0 || !h.scheduler.NextDue().IsZero() {
					t.Fatal("rejected request changed city, identity, orders, runtime or scheduler")
				}
			}
			if !reflect.DeepEqual(tc.troops, before) {
				t.Fatal("rejected request changed caller troops")
			}
		})
	}
}

func TestHubMarchValidStacksPreserveTimingAndCopy(t *testing.T) {
	for _, troops := range [][]TroopStack{
		{{3, 25}, {2, 20}, {1, 25}},
		{{3, 15}, {2, 20}, {1, 25}, {3, 10}},
	} {
		clk := &stepClock{t: time.Unix(100, 0)}
		h := NewHub(clk.Now)
		h.EnsureCity(&CityState{ID: 42, Troops: map[int32]int32{1: 100, 2: 100, 3: 100}})
		before := cloneStacks(troops)
		order, err := h.CreateMarch(StartMarchRequest{ArmyID: 7, OriginCityID: 42, PlayerID: 9, HeroID: 11,
			ToX: 10, Purpose: 1, Troops: troops})
		if err != nil {
			t.Fatal(err)
		}
		want := []TroopStack{{3, 25}, {2, 20}, {1, 25}}
		rt := h.marchCtx[order.ID]
		if rt.OriginCityID != 42 || rt.PlayerID != 9 || rt.HeroID != 11 || !reflect.DeepEqual(rt.Troops, want) {
			t.Fatalf("runtime %+v", rt)
		}
		if !reflect.DeepEqual(troops, before) || !reflect.DeepEqual(h.SnapshotCity(42).Troops, map[int32]int32{1: 75, 2: 80, 3: 75}) {
			t.Fatal("caller troops changed or deduction incorrect")
		}
		troops[0].Count = 999
		if !reflect.DeepEqual(h.marchCtx[order.ID].Troops, want) {
			t.Fatal("runtime aliases caller troops")
		}
		if order.ID != 1 || order.ArmyID != 7 || order.Purpose != 1 || order.Phase != PhaseMarching || order.Speed != 50 || order.DepartAt != clk.Now() || order.ArriveAt != clk.Now().Add(720*time.Second) || h.scheduler.seq != 1 || h.scheduler.NextDue() != order.ArriveAt {
			t.Fatalf("order or schedule changed: %+v", order)
		}
		clk.Advance(719 * time.Second)
		if h.Tick() != 0 {
			t.Fatal("early arrival")
		}
		clk.Advance(time.Second)
		if h.Tick() != 1 || h.March(order.ID).Phase != PhaseArrived || h.Tick() != 0 {
			t.Fatal("arrival must fire once at the unchanged deadline")
		}
	}
}

func TestHubMarchCompetingDuplicateRequests(t *testing.T) {
	h := NewHub(func() time.Time { return time.Unix(100, 0) })
	h.EnsureCity(&CityState{ID: 42, Troops: map[int32]int32{1: 100}})
	var wins atomic.Int32
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := h.CreateMarch(StartMarchRequest{OriginCityID: 42, ToX: 10,
				Troops: []TroopStack{{1, 40}, {1, 40}},
			})
			if err == nil {
				wins.Add(1)
			} else if !errors.Is(err, ErrInsufficientTroops) {
				t.Errorf("unexpected error: %v", err)
			}
			h.SnapshotCity(42)
		}()
	}
	close(start)
	wg.Wait()
	if wins.Load() != 1 || h.SnapshotCity(42).Troops[1] != 20 || h.nextMarch != 1 || len(h.marches) != 1 || len(h.marchCtx) != 1 || h.scheduler.seq != 1 || len(h.scheduler.events) != 1 || !reflect.DeepEqual(h.marchCtx[1].Troops, []TroopStack{{1, 80}}) {
		t.Fatalf("wins=%d ready=%d orders=%d runtime=%+v scheduled=%d", wins.Load(), h.SnapshotCity(42).Troops[1], len(h.marches), h.marchCtx, len(h.scheduler.events))
	}
}
