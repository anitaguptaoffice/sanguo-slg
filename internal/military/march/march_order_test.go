package march

import (
	"testing"
	"time"
)

func TestMarchPhaseMachine(t *testing.T) {
	now := time.Unix(0, 0)
	cat := DefaultUnitCatalog()
	order, err := BeginMarch(cat, now, StartMarchRequest{
		ArmyID: 1,
		FromX:  0, FromY: 0,
		ToX: 10, ToY: 0,
		Troops: []TroopStack{{UnitCfgID: 1, Count: 100}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if order.Phase != PhaseMarching {
		t.Fatal(order.Phase)
	}
	wantSec := MarchDurationSec(10, 50)
	if order.ArriveAt != now.Add(time.Duration(wantSec)*time.Second) {
		t.Fatalf("arrive %v", order.ArriveAt)
	}
	if err := MarkArrived(order); err != nil {
		t.Fatal(err)
	}
	if err := BeginReturn(order, order.ArriveAt); err != nil {
		t.Fatal(err)
	}
	if order.Phase != PhaseReturning {
		t.Fatal(order.Phase)
	}
	if err := MarkReturnComplete(order); err != nil {
		t.Fatal(err)
	}
	if order.Phase != PhaseReturned || !order.ReturnFinishAt.IsZero() {
		t.Fatal("back home returned")
	}
}
