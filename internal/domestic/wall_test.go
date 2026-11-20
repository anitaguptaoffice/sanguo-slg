package domestic

import (
	"context"
	"testing"
	"time"
)

func TestWallDefensesBuildAndCapacity(t *testing.T) {
	now := time.Unix(1800000000, 0)
	h := NewHub(func() time.Time { return now })
	city := &CityState{ID: 1, PlayerID: 7, LastSettleAt: now, Buildings: map[string]*BuildingInstance{
		"hall": {CfgID: 1, Level: 3}, "wall": {CfgID: 7, Level: 2},
	}, Wallet: Resources{10000, 10000, 10000, 10000}}
	if err := h.RegisterCity(city); err != nil {
		t.Fatal(err)
	}
	rows, area, used, err := h.WallDefenses(context.Background(), 1)
	if err != nil || len(rows) != 5 || area != 40 || used != 0 {
		t.Fatalf("initial: %+v %d %d %v", rows, area, used, err)
	}
	rows, area, used, err = h.BuildWallDefense(context.Background(), 1, 1)
	if err != nil || rows[0].Count != 1 || used != 1 {
		t.Fatalf("trap: %+v %d %d %v", rows, area, used, err)
	}
	for i := 0; i < 7; i++ {
		if _, _, _, err = h.BuildWallDefense(context.Background(), 1, 3); err != nil {
			t.Fatalf("tower %d: %v", i, err)
		}
	}
	if _, _, _, err = h.BuildWallDefense(context.Background(), 1, 3); err != ErrWallCapacity {
		t.Fatalf("capacity: %v", err)
	}
	if city.Wallet.Food >= 10000 {
		t.Fatal("build did not spend resources")
	}
}

func TestWallDefensesRequireWall(t *testing.T) {
	h := NewHub(nil)
	city := &CityState{ID: 1, PlayerID: 7, Buildings: map[string]*BuildingInstance{"hall": {CfgID: 1, Level: 1}},
		Wallet: Resources{1000, 1000, 1000, 1000}}
	if err := h.RegisterCity(city); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := h.BuildWallDefense(context.Background(), 1, 1); err != ErrWallUnavailable {
		t.Fatalf("without wall: %v", err)
	}
}
