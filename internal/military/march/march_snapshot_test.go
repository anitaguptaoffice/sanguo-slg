package march

import (
	"context"
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestSnapshotMarchCurrentTroopsAndIsolation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		result MarchArrivalOutcome
		phase  MarchPhase
		troops []TroopStack
	}{
		{"survivors returning", MarchArrivalOutcome{BattleRan: true, ReportID: 7, RemainingTroops: []TroopStack{{1, 166}}}, PhaseReturning, []TroopStack{{1, 166}}},
		{"zero survivors", MarchArrivalOutcome{BattleRan: true, ReportID: 8}, PhaseArrived, nil},
		{"no battle", MarchArrivalOutcome{}, PhaseArrived, []TroopStack{{1, 200}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			clk := &stepClock{t: time.Unix(100, 0)}
			h := NewHub(clk.Now)
			h.EnsureCity(&CityState{ID: 42, Troops: map[int32]int32{1: 300}})
			if order, troops := h.SnapshotMarch(999); order != nil || troops != nil {
				t.Fatal("missing march must not synthesize state")
			}
			h.SetMarchArrivalHandler(func(context.Context, MarchArrivalEvent) (MarchArrivalOutcome, error) { return tc.result, nil })
			created, err := h.CreateMarch(StartMarchRequest{OriginCityID: 42, PlayerID: 9, ToX: 10, Troops: []TroopStack{{1, 200}}})
			if err != nil {
				t.Fatal(err)
			}
			order, troops := h.SnapshotMarch(created.ID)
			if order.Phase != PhaseMarching || !reflect.DeepEqual(troops, []TroopStack{{1, 200}}) || *order != *h.March(created.ID) {
				t.Fatalf("outbound snapshot %+v %+v", order, troops)
			}
			order.Phase, troops[0].Count = PhasePending, 1
			order, troops = h.SnapshotMarch(created.ID)
			if order.Phase != PhaseMarching || troops[0].Count != 200 {
				t.Fatal("snapshot aliases stored order or troop slice")
			}
			clk.Advance(created.ArriveAt.Sub(clk.Now()))
			if h.Tick() != 1 {
				t.Fatal("arrival event")
			}
			order, troops = h.SnapshotMarch(created.ID)
			if order.Phase != tc.phase || order.LastReportID != tc.result.ReportID || !reflect.DeepEqual(troops, tc.troops) || *order != *h.March(created.ID) {
				t.Fatalf("arrival snapshot %+v %+v", order, troops)
			}
			if tc.phase == PhaseReturning {
				if order.ReturnFinishAt != clk.Now().Add(720*time.Second) {
					t.Fatal("return deadline changed")
				}
				clk.Advance(order.ReturnFinishAt.Sub(clk.Now()))
				if h.Tick() != 1 {
					t.Fatal("return event")
				}
				order, troops = h.SnapshotMarch(created.ID)
				if order.Phase != PhaseReturned || !order.ReturnFinishAt.IsZero() || !reflect.DeepEqual(troops, tc.troops) || h.SnapshotCity(42).Troops[1] != 266 {
					t.Fatal("returned snapshot must retain authoritative survivors as history")
				}
			}
		})
	}
}

func TestSnapshotMarchConcurrentArrivalConsistency(t *testing.T) {
	clk := &stepClock{t: time.Unix(100, 0)}
	h := NewHub(clk.Now)
	h.SetMarchArrivalHandler(func(context.Context, MarchArrivalEvent) (MarchArrivalOutcome, error) {
		return MarchArrivalOutcome{BattleRan: true, ReportID: 7, RemainingTroops: []TroopStack{{1, 166}}}, nil
	})
	created, err := h.CreateMarch(StartMarchRequest{PlayerID: 9, ToX: 10, Troops: []TroopStack{{1, 200}}})
	if err != nil {
		t.Fatal(err)
	}
	clk.Advance(created.ArriveAt.Sub(clk.Now()))
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			for j := 0; j < 500; j++ {
				order, troops := h.SnapshotMarch(created.ID)
				if len(troops) != 1 {
					t.Error("missing runtime troops")
					return
				}
				outbound := order.Phase == PhaseMarching && order.LastReportID == 0 && troops[0].Count == 200 && order.ReturnFinishAt.IsZero()
				returning := order.Phase == PhaseReturning && order.LastReportID == 7 && troops[0].Count == 166 && order.ReturnFinishAt == clk.Now().Add(720*time.Second)
				if !outbound && !returning {
					t.Errorf("torn snapshot %+v %+v", order, troops)
					return
				}
				order.Phase, troops[0].Count = PhasePending, 0
			}
		}()
	}
	close(start)
	if h.Tick() != 1 {
		t.Fatal("arrival event")
	}
	wg.Wait()
	order, troops := h.SnapshotMarch(created.ID)
	if order.Phase != PhaseReturning || troops[0].Count != 166 {
		t.Fatal("concurrent callers changed stored state")
	}
}
