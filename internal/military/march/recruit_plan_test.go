package march

import (
	"fmt"
	"maps"
	"math"
	"reflect"
	"testing"
	"time"
)

func TestPlanRecruitDefaults(t *testing.T) {
	catalog := DefaultUnitCatalog()
	cases := []struct {
		unit, count int32
		cost        Resources
		seconds     int64
	}{
		{1, 1, Resources{40, 20, 0, 0}, 30},
		{1, 10, Resources{400, 200, 0, 0}, 300},
		{2, 1, Resources{80, 40, 20, 0}, 45},
		{2, 10, Resources{800, 400, 200, 0}, 450},
		{3, 1, Resources{50, 60, 0, 0}, 35},
		{3, 10, Resources{500, 600, 0, 0}, 350},
		{4, 1, Resources{100, 80, 30, 40}, 60},
		{4, 10, Resources{1000, 800, 300, 400}, 600},
	}
	for _, tc := range cases {
		t.Run(fmt.Sprintf("unit%d/count%d", tc.unit, tc.count), func(t *testing.T) {
			req := RecruitRequest{CityID: 42, UnitCfgID: tc.unit, Count: tc.count}
			plan, err := PlanRecruit(catalog, req)
			if err != nil || plan.Request() != req || plan.Cost() != tc.cost ||
				plan.DurationSeconds() != tc.seconds || plan.Duration() != time.Duration(tc.seconds)*time.Second {
				t.Fatalf("plan=%+v err=%v", plan, err)
			}
			if plan.Cost() != catalog[tc.unit].RecruitCost.Scale(tc.count) ||
				plan.Duration() != recruitDuration(catalog[tc.unit], tc.count) {
				t.Fatal("safe legacy formula parity failed")
			}
		})
	}
}

func TestPlanRecruitValidation(t *testing.T) {
	valid := UnitSpec{UnitCfgID: 1, SecPerUnit: 1}
	cases := []struct {
		name    string
		count   int32
		unit    int32
		spec    UnitSpec
		nilMap  bool
		wantErr error
	}{
		{"zero count", 0, 1, valid, false, ErrInvalidCount},
		{"negative count", -1, 1, valid, false, ErrInvalidCount},
		{"minimum count", math.MinInt32, 1, valid, false, ErrInvalidCount},
		{"count before lookup", 0, 9, valid, true, ErrInvalidCount},
		{"unknown", 1, 9, valid, false, ErrUnknownUnit},
		{"nil catalog", 1, 1, valid, true, ErrUnknownUnit},
		{"mismatched ID", 1, 1, UnitSpec{UnitCfgID: 2, SecPerUnit: 1}, false, ErrInvalidRecruitSpec},
		{"zero seconds", 1, 1, UnitSpec{UnitCfgID: 1}, false, ErrInvalidRecruitSpec},
		{"negative seconds", 1, 1, UnitSpec{UnitCfgID: 1, SecPerUnit: -1}, false, ErrInvalidRecruitSpec},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			catalog := map[int32]UnitSpec{1: tc.spec}
			if tc.nilMap {
				catalog = nil
			}
			req := RecruitRequest{CityID: -1, UnitCfgID: tc.unit, Count: tc.count}
			before, reqBefore := maps.Clone(catalog), req
			plan, err := PlanRecruit(catalog, req)
			if err != tc.wantErr || plan != (RecruitPlan{}) {
				t.Fatalf("plan=%+v err=%v want=%v", plan, err, tc.wantErr)
			}
			if !maps.Equal(catalog, before) || req != reqBefore {
				t.Fatal("error mutated input")
			}
		})
	}
}

func TestPlanRecruitResourceBoundaries(t *testing.T) {
	fields := []struct {
		name string
		set  func(*Resources, int64)
	}{
		{"food", func(r *Resources, x int64) { r.Food = x }},
		{"wood", func(r *Resources, x int64) { r.Wood = x }},
		{"iron", func(r *Resources, x int64) { r.Iron = x }},
		{"stone", func(r *Resources, x int64) { r.Stone = x }},
	}
	cases := []struct {
		name    string
		price   int64
		count   int32
		want    int64
		wantErr error
	}{
		{"negative", -1, 1, 0, ErrInvalidRecruitSpec},
		{"maximum", math.MaxInt64, 1, math.MaxInt64, nil},
		{"half safe", math.MaxInt64 / 2, 2, math.MaxInt64 - 1, nil},
		{"half overflow", math.MaxInt64/2 + 1, 2, 0, ErrRecruitOverflow},
	}
	for _, field := range fields {
		for _, tc := range cases {
			t.Run(field.name+"/"+tc.name, func(t *testing.T) {
				cost, want := Resources{}, Resources{}
				field.set(&cost, tc.price)
				field.set(&want, tc.want)
				spec := UnitSpec{UnitCfgID: 1, RecruitCost: cost, SecPerUnit: 1}
				catalog := map[int32]UnitSpec{1: spec}
				plan, err := PlanRecruit(catalog, RecruitRequest{UnitCfgID: 1, Count: tc.count})
				if err != tc.wantErr || (err != nil && plan != (RecruitPlan{})) {
					t.Fatalf("plan=%+v err=%v want=%v", plan, err, tc.wantErr)
				}
				if err == nil && (plan.Cost() != want || plan.DurationSeconds() != int64(tc.count)) {
					t.Fatalf("incorrect boundary result: %+v", plan)
				}
				if catalog[1] != spec {
					t.Fatal("selected spec changed")
				}
			})
		}
	}
}

func TestPlanRecruitDurationBoundaries(t *testing.T) {
	const maxSeconds = math.MaxInt64 / int64(time.Second)
	cases := []struct {
		name    string
		seconds int64
		count   int32
		want    int64
		wantErr error
	}{
		{"seconds multiply overflow", math.MaxInt64, 2, 0, ErrRecruitOverflow},
		{"maximum whole seconds", maxSeconds, 1, maxSeconds, nil},
		{"nanoseconds overflow", maxSeconds + 1, 1, 0, ErrRecruitOverflow},
		{"maximum count", 1, math.MaxInt32, math.MaxInt32, nil},
		{"zero cost", 1, 1, 1, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			catalog := map[int32]UnitSpec{1: {UnitCfgID: 1, SecPerUnit: tc.seconds}}
			plan, err := PlanRecruit(catalog, RecruitRequest{UnitCfgID: 1, Count: tc.count})
			if err != tc.wantErr || (err != nil && plan != (RecruitPlan{})) {
				t.Fatalf("plan=%+v err=%v want=%v", plan, err, tc.wantErr)
			}
			if err == nil && (plan.DurationSeconds() != tc.want ||
				plan.Duration() != time.Duration(tc.want)*time.Second || plan.Cost() != (Resources{})) {
				t.Fatalf("incorrect duration result: %+v", plan)
			}
		})
	}
	plan, err := PlanRecruit(DefaultUnitCatalog(), RecruitRequest{UnitCfgID: 4, Count: math.MaxInt32})
	if err != ErrRecruitOverflow || plan != (RecruitPlan{}) {
		t.Fatalf("default siege overflow: plan=%+v err=%v", plan, err)
	}
}

func TestPlanRecruitImmutable(t *testing.T) {
	catalog := DefaultUnitCatalog()
	catalog[9] = UnitSpec{UnitCfgID: -1, SecPerUnit: -1, RecruitCost: Resources{Food: -1}}
	before := maps.Clone(catalog)
	req := RecruitRequest{CityID: math.MinInt64, UnitCfgID: 1, Count: 10}
	reqBefore := req
	fixture := &CityState{ID: 7, Wallet: Resources{Food: 123}, Troops: map[int32]int32{1: 9}, nextJobID: 12}
	fixtureBefore := *fixture
	fixtureBefore.Troops = maps.Clone(fixture.Troops)
	plan, err := PlanRecruit(catalog, req)
	if err != nil {
		t.Fatal(err)
	}
	if !maps.Equal(catalog, before) || req != reqBefore || !reflect.DeepEqual(*fixture, fixtureBefore) {
		t.Fatal("success mutated inputs or unrelated fixture")
	}
	_, err = PlanRecruit(catalog, RecruitRequest{UnitCfgID: 9, Count: 1})
	if err != ErrInvalidRecruitSpec || !maps.Equal(catalog, before) || !reflect.DeepEqual(*fixture, fixtureBefore) {
		t.Fatal("error mutated catalog or unrelated fixture")
	}
	want := plan
	req.Count = 99
	catalog[1] = UnitSpec{}
	delete(catalog, 9)
	requestCopy, costCopy := plan.Request(), plan.Cost()
	requestCopy.CityID, requestCopy.Count = 0, 0
	costCopy.Food, costCopy.Wood = -1, -1
	if plan != want || plan.Request() != reqBefore || plan.Cost() != (Resources{Food: 400, Wood: 200}) {
		t.Fatal("caller mutations changed plan")
	}
	if requestCopy == plan.Request() || costCopy == plan.Cost() {
		t.Fatal("test copies were not modified")
	}
}

func TestPlanRecruitConcurrentReadOnly(t *testing.T) {
	catalog := DefaultUnitCatalog()
	req := RecruitRequest{UnitCfgID: 2, Count: 10}
	want, err := PlanRecruit(catalog, req)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 32; i++ {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			for j := 0; j < 100; j++ {
				got, err := PlanRecruit(catalog, req)
				if err != nil || got != want {
					t.Fatalf("nondeterministic result: %+v %v", got, err)
				}
			}
		})
	}
}
