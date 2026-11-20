package domestic

import (
	"context"
	"errors"
	"testing"
	"time"
)

func technicHub(t *testing.T) (*Hub, *CityState, *time.Time) {
	t.Helper()
	now := time.Unix(1799000000, 0)
	h := NewHub(func() time.Time { return now })
	city := &CityState{ID: 1, PlayerID: 7, Buildings: map[string]*BuildingInstance{
		"hall":    {CfgID: 1, Level: 5},
		"academy": {CfgID: 8, Level: 3},
	}, Wallet: Resources{10000, 10000, 10000, 10000}}
	if err := h.RegisterCity(city); err != nil {
		t.Fatal(err)
	}
	return h, city, &now
}

func TestTechnicCatalogCovers28With280Levels(t *testing.T) {
	tree := DefaultTechnicTree()
	if len(tree) != 28 {
		t.Fatalf("technics=%d", len(tree))
	}
	total := 0
	for _, def := range tree {
		if def.MaxLevel != 10 || len(def.Levels) != 10 {
			t.Fatalf("technic %d levels=%d", def.TID, len(def.Levels))
		}
		total += len(def.Levels)
	}
	if total != 280 {
		t.Fatalf("levels=%d", total)
	}
}

func TestTechnicResearchQueuesAndCompletes(t *testing.T) {
	h, city, now := technicHub(t)
	h.mu.Lock()
	city.Research = map[int32]int32{6: 5}
	h.mu.Unlock()
	res, err := h.StartTechnicResearch(context.Background(), 1, 1)
	if err != nil {
		t.Fatal(err)
	}
	if res.Target != 1 || city.ResearchJob == nil || city.Wallet.Food >= 10000 {
		t.Fatalf("research: %+v", res)
	}
	if _, err := h.StartTechnicResearch(context.Background(), 1, 2); err != ErrResearchBusy {
		t.Fatalf("second research: %v", err)
	}
	*now = res.FinishAt.Add(time.Second)
	if n := h.Tick(); n == 0 {
		t.Fatal("scheduler did not fire")
	}
	if city.Research[1] != 1 || city.ResearchJob != nil {
		t.Fatalf("completed research: %+v job=%+v", city.Research, city.ResearchJob)
	}
}

func TestTechnicPrerequisitesAndAcademyGate(t *testing.T) {
	h, city, _ := technicHub(t)
	if _, err := h.StartTechnicResearch(context.Background(), 1, 7); !errors.Is(err, ErrTechnicPrereq) {
		t.Fatalf("prereq accepted: %v", err)
	}
	h.mu.Lock()
	city.Research = map[int32]int32{6: 5}
	city.Buildings["academy"].Level = 2
	h.mu.Unlock()
	if _, err := h.StartTechnicResearch(context.Background(), 1, 7); !errors.Is(err, ErrTechnicPrereq) {
		t.Fatalf("academy gate accepted: %v", err)
	}
	city.Buildings["academy"].Level = 6
	if _, err := h.StartTechnicResearch(context.Background(), 1, 7); err != nil {
		t.Fatalf("tech 7 after gate: %v", err)
	}
}

func TestTechnicBonusIsPlayerGlobal(t *testing.T) {
	h, city, _ := technicHub(t)
	second := &CityState{ID: 2, PlayerID: 7, Buildings: map[string]*BuildingInstance{"hall": {CfgID: 1, Level: 5}}}
	h.mu.Lock()
	city.Research = map[int32]int32{1: 3, 28: 2}
	h.mu.Unlock()
	if err := h.RegisterCity(second); err != nil {
		t.Fatal(err)
	}
	if got := TechnicBonus(city, "food_pct"); got != 6+4 {
		t.Fatalf("food bonus=%d", got)
	}
	if got := TechnicBonus(city, "tax_pct"); got != 4 {
		t.Fatalf("tax bonus=%d", got)
	}
}
