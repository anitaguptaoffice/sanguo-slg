package domestic

import (
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestBuildPendingRejectsWithoutMutation(t *testing.T) {
	for _, existing := range []bool{false, true} {
		for _, waiting := range []bool{false, true} {
			now := time.Unix(1700000000, 0)
			c := &CityState{Wallet: Resources{10000, 10000, 10000, 10000}, Buildings: map[string]*BuildingInstance{"hall": {1, 3}}}
			if existing {
				c.Buildings["farm"] = &BuildingInstance{2, 1}
			}
			cat := DefaultCatalog()
			if waiting {
				if _, _, err := startUpgrade(c, cat, now, "hall", 1); err != nil {
					t.Fatal(err)
				}
			}
			res, _, err := startUpgrade(c, cat, now, "farm", 2)
			if err != nil {
				t.Fatal(err)
			}
			before := cloneCity(c)
			// An elapsed deadline is not completion. No allocation or debit is allowed.
			got, job, err := startUpgrade(c, cat, res.FinishAt.Add(time.Hour), "farm", 2)
			if !errors.Is(err, ErrInvalidUpgrade) || got != (UpgradeResult{}) || job != nil || !reflect.DeepEqual(c, before) {
				t.Fatalf("existing=%v waiting=%v: duplicate changed state: %v %+v", existing, waiting, err, got)
			}
		}
	}
}

func TestBuildPendingAllowsOtherSlotsAndCompletedUpgrade(t *testing.T) {
	now := time.Unix(1700000000, 0)
	h := NewHub(func() time.Time { return now })
	c := &CityState{ID: 1, Wallet: Resources{10000, 10000, 10000, 10000}, Buildings: map[string]*BuildingInstance{"hall": {1, 3}, "farm": {2, 1}}}
	if err := h.RegisterCity(c); err != nil {
		t.Fatal(err)
	}
	first, err := h.StartBuildingUpgrade(1, "farm", 2)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := h.StartBuildingUpgrade(1, "lumber", 3); err != nil {
		t.Fatal("different slot rejected", err)
	}
	now = first.FinishAt
	if h.Tick() != 1 || c.Buildings["farm"].Level != 2 {
		t.Fatal("completion failed")
	}
	if _, err := h.StartBuildingUpgrade(1, "farm", 2); err != nil || c.BuildJobs[len(c.BuildJobs)-1].Target != 3 {
		t.Fatal("legitimate next level rejected", err)
	}
}
