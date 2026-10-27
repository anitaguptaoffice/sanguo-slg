package march

import (
	"context"
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestReturnSettlementOnceAndRetainedHistory(t *testing.T) {
	clk := &stepClock{t: time.Unix(100, 0)}
	h := NewHub(clk.Now)
	h.EnsureCity(&CityState{ID: 42, PlayerID: 9, Troops: map[int32]int32{1: 300, 2: 80}})
	arrivals, finished := 0, 0
	survivors := []TroopStack{{1, 166}, {2, 32}}
	h.SetMarchArrivalHandler(func(context.Context, MarchArrivalEvent) (MarchArrivalOutcome, error) {
		arrivals++
		return MarchArrivalOutcome{BattleRan: true, ReportID: 7, RemainingTroops: survivors}, nil
	})
	h.SetMarchFinishedHandler(func(id int64) {
		finished++
		// Callback runs under the Hub lock; inspect directly, never re-enter it.
		if h.marches[id].Phase != PhaseReturned || h.cities[42].Troops[1] != 266 || h.cities[42].Troops[2] != 62 {
			t.Error("callback ran before successful home settlement")
		}
	})
	created, err := h.CreateMarch(StartMarchRequest{ArmyID: 7, OriginCityID: 42, PlayerID: 9, HeroID: 11,
		FromX: 2, FromY: 3, ToX: 12, ToY: 3, Purpose: 1, Troops: []TroopStack{{1, 200}, {2, 50}}})
	if err != nil {
		t.Fatal(err)
	}
	if created.ArriveAt.Sub(created.DepartAt) != 720*time.Second {
		t.Fatal("outbound duration changed")
	}
	clk.Advance(719 * time.Second)
	if h.Tick() != 0 || h.March(created.ID).Phase != PhaseMarching {
		t.Fatal("early arrival")
	}
	clk.Advance(time.Second)
	if h.Tick() != 1 || arrivals != 1 || finished != 0 {
		t.Fatal("arrival callback count")
	}
	returning, troops := h.SnapshotMarch(created.ID)
	if returning.Phase != PhaseReturning || returning.ReturnFinishAt.Sub(returning.ArriveAt) != 720*time.Second || !reflect.DeepEqual(troops, survivors) {
		t.Fatalf("returning snapshot %+v %+v", returning, troops)
	}
	arrivalEvent := Event{Kind: EventMarchArrive, RefID: created.ID}
	h.onMarchArrive(arrivalEvent)
	if arrivals != 1 || finished != 0 {
		t.Fatal("replayed arrival re-resolved battle or released hero")
	}
	clk.Advance(719 * time.Second)
	if h.Tick() != 0 || h.SnapshotCity(42).Troops[1] != 100 {
		t.Fatal("early survivor credit")
	}
	clk.Advance(time.Second)
	if h.March(created.ID).Phase != PhaseReturning || h.SnapshotCity(42).Troops[1] != 100 {
		t.Fatal("clock alone must not complete settlement")
	}
	if h.Tick() != 1 || finished != 1 {
		t.Fatal("return event must finish once")
	}
	wantOrder := *returning
	wantOrder.Phase, wantOrder.ReturnFinishAt = PhaseReturned, time.Time{}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				h.onMarchReturn(Event{Kind: EventMarchReturnDone, RefID: created.ID})
				h.onMarchArrive(arrivalEvent)
				h.Tick()
				order, snapshot := h.SnapshotMarch(created.ID)
				if *order != wantOrder || !reflect.DeepEqual(snapshot, survivors) {
					t.Error("replayed events changed retained history")
				}
				order.Phase, snapshot[0].Count = PhasePending, 0
			}
		}()
	}
	wg.Wait()
	if finished != 1 || arrivals != 1 || !reflect.DeepEqual(h.SnapshotCity(42).Troops, map[int32]int32{1: 266, 2: 62}) {
		t.Fatal("replayed callbacks changed survivor balance or callback counts")
	}
	rt := h.marchCtx[created.ID]
	if rt.OriginCityID != 42 || rt.PlayerID != 9 || rt.HeroID != 11 || !reflect.DeepEqual(rt.Troops, survivors) || !h.scheduler.NextDue().IsZero() {
		t.Fatal("retained runtime identity/survivors or scheduler changed")
	}
	if err := h.Recall(created.ID); err != ErrInvalidPhase {
		t.Fatalf("returned history must not start another return: %v", err)
	}
}

func TestReturnMissingPrerequisitesDoNotSettle(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Hub)
	}{
		{"missing order", func(h *Hub) { delete(h.marches, 1) }},
		{"missing army runtime", func(h *Hub) { delete(h.marchCtx, 1) }},
		{"missing origin", func(h *Hub) { rt := h.marchCtx[1]; rt.OriginCityID = 0; h.marchCtx[1] = rt }},
		{"missing city", func(h *Hub) { delete(h.cities, 42) }},
		{"missing city troop storage", func(h *Hub) { h.cities[42].Troops = nil }},
	}
	for _, phase := range []MarchPhase{PhasePending, PhaseMarching, PhaseArrived, PhaseReturned, "future"} {
		cases = append(cases, struct {
			name   string
			mutate func(*Hub)
		}{string(phase), func(h *Hub) { h.marches[1].Phase = phase }})
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Unix(1000, 0)
			h := NewHub(func() time.Time { return now })
			h.EnsureCity(&CityState{ID: 42, Troops: map[int32]int32{1: 100}})
			h.marches[1] = &MarchOrder{ID: 1, ArmyID: 7, Phase: PhaseReturning, ReturnFinishAt: time.Unix(1, 0)}
			h.marchCtx[1] = marchRuntime{OriginCityID: 42, Troops: []TroopStack{{1, 166}}}
			finished := 0
			h.SetMarchFinishedHandler(func(int64) { finished++ })
			tc.mutate(h)
			beforeOrder, beforeTroops := h.SnapshotMarch(1)
			beforeCity := h.SnapshotCity(42)
			for i := 0; i < 3; i++ {
				h.scheduler.Schedule(Event{Kind: EventMarchReturnDone, RefID: 1, DueAt: now, Handler: h.onMarchReturn})
				h.Tick()
			}
			afterOrder, afterTroops := h.SnapshotMarch(1)
			if finished != 0 || !reflect.DeepEqual(beforeOrder, afterOrder) || !reflect.DeepEqual(beforeTroops, afterTroops) || !reflect.DeepEqual(beforeCity, h.SnapshotCity(42)) {
				t.Fatal("invalid return synthesized completion, callback or troops")
			}
		})
	}
}

func TestReturnTransitionRejectsNonReturning(t *testing.T) {
	for _, phase := range []MarchPhase{PhasePending, PhaseMarching, PhaseArrived, PhaseReturned, "future"} {
		order := MarchOrder{Phase: phase, ReturnFinishAt: time.Unix(1, 0)}
		before := order
		if err := MarkReturnComplete(&order); err != ErrInvalidPhase || order != before {
			t.Fatalf("phase %q changed on invalid completion: %+v %v", phase, order, err)
		}
	}
}

func TestArrivalWithoutReturnRetainsExistingPhase(t *testing.T) {
	for _, battleRan := range []bool{false, true} {
		clk := &stepClock{t: time.Unix(100, 0)}
		h := NewHub(clk.Now)
		h.EnsureCity(&CityState{ID: 42, Troops: map[int32]int32{1: 300}})
		arrivals, finished := 0, 0
		h.SetMarchArrivalHandler(func(context.Context, MarchArrivalEvent) (MarchArrivalOutcome, error) {
			arrivals++
			return MarchArrivalOutcome{BattleRan: battleRan}, nil
		})
		h.SetMarchFinishedHandler(func(int64) { finished++ })
		order, err := h.CreateMarch(StartMarchRequest{OriginCityID: 42, PlayerID: 9, ToX: 10, Troops: []TroopStack{{1, 200}}})
		if err != nil {
			t.Fatal(err)
		}
		clk.Advance(order.ArriveAt.Sub(clk.Now()))
		h.Tick()
		for i := 0; i < 3; i++ {
			h.onMarchArrive(Event{RefID: order.ID})
			h.onMarchReturn(Event{RefID: order.ID})
			h.Tick()
		}
		got, troops := h.SnapshotMarch(order.ID)
		wantTroops := []TroopStack{{1, 200}}
		if battleRan {
			wantTroops = nil
		}
		if got.Phase != PhaseArrived || !got.ReturnFinishAt.IsZero() || !reflect.DeepEqual(troops, wantTroops) || finished != 1 || arrivals != 1 || h.SnapshotCity(42).Troops[1] != 100 || !h.scheduler.NextDue().IsZero() {
			t.Fatalf("battle=%v: arrived semantics changed: %+v %+v", battleRan, got, troops)
		}
	}
}

func TestConcurrentReturnSettlement(t *testing.T) {
	now := time.Unix(1000, 0)
	h := NewHub(func() time.Time { return now })
	h.EnsureCity(&CityState{ID: 42, Troops: map[int32]int32{1: 100}})
	h.marches[1] = &MarchOrder{ID: 1, Phase: PhaseReturning, ReturnFinishAt: now}
	h.marchCtx[1] = marchRuntime{OriginCityID: 42, Troops: []TroopStack{{1, 166}}}
	finished := 0
	h.SetMarchFinishedHandler(func(int64) { finished++ })
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		h.scheduler.Schedule(Event{Kind: EventMarchReturnDone, RefID: 1, DueAt: now, Handler: h.onMarchReturn})
	}
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				order, troops := h.SnapshotMarch(1)
				returning := order.Phase == PhaseReturning && order.ReturnFinishAt == now
				returned := order.Phase == PhaseReturned && order.ReturnFinishAt.IsZero()
				if (!returning && !returned) || !reflect.DeepEqual(troops, []TroopStack{{1, 166}}) {
					t.Error("torn return snapshot")
				}
				h.Tick()
			}
		}()
	}
	wg.Wait()
	if finished != 1 || h.SnapshotCity(42).Troops[1] != 266 || h.March(1).Phase != PhaseReturned {
		t.Fatal("concurrent events must settle exactly once")
	}
}
