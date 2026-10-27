package march

import (
	"context"
	"math"
	"reflect"
	"testing"
	"time"
)

func TestReturnCreditRejectsInvalidTotalsWithoutPartialMutation(t *testing.T) {
	for _, tc := range []struct {
		name      string
		ready     map[int32]int32
		survivors []TroopStack
	}{
		{"overflow", map[int32]int32{1: math.MaxInt32 - 9}, []TroopStack{{1, 10}}},
		{"later overflow", map[int32]int32{1: 100, 2: math.MaxInt32 - 9}, []TroopStack{{1, 20}, {2, 10}}},
		{"duplicate overflow", map[int32]int32{1: math.MaxInt32 - 10}, []TroopStack{{1, 6}, {1, 5}}},
		{"negative survivor", map[int32]int32{1: 100, 2: 100}, []TroopStack{{1, 20}, {2, -1}}},
		{"unknown survivor", map[int32]int32{1: 100}, []TroopStack{{1, 20}, {99, 1}}},
		{"unknown zero survivor", map[int32]int32{1: 100}, []TroopStack{{1, 20}, {99, 0}}},
		{"negative ready", map[int32]int32{1: 100, 2: -1}, []TroopStack{{1, 20}, {2, 10}}},
		{"negative ready zero survivor", map[int32]int32{1: 100, 2: -1}, []TroopStack{{1, 20}, {2, 0}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Unix(100, 0)
			h := NewHub(func() time.Time { return now })
			h.EnsureCity(&CityState{ID: 42, Troops: tc.ready})
			h.marches[1] = &MarchOrder{ID: 1, Phase: PhaseReturning, ReturnFinishAt: now}
			h.marchCtx[1] = marchRuntime{OriginCityID: 42, Troops: cloneStacks(tc.survivors)}
			finished := 0
			h.SetMarchFinishedHandler(func(int64) { finished++ })
			beforeCity := h.SnapshotCity(42)
			beforeOrder, beforeTroops := h.SnapshotMarch(1)
			for i := 0; i < 3; i++ {
				h.scheduler.Schedule(Event{Kind: EventMarchReturnDone, RefID: 1, DueAt: now, Handler: h.onMarchReturn})
				if h.Tick() != 1 || h.Tick() != 0 {
					t.Fatal("failed settlement must not schedule a new recovery event")
				}
				afterOrder, afterTroops := h.SnapshotMarch(1)
				if finished != 0 || !reflect.DeepEqual(h.SnapshotCity(42), beforeCity) || !reflect.DeepEqual(afterOrder, beforeOrder) || !reflect.DeepEqual(afterTroops, beforeTroops) {
					t.Fatal("invalid credit partially changed troops, history, phase or callback")
				}
			}
		})
	}
}

func TestReturnCreditMaxBoundaryAndEmptySurvivors(t *testing.T) {
	for _, tc := range []struct {
		name      string
		ready     map[int32]int32
		survivors []TroopStack
		want      map[int32]int32
	}{
		{"max boundary", map[int32]int32{1: math.MaxInt32 - 1}, []TroopStack{{1, 1}}, map[int32]int32{1: math.MaxInt32}},
		{"duplicate max boundary", map[int32]int32{1: math.MaxInt32 - 10}, []TroopStack{{1, 6}, {1, 0}, {1, 4}}, map[int32]int32{1: math.MaxInt32}},
		{"empty", map[int32]int32{1: 100}, nil, map[int32]int32{1: 100}},
		{"zero", map[int32]int32{1: 100}, []TroopStack{{2, 0}}, map[int32]int32{1: 100}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Unix(100, 0)
			h := NewHub(func() time.Time { return now })
			h.EnsureCity(&CityState{ID: 42, Troops: tc.ready})
			h.marches[1] = &MarchOrder{ID: 1, Phase: PhaseReturning, ReturnFinishAt: now}
			h.marchCtx[1] = marchRuntime{OriginCityID: 42, Troops: cloneStacks(tc.survivors)}
			finished := 0
			h.SetMarchFinishedHandler(func(int64) { finished++ })
			for i := 0; i < 3; i++ {
				h.onMarchReturn(Event{Kind: EventMarchReturnDone, RefID: 1})
			}
			order, troops := h.SnapshotMarch(1)
			if finished != 1 || order.Phase != PhaseReturned || !order.ReturnFinishAt.IsZero() || !reflect.DeepEqual(h.SnapshotCity(42).Troops, tc.want) || !reflect.DeepEqual(troops, tc.survivors) {
				t.Fatal("valid credit must settle once and retain its unchanged survivor history")
			}
		})
	}
}

// Recruitment can legitimately refill a city before its surviving army returns.
// This fixture reaches MaxInt32 without overflowing any recruitment arithmetic.
func TestReturnCreditOverflowAfterValidRecruit(t *testing.T) {
	clk := &stepClock{t: time.Unix(1000, 0)}
	h := NewHub(clk.Now)
	h.EnsureCity(&CityState{ID: 42, PlayerID: 9, Troops: map[int32]int32{1: math.MaxInt32 - 100},
		Wallet: Resources{Food: 12000, Wood: 6000}})
	h.SetMarchArrivalHandler(func(context.Context, MarchArrivalEvent) (MarchArrivalOutcome, error) {
		return MarchArrivalOutcome{BattleRan: true, ReportID: 7, RemainingTroops: []TroopStack{{1, 166}}}, nil
	})
	finished := 0
	h.SetMarchFinishedHandler(func(int64) { finished++ })
	order, err := h.CreateMarch(StartMarchRequest{OriginCityID: 42, PlayerID: 9, ToX: 100, Troops: []TroopStack{{1, 200}}})
	if err != nil {
		t.Fatal(err)
	}
	job, err := h.Recruit(RecruitRequest{CityID: 42, UnitCfgID: 1, Count: 300})
	if err != nil {
		t.Fatal(err)
	}
	clk.Advance(order.ArriveAt.Sub(clk.Now()))
	if h.Tick() != 1 {
		t.Fatal("arrival event")
	}
	returning, survivors := h.SnapshotMarch(order.ID)
	if returning.Phase != PhaseReturning || !reflect.DeepEqual(survivors, []TroopStack{{1, 166}}) {
		t.Fatal("missing authoritative battle survivors")
	}
	clk.Advance(job.FinishAt.Sub(clk.Now()))
	if h.Tick() != 1 || h.SnapshotCity(42).Troops[1] != math.MaxInt32 || !returning.ReturnFinishAt.After(clk.Now()) {
		t.Fatal("valid recruitment must refill the city before return")
	}
	before := h.SnapshotCity(42)
	clk.Advance(returning.ReturnFinishAt.Sub(clk.Now()))
	if h.Tick() != 1 {
		t.Fatal("return event")
	}
	after, troops := h.SnapshotMarch(order.ID)
	if finished != 0 || *after != *returning || !reflect.DeepEqual(troops, survivors) || !reflect.DeepEqual(h.SnapshotCity(42), before) {
		t.Fatal("overflow after valid recruitment must not publish returned or partially credit")
	}
}
