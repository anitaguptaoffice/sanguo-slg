package march

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestHubDurableArrivalPublication(t *testing.T) {
	for _, mode := range []string{"failure", "no-battle", "annihilated"} {
		t.Run(mode, func(t *testing.T) {
			now := time.Unix(1000, 0)
			h := NewHub(func() time.Time { return now })
			original := MarchOrder{ID: 1, ArmyID: 7, ToX: 5, Speed: 100, Phase: PhaseMarching, ArriveAt: time.Unix(100, 0)}
			h.marches[1] = cloneMarch(&original)
			troops := []TroopStack{{UnitCfgID: 1, Count: 10}}
			h.marchCtx[1] = marchRuntime{PlayerID: 9, Troops: cloneStacks(troops)}
			finished := 0
			h.SetMarchFinishedHandler(func(int64) { finished++ })
			failure := errors.New("persistence failed")
			h.SetMarchArrivalHandler(func(_ context.Context, ev MarchArrivalEvent) (MarchArrivalOutcome, error) {
				if ev.Order.Phase != PhaseArrived {
					t.Fatal("callback did not receive arrived candidate")
				}
				if mode == "failure" {
					ev.Troops[0].Count = 0
					return MarchArrivalOutcome{Durable: true}, failure
				}
				out := MarchArrivalOutcome{Durable: true}
				if mode == "no-battle" {
					out.RemainingTroops = ev.Troops
				}
				return out, nil
			})
			// A manual/delayed event cannot move the durable return deadline.
			h.onMarchArrive(Event{RefID: 1, DueAt: now})
			got, survivors := h.SnapshotMarch(1)
			if mode == "failure" {
				if !reflect.DeepEqual(*got, original) || !reflect.DeepEqual(survivors, troops) || !errors.Is(h.MarchArrivalError(1), failure) || finished != 0 {
					t.Fatalf("failed arrival published: %+v %+v finished=%d", got, survivors, finished)
				}
				if h.Tick() != 0 {
					t.Fatal("failed arrival scheduled a return")
				}
				return
			}
			if h.MarchArrivalError(1) != nil {
				t.Fatal("unexpected quarantine")
			}
			if mode == "annihilated" {
				if got.Phase != PhaseReturned || len(survivors) != 0 || finished != 1 || h.Tick() != 0 {
					t.Fatalf("terminal arrival: %+v %+v finished=%d", got, survivors, finished)
				}
			} else {
				want := original
				_ = MarkArrived(&want)
				_ = BeginReturn(&want, original.ArriveAt)
				if got.Phase != PhaseReturning || !got.ReturnFinishAt.Equal(want.ReturnFinishAt) || !reflect.DeepEqual(survivors, troops) || finished != 0 {
					t.Fatalf("no-battle arrival: %+v %+v", got, survivors)
				}
			}
		})
	}
}
