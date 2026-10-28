package domestic

import (
	"math"
	"reflect"
	"strings"
	"testing"
	"time"
)

func freshFixture() (*CityState, map[int32]BuildingSpec) {
	return &CityState{PlayerID: 42, Wallet: Resources{Food: 8000, Wood: 8000, Stone: 5000, Iron: 5000},
		Buildings: map[string]*BuildingInstance{"hall": {CfgID: 1, Level: 1}, "farm": {CfgID: 2, Level: 1}}}, DefaultCatalog()
}

func TestFreshTemplateSnapshot(t *testing.T) {
	in, cat := freshFixture()
	out, copied, err := snapshotFreshTemplate(in, cat)
	if err != nil || !reflect.DeepEqual(in.Buildings, out.Buildings) || out.Wallet != in.Wallet || !reflect.DeepEqual(cat, copied) {
		t.Fatalf("template not preserved: %v %#v", err, out)
	}
	in.Buildings["hall"].Level = 3
	in.Buildings["new"] = &BuildingInstance{CfgID: 3, Level: 1}
	delete(cat, 1)
	if out.Buildings["hall"].Level != 1 || len(out.Buildings) != 2 || copied[1].ID != 1 {
		t.Fatal("snapshot aliases inputs")
	}
	out.Buildings["farm"].Level = 8
	delete(out.Buildings, "hall")
	delete(copied, 2)
	if in.Buildings["farm"].Level != 1 || in.Buildings["hall"] == nil || cat[2].ID != 2 {
		t.Fatal("input aliases snapshot")
	}
}

func TestFreshTemplateRejectsInvalidWithoutMutation(t *testing.T) {
	cases := map[string]func(*CityState, map[int32]BuildingSpec){
		"id":              func(c *CityState, _ map[int32]BuildingSpec) { c.ID = 1 },
		"negative id":     func(c *CityState, _ map[int32]BuildingSpec) { c.ID = -1 },
		"zero player":     func(c *CityState, _ map[int32]BuildingSpec) { c.PlayerID = 0 },
		"negative player": func(c *CityState, _ map[int32]BuildingSpec) { c.PlayerID = -1 },
		"wallet":          func(c *CityState, _ map[int32]BuildingSpec) { c.Wallet.Stone = -1 },
		"settled":         func(c *CityState, _ map[int32]BuildingSpec) { c.LastSettleAt = time.Now() },
		"wallet base":     func(c *CityState, _ map[int32]BuildingSpec) { c.walletBase.Food = 1 },
		"wallet saved":    func(c *CityState, _ map[int32]BuildingSpec) { c.walletSaved = true },
		"queue counter":   func(c *CityState, _ map[int32]BuildingSpec) { c.nextJobID = 1 },
		"production":      func(c *CityState, _ map[int32]BuildingSpec) { c.productionRemainder[3] = 1 },
		"nil job":         func(c *CityState, _ map[int32]BuildingSpec) { c.BuildJobs = []*BuildJob{nil} },
		"waiting":         func(c *CityState, _ map[int32]BuildingSpec) { c.BuildJobs = []*BuildJob{{Status: QueueWaiting}} },
		"active": func(c *CityState, _ map[int32]BuildingSpec) {
			c.BuildJobs = []*BuildJob{{Status: QueueActive, FinishAt: time.Now()}}
		},
		"done":             func(c *CityState, _ map[int32]BuildingSpec) { c.BuildJobs = []*BuildJob{{Status: QueueDone}} },
		"nil building map": func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings = nil },
		"nil building":     func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"] = nil },
		"zero cfg":         func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"].CfgID = 0 },
		"unknown cfg":      func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"].CfgID = 99 },
		"negative level":   func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"].Level = -1 },
		"zero level":       func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"].Level = 0 },
		"empty slot":       func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings[""] = &BuildingInstance{1, 1} },
		"long slot": func(c *CityState, _ map[int32]BuildingSpec) {
			c.Buildings[strings.Repeat("城", 33)] = &BuildingInstance{1, 1}
		},
		"nul slot":           func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["x\x00y"] = &BuildingInstance{1, 1} },
		"bad utf8":           func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["\xff"] = &BuildingInstance{1, 1} },
		"catalog id":         func(_ *CityState, cat map[int32]BuildingSpec) { cat[9] = BuildingSpec{ID: 8, BaseTimeSec: 1} },
		"catalog zero id":    func(_ *CityState, cat map[int32]BuildingSpec) { cat[0] = BuildingSpec{BaseTimeSec: 1} },
		"catalog time":       func(_ *CityState, cat map[int32]BuildingSpec) { s := cat[1]; s.BaseTimeSec = 0; cat[1] = s },
		"catalog overflow":   func(_ *CityState, cat map[int32]BuildingSpec) { s := cat[1]; s.BaseTimeSec = math.MaxInt64; cat[1] = s },
		"catalog cost":       func(_ *CityState, cat map[int32]BuildingSpec) { s := cat[1]; s.BaseCost.Wood = -1; cat[1] = s },
		"catalog production": func(_ *CityState, cat map[int32]BuildingSpec) { s := cat[1]; s.ProdPerHour = -1; cat[1] = s },
		"catalog resource":   func(_ *CityState, cat map[int32]BuildingSpec) { s := cat[1]; s.ProdRes = 4; cat[1] = s },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			in, cat := freshFixture()
			mutate(in, cat)
			// Copy without cloneCity, which assumes non-nil entries.
			before := *in
			before.Buildings = make(map[string]*BuildingInstance, len(in.Buildings))
			if in.Buildings == nil {
				before.Buildings = nil
			} else {
				for k, b := range in.Buildings {
					if b == nil {
						before.Buildings[k] = nil
					} else {
						v := *b
						before.Buildings[k] = &v
					}
				}
			}
			beforeCat := make(map[int32]BuildingSpec, len(cat))
			for k, v := range cat {
				beforeCat[k] = v
			}
			out, copied, err := snapshotFreshTemplate(in, cat)
			if err == nil || out != nil || copied != nil || !reflect.DeepEqual(in, &before) || !reflect.DeepEqual(cat, beforeCat) {
				t.Fatal("invalid input accepted or mutated")
			}
		})
	}
	in, cat := freshFixture()
	if _, _, err := snapshotFreshTemplate(nil, cat); err == nil {
		t.Fatal("nil city accepted")
	}
	if _, _, err := snapshotFreshTemplate(in, nil); err == nil {
		t.Fatal("nil catalog accepted")
	}
}

func TestFreshTemplateSchemaBoundaries(t *testing.T) {
	in, cat := freshFixture()
	in.Wallet.Food = math.MaxInt64
	in.Buildings[strings.Repeat("城", 32)] = &BuildingInstance{CfgID: 2, Level: math.MaxInt32}
	if _, _, err := snapshotFreshTemplate(in, cat); err != nil {
		t.Fatalf("representable values rejected: %v", err)
	}
}

func TestFreshTemplateEmptyJobsRemainIsolated(t *testing.T) {
	for _, jobs := range [][]*BuildJob{nil, make([]*BuildJob, 0, 1)} {
		in, cat := freshFixture()
		in.BuildJobs = jobs
		out, _, err := snapshotFreshTemplate(in, cat)
		if err != nil || (out.BuildJobs == nil) != (jobs == nil) {
			t.Fatalf("empty jobs changed: %v", err)
		}
		if jobs != nil {
			out.BuildJobs = append(out.BuildJobs, &BuildJob{ID: 5})
			if in.BuildJobs[:1][0] != nil {
				t.Fatal("empty slice backing array aliased")
			}
		}
	}
}
