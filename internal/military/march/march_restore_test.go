package march

import (
	"context"
	"errors"
	"sync"
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
		"hero two armies":   func(in *restoreInput) { in.orders[1].Owner = restorePtr(int64(7)); in.orders[1].Heroes = []int64{11} },
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
	if len(h.scheduler.events) != 0 || len(h.restoreEv) != 2 || h.scheduler.PollDue(depart) != 0 {
		t.Fatal("restore events published before activation")
	}
	baseOK(t, h.ActivateRestore())
	ev := h.scheduler.events
	if h.nextMarch != 30 || len(h.marches) != 2 || h.marches[10].Phase != PhaseMarching || h.marches[30].Phase != PhaseReturning ||
		h.marches[10].Speed != 50 || h.marches[30].Speed != 100 || h.marches[30].ReturnFinishAt != *in.orders[1].ReturnAt ||
		h.marchCtx[10].HeroID != 0 || h.marchCtx[30].HeroID != 14 || h.marchCtx[30].OriginCityID != 101 ||
		len(ev) != 2 || ev[0].ev.Kind != EventMarchArrive || ev[0].ev.DueAt != arrive || ev[1].ev.Kind != EventMarchReturnDone ||
		ev[1].ev.DueAt != *in.orders[1].ReturnAt || h.scheduler.NextDue() != arrive {
		t.Fatalf("mapping %#v", h.marches)
	}
	if installRestore(h, items, stacks) == nil || h.ActivateRestore() == nil || len(h.marches) != 2 || len(h.scheduler.events) != 2 {
		t.Fatal("reinstalled or activated twice")
	}
}

func TestRestoreEmptyOnce(t *testing.T) {
	h := NewHub(time.Now)
	baseOK(t, installRestore(h, nil, nil))
	if err := installRestore(h, nil, nil); !errors.Is(err, ErrMarchRestore) {
		t.Fatalf("empty restore repeated: %v", err)
	}
	if h.nextMarch != 0 || len(h.marches) != 0 || len(h.marchCtx) != 0 {
		t.Fatal("empty snapshot changed hub")
	}
	baseOK(t, h.ActivateRestore())
	if h.ActivateRestore() == nil {
		t.Fatal("activation repeated")
	}
}

func TestRestoreActivationBarrier(t *testing.T) {
	d := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	in := restoreInput{
		orders: []restoreRow{{10, 20, 1, 1, 2, 3, 4, 1, d.Add(-2 * time.Hour), d.Add(-time.Hour), nil,
			restorePtr(int64(100)), restorePtr(int64(7)), restorePtr(int64(2)), []int64{11}}},
		troops: []restoreTroop{{20, 1, 5}}, heroes: []restoreHero{{11, 7, 3}},
	}
	_, items, stacks, err := validateRestore(1, DefaultUnitCatalog(), in.orders, in.troops, in.heroes, 0)
	baseOK(t, err)
	h := NewHub(func() time.Time { return d })
	baseOK(t, installRestore(h, items, stacks))
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if n := h.scheduler.PollDue(d); n != 0 {
				t.Errorf("overdue handler ran before activation: %d", n)
			}
		}()
	}
	wg.Wait()
	if !h.scheduler.NextDue().IsZero() || h.March(10).Phase != PhaseMarching {
		t.Fatal("overdue event published before activation")
	}
	baseOK(t, h.ActivateRestore())
	if h.scheduler.PollDue(d) != 1 || h.March(10).Phase == PhaseMarching {
		t.Fatal("activation did not publish the overdue event")
	}
}

// A restored overdue arrival must keep the remaining travel: the return is due
// at the original arrival plus travel, not at activation plus travel.
func TestRestoreOverdueArrivalKeepsRemainingReturn(t *testing.T) {
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		name   string
		arrive time.Time
	}{
		{"overdue", now.Add(-time.Minute)},
		{"on time", now},
	} {
		t.Run(tc.name, func(t *testing.T) {
			in := restoreInput{
				orders: []restoreRow{{10, 20, 1, 1, 1, 2, 3, 1, tc.arrive.Add(-time.Hour), tc.arrive, nil,
					restorePtr(int64(100)), restorePtr(int64(7)), restorePtr(int64(2)), []int64{11}}},
				troops: []restoreTroop{{20, 1, 5}}, heroes: []restoreHero{{11, 7, 3}},
			}
			_, items, stacks, err := validateRestore(1, DefaultUnitCatalog(), in.orders, in.troops, in.heroes, 0)
			baseOK(t, err)
			h := NewHub(func() time.Time { return now })
			arrivals := 0
			h.SetMarchArrivalHandler(func(context.Context, MarchArrivalEvent) (MarchArrivalOutcome, error) {
				arrivals++
				return MarchArrivalOutcome{BattleRan: true, ReportID: 7, RemainingTroops: []TroopStack{{1, 4}}}, nil
			})
			h.RegisterCity(&CityState{ID: 100, PlayerID: 7, Troops: map[int32]int32{}})
			baseOK(t, installRestore(h, items, stacks))
			baseOK(t, h.ActivateRestore())
			if n := h.scheduler.PollDue(now); n != 1 || arrivals != 1 {
				t.Fatalf("arrival poll=%d handler=%d", n, arrivals)
			}
			travel := time.Duration(MarchDurationSec(GridDistance(1, 1, 2, 3), h.March(10).Speed)) * time.Second
			want := tc.arrive.Add(travel)
			if travel != 144*time.Second {
				t.Fatalf("travel %v want 144s", travel)
			}
			order := h.March(10)
			if order.Phase != PhaseReturning || !order.ReturnFinishAt.Equal(want) || !h.scheduler.NextDue().Equal(want) {
				t.Fatalf("return %v next %v want %v", order.ReturnFinishAt, h.scheduler.NextDue(), want)
			}
			if h.scheduler.PollDue(want) != 1 || h.March(10).Phase != PhaseReturned || h.City(100).Troops[1] != 4 {
				t.Fatal("return event did not settle on the next poll")
			}
		})
	}
}
