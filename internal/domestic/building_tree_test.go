package domestic

import (
	"math"
	"testing"
)

func TestBuildingTreeCoversTwentyBuildingsAnd320Levels(t *testing.T) {
	tree := DefaultBuildingTree()
	if len(tree) != 20 {
		t.Fatalf("buildings=%d want 20", len(tree))
	}
	total := 0
	for id, def := range tree {
		if def.MaxLevel != 16 || len(def.Levels) != 16 {
			t.Fatalf("building %d max=%d levels=%d", id, def.MaxLevel, len(def.Levels))
		}
		for i, row := range def.Levels {
			if row.Level != int32(i+1) {
				t.Fatalf("building %d level order %d", id, row.Level)
			}
		}
		total += len(def.Levels)
	}
	if total != 320 {
		t.Fatalf("levels=%d want 320", total)
	}
	for _, code := range []string{"main_hall", "academy", "drill_ground", "inn", "recruit_hall",
		"market", "smithy", "workshop", "stable", "warehouse", "diplomacy", "relay", "beacon",
		"house", "wall", "farm", "lumber", "quarry", "iron", "barracks"} {
		found := false
		for _, def := range tree {
			if def.Code == code {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("missing building code %s", code)
		}
	}
}

func TestBuildingTreeCostsMatchTheLegacyFormula(t *testing.T) {
	cat := FullCatalog()
	for id := int32(1); id <= 7; id++ {
		sp := cat[id]
		for level := int32(1); level <= 16; level++ {
			factor := math.Pow(costGrow, float64(level-1))
			want := Resources{
				int64(math.Floor(float64(sp.BaseCost.Food) * factor)),
				int64(math.Floor(float64(sp.BaseCost.Wood) * factor)),
				int64(math.Floor(float64(sp.BaseCost.Stone) * factor)),
				int64(math.Floor(float64(sp.BaseCost.Iron) * factor)),
			}
			if got := upCost(sp, level); got != want {
				t.Fatalf("building %d level %d cost=%+v want=%+v", id, level, got, want)
			}
			wantSec := int64(math.Floor(float64(sp.BaseTimeSec) * math.Pow(timeGrow, float64(level-1))))
			if got := int64(upDur(sp, level).Seconds()); got != wantSec {
				t.Fatalf("building %d level %d time=%d want=%d", id, level, got, wantSec)
			}
		}
	}
	if got := upCost(cat[2], 2); got != (Resources{80, 240, 48, 0}) {
		t.Fatalf("farm level 2 cost=%+v", got)
	}
	if got := upDur(cat[2], 2).Seconds(); got != 67 {
		t.Fatalf("farm level 2 time=%v", got)
	}
}

func TestBuildingTreePrerequisites(t *testing.T) {
	cat := FullCatalog()
	city := &CityState{ID: 1, Buildings: map[string]*BuildingInstance{
		"hall": {CfgID: 1, Level: 5},
	}}
	if err := ValidateUpgrade(city, cat, "academy", 8, 1); err != nil {
		t.Fatalf("academy level 1: %v", err)
	}
	city.Buildings["hall"].Level = 2
	if err := ValidateUpgrade(city, cat, "academy", 8, 1); err != ErrPrereqMainHall {
		t.Fatalf("academy without hall 3: %v", err)
	}

	city.Buildings["hall"].Level = 10
	city.Buildings["academy"] = &BuildingInstance{CfgID: 8, Level: 4}
	city.Buildings["market"] = &BuildingInstance{CfgID: 12, Level: 2}
	if err := ValidateUpgrade(city, cat, "academy", 8, 5); err != ErrPrereqBuilding {
		t.Fatalf("academy level 5 without market 3: %v", err)
	}
	city.Buildings["market"].Level = 3
	if err := ValidateUpgrade(city, cat, "academy", 8, 5); err != nil {
		t.Fatalf("academy level 5: %v", err)
	}

	city.Buildings["academy"].Level = 16
	if err := ValidateUpgrade(city, cat, "academy", 8, 17); err != ErrBuildingMaxLevel {
		t.Fatalf("max level: %v", err)
	}
}

func TestEveryNonHallLevelRequiresMainHall(t *testing.T) {
	tree := DefaultBuildingTree()
	for id, def := range tree {
		if def.Code == "main_hall" {
			continue
		}
		for _, row := range def.Levels {
			if row.HallLevel < row.Level {
				t.Fatalf("building %d level %d hall=%d below level", id, row.Level, row.HallLevel)
			}
			for _, req := range row.Prereqs {
				if req.CfgID <= 0 || req.CfgID == id || req.Level < 1 || req.Level > 16 {
					t.Fatalf("building %d level %d bad prereq %+v", id, row.Level, req)
				}
			}
		}
	}
}
