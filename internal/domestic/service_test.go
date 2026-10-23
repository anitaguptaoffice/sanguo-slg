package domestic

import (
	"testing"
	"time"
)

func TestDomesticCore(t *testing.T) {
	cat := DefaultCatalog()
	c := &CityState{Buildings: map[string]*BuildingInstance{"hall": {1, 3}, "farm": {2, 2}}}
	if ValidateUpgrade(c, cat, "farm", 2, 3) != nil {
		t.Fatal("prereq ok")
	}
	c.Buildings["hall"].Level = 1
	if ValidateUpgrade(c, cat, "farm", 2, 3) != ErrPrereqMainHall {
		t.Fatal("prereq cap")
	}
	clock := time.Unix(1_700_000_000, 0)
	now := func() time.Time { return clock }
	h := NewHub(now)
	c = &CityState{ID: 1, LastSettleAt: clock, Wallet: Resources{1e4, 1e4, 1e4, 1e4},
		Buildings: map[string]*BuildingInstance{"hall": {1, 3}, "farm": {2, 1}}}
	h.RegisterCity(c)
	settleProduction(c, cat, clock.Add(time.Hour))
	if c.Wallet.Food == 0 {
		t.Fatal("accrual")
	}
	res, err := h.StartBuildingUpgrade(1, "farm", 2)
	if err != nil || !res.InProgress {
		t.Fatal("build")
	}
	if _, err := h.StartBuildingUpgrade(1, "lumber", 3); err != nil {
		t.Fatal(err)
	}
	clock = res.FinishAt
	if h.Tick() != 1 || c.Buildings["farm"].Level != 2 {
		t.Fatal("farm")
	}
	for _, j := range c.BuildJobs {
		if j.CfgID == 3 && j.Status == QueueActive {
			clock = j.FinishAt
		}
	}
	if h.Tick() != 1 || c.Buildings["lumber"].Level != 1 {
		t.Fatal("scheduler queue")
	}
}
