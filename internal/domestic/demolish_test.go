package domestic

import (
	"context"
	"testing"
	"time"
)

func TestDemolishDowngradesRefundsAndRemoves(t *testing.T) {
	now := time.Unix(1797000000, 0)
	h := NewHub(func() time.Time { return now })
	city := &CityState{ID: 1, PlayerID: 7, LastSettleAt: now, Buildings: map[string]*BuildingInstance{
		"hall": {CfgID: 1, Level: 3},
		"farm": {CfgID: 2, Level: 2},
	}, Wallet: Resources{1000, 1000, 1000, 1000}}
	if err := h.RegisterCity(city); err != nil {
		t.Fatal(err)
	}
	res, err := h.DemolishBuilding(context.Background(), 1, "farm")
	if err != nil {
		t.Fatal(err)
	}
	wantRefund := Resources{20, 60, 12, 0}
	if res.Refund != wantRefund || res.Level != 1 || res.Removed {
		t.Fatalf("first demolish: %+v", res)
	}
	if city.Buildings["farm"].Level != 1 || city.Wallet != (Resources{1020, 1060, 1012, 1000}) {
		t.Fatalf("city after first demolish: %+v", city)
	}
	res, err = h.DemolishBuilding(context.Background(), 1, "farm")
	if err != nil || !res.Removed || city.Buildings["farm"] != nil {
		t.Fatalf("second demolish: %+v %v", res, err)
	}
	if res.Refund != (Resources{12, 37, 7, 0}) {
		t.Fatalf("level 1 refund: %+v", res.Refund)
	}
	if _, err = h.DemolishBuilding(context.Background(), 1, "missing"); err != ErrUnknownBuilding {
		t.Fatalf("missing slot: %v", err)
	}
	if _, err = h.DemolishBuilding(context.Background(), 1, "hall"); err != nil {
		t.Fatalf("hall downgrade: %v", err)
	}
	if city.Buildings["hall"].Level != 2 {
		t.Fatalf("hall level: %d", city.Buildings["hall"].Level)
	}
	city.Buildings["hall"].Level = 1
	if _, err = h.DemolishBuilding(context.Background(), 1, "hall"); err != ErrCannotDemolish {
		t.Fatalf("hall level 1: %v", err)
	}

	city.Buildings["farm"] = &BuildingInstance{CfgID: 2, Level: 1}
	city.BuildJobs = append(city.BuildJobs, &BuildJob{ID: 9, Slot: "farm", CfgID: 2, Target: 2, Status: QueueActive})
	if _, err = h.DemolishBuilding(context.Background(), 1, "farm"); err != ErrInvalidUpgrade {
		t.Fatalf("busy slot: %v", err)
	}
}
