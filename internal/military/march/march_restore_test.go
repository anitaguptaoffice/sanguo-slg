package march

import (
	"errors"
	"testing"
	"time"
)

func restorePtr[T any](v T) *T { return &v }

type restoreInput struct {
	orders  []restoreRow
	troops  []restoreTroop
	heroes  []restoreHero
	orphans int64
}

func restoreSample() restoreInput {
	d := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	a := d.Add(time.Hour)
	return restoreInput{orders: []restoreRow{{10, 20, 1, 1, 2, 3, 4, 1, d, a, nil, restorePtr(int64(100)), restorePtr(int64(7)), restorePtr(int64(2)), []int64{11, 12}}, {30, 40, 3, 1, 2, 4, 3, 1, d, a, restorePtr(a.Add(time.Hour)), restorePtr(int64(101)), restorePtr(int64(8)), restorePtr(int64(3)), []int64{14}}}, troops: []restoreTroop{{20, 1, 5}, {40, 2, 3}}, heroes: []restoreHero{{11, 7, 3}, {12, 7, 3}, {13, 7, 3}, {14, 8, 3}}}
}

func validateSample(in restoreInput) error {
	_, _, _, err := validateRestore(1, DefaultUnitCatalog(), in.orders, in.troops, in.heroes, in.orphans)
	return err
}

func TestMarchRestoreRejects(t *testing.T) {
	for name, mutate := range map[string]func(*restoreInput){
		"orphan army":       func(in *restoreInput) { in.orphans = 1 },
		"unknown status":    func(in *restoreInput) { in.orders[1].Status = 9 },
		"origin zero":       func(in *restoreInput) { *in.orders[0].Origin = 0 },
		"owner zero":        func(in *restoreInput) { *in.orders[0].Owner = 0 },
		"army unknown":      func(in *restoreInput) { *in.orders[0].ArmyStatus = 9 },
		"army missing":      func(in *restoreInput) { in.orders[0].ArmyStatus = nil },
		"army garrison":     func(in *restoreInput) { *in.orders[0].ArmyStatus = 1 },
		"purpose":           func(in *restoreInput) { in.orders[0].Purpose = 4 },
		"depart zero":       func(in *restoreInput) { in.orders[0].DepartAt = time.Time{} },
		"arrive order":      func(in *restoreInput) { in.orders[0].ArriveAt = in.orders[0].DepartAt },
		"marching deadline": func(in *restoreInput) { in.orders[0].ReturnAt = restorePtr(in.orders[0].ArriveAt) },
		"return missing":    func(in *restoreInput) { in.orders[1].ReturnAt = nil },
		"return early":      func(in *restoreInput) { *in.orders[1].ReturnAt = in.orders[1].ArriveAt },
		"troops missing":    func(in *restoreInput) { in.troops = nil },
		"troop unknown":     func(in *restoreInput) { in.troops[0].Unit = 99 },
		"troop zero":        func(in *restoreInput) { in.troops[0].Count = 0 },
		"troop duplicate":   func(in *restoreInput) { in.troops = append(in.troops, in.troops[0]) },
		"heroes missing":    func(in *restoreInput) { in.orders[0].Heroes = nil },
		"hero zero":         func(in *restoreInput) { in.orders[0].Heroes[0] = 0 },
		"hero duplicate":    func(in *restoreInput) { in.orders[0].Heroes[1] = 11 },
		"hero unknown":      func(in *restoreInput) { in.orders[0].Heroes[0] = 99 },
		"hero owner":        func(in *restoreInput) { in.heroes[0].Player = 8 },
		"hero idle":         func(in *restoreInput) { in.heroes[0].Status = 2 },
		"duplicate army":    func(in *restoreInput) { in.orders = append(in.orders, in.orders[0]) },
		"release player":    func(in *restoreInput) { in.heroes[2].Player = 0 },
	} {
		t.Run(name, func(t *testing.T) {
			in := restoreSample()
			mutate(&in)
			if err := validateSample(in); !errors.Is(err, ErrMarchRestore) {
				t.Fatalf("accepted %s: %v", name, err)
			}
		})
	}
	if _, _, _, err := validateRestore(0, DefaultUnitCatalog(), nil, nil, nil, 0); !errors.Is(err, ErrMarchRestore) {
		t.Fatal("server")
	}
	if _, _, _, err := validateRestore(1, nil, nil, nil, nil, 0); !errors.Is(err, ErrMarchRestore) {
		t.Fatal("catalog")
	}
}

func TestMarchRestorePlanAndInstall(t *testing.T) {
	in := restoreSample()
	depart, arrive := in.orders[0].DepartAt, in.orders[0].ArriveAt
	in.orders = append(in.orders, restoreRow{50, 60, 4, 1, 1, 2, 2, 1, depart, arrive, nil, restorePtr(int64(100)), nil, nil, []int64{13}})
	result, items, stacks, err := validateRestore(1, DefaultUnitCatalog(), in.orders, in.troops, in.heroes, 0)
	baseOK(t, err)
	if len(items) != 2 || len(result.Marches) != 2 || len(result.Release) != 1 || result.Release[0] != (HeroRelease{1, 7, 13}) {
		t.Fatalf("result %#v", result)
	}
	h := NewHub(func() time.Time { return depart })
	baseOK(t, installRestore(h, items, stacks))
	ev := h.scheduler.events
	if h.nextMarch != 30 || len(h.marches) != 2 || h.marches[10].Phase != PhaseMarching || h.marches[30].Phase != PhaseReturning ||
		h.marches[10].Speed != 50 || h.marches[30].Speed != 100 || h.marches[30].ReturnFinishAt != *in.orders[1].ReturnAt ||
		h.marchCtx[10].HeroID != 0 || h.marchCtx[30].HeroID != 14 || h.marchCtx[30].OriginCityID != 101 ||
		len(ev) != 2 || ev[0].ev.Kind != EventMarchArrive || ev[0].ev.DueAt != arrive || ev[1].ev.Kind != EventMarchReturnDone ||
		ev[1].ev.DueAt != *in.orders[1].ReturnAt || h.scheduler.NextDue() != arrive {
		t.Fatalf("mapping %#v", h.marches)
	}
	if installRestore(h, items, stacks) == nil || len(h.marches) != 2 || len(h.scheduler.events) != 2 {
		t.Fatal("reinstalled")
	}
}
