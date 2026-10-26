package hero

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

func TestFamilyComingPlanParityAndCopies(t *testing.T) {
	ctx := context.Background()
	for _, loyalty := range []int{-1, 0, 51, 105} {
		svc, city, p, id := comingTestSetup(t)
		h, _ := svc.Store.GetHero(ctx, p.ServerID, id)
		h.Loyalty, h.ForceAdd, h.Exp = loyalty, 3, 17
		if err := svc.Store.SaveHero(ctx, h); err != nil {
			t.Fatal(err)
		}
		rec, _ := svc.ComingStore.GetComing(ctx, p.ServerID, id)
		before := *h
		plan, err := PlanComingAccept(p, 99, h, rec, city.officeLevel, []*Hero{h})
		if err != nil {
			t.Fatal(err)
		}
		old, err := svc.SureAcceptComing(ctx, p, CityRef{CityID: 99}, id, city)
		if err != nil || !reflect.DeepEqual(old.Hero, plan.Hero) || plan.Delete {
			t.Fatalf("parity %+v %+v %v", old, plan, err)
		}
		if *h != before {
			t.Fatal("input changed")
		}
		if _, err := PlanComingReject(p, 99, plan.Hero, rec); !errors.Is(err, ErrHeroNotComing) {
			t.Fatal(err)
		}
		if _, err := PlanComingAccept(p, 98, h, rec, 3, nil); !errors.Is(err, ErrComingCityMismatch) {
			t.Fatal(err)
		}
		if _, err := PlanComingAccept(p, 99, h, rec, 1, []*Hero{plan.Hero}); !errors.Is(err, ErrHotelCapacityFull) {
			t.Fatal(err)
		}
		reject, err := PlanComingReject(p, 0, h, rec)
		if err != nil || !reject.Delete || !reflect.DeepEqual(reject.Hero, h) {
			t.Fatalf("reject %+v %v", reject, err)
		}
	}
}

func TestFamilyCaptivePlanParityAndRequirements(t *testing.T) {
	ctx := context.Background()
	for _, level := range []int32{1, 49, 50, 59, 60, 90} {
		for _, requirement := range []CaptiveRecord{{CityID: 99}, {CityID: 99, SummonItemCfgID: 2051, SummonItemQty: 3}, {CityID: 99, SummonItemQty: 2}, {CityID: 99, SummonItemCfgID: 2050}} {
			svc, city, inv, p, id := captiveTestSetup(t)
			h, _ := svc.Store.GetHero(ctx, p.ServerID, id)
			h.Level, h.ForceAdd, h.Exp = level, 7, 103
			if err := svc.Store.SaveHero(ctx, h); err != nil {
				t.Fatal(err)
			}
			if err := svc.CaptiveStore.PutCaptive(ctx, p.ServerID, id, requirement); err != nil {
				t.Fatal(err)
			}
			before := *h
			plan, err := PlanCaptivePreview(p, 99, h, &requirement)
			if err != nil {
				t.Fatal(err)
			}
			old, err := svc.TrySummonCaptive(ctx, p, 99, id)
			if err != nil || old.Summary != plan.Summary || old.GoldCost != plan.GoldDebit || !reflect.DeepEqual(old.Items, plan.ItemDebits) {
				t.Fatalf("preview parity: %+v %+v %v", old, plan, err)
			}
			stored, _ := svc.CaptiveStore.GetCaptive(ctx, p.ServerID, id)
			if *stored != plan.Record || *h != before {
				t.Fatal("requirements/copy mismatch")
			}
			for _, item := range plan.ItemDebits {
				inv.items[item.ItemCfgID] = item.Quantity
			}
			summon, err := PlanCaptiveSummon(p, 0, h, &requirement, city.officeLevel, []*Hero{h})
			if err != nil {
				t.Fatal(err)
			}
			got, err := svc.SureSummonCaptive(ctx, p, CityRef{}, id, city, inv)
			if err != nil || !reflect.DeepEqual(got.Hero, summon.Hero) {
				t.Fatalf("summon parity %+v %+v %v", got, summon, err)
			}
			release, err := PlanCaptiveRelease(p, 99, h, &requirement)
			if err != nil || !release.Delete || release.Record != requirement || release.GoldDebit != 0 {
				t.Fatalf("release %+v %v", release, err)
			}
			if _, err := PlanCaptivePreview(p, 99, summon.Hero, &requirement); !errors.Is(err, ErrHeroNotCaptive) {
				t.Fatal(err)
			}
			if _, err := PlanCaptiveSummon(p, 99, h, &requirement, 1, []*Hero{summon.Hero}); !errors.Is(err, ErrHotelCapacityFull) {
				t.Fatal(err)
			}
		}
	}
}

func TestFamilyPlanScopeAndMissingMetadata(t *testing.T) {
	p := PlayerRef{ServerID: 1, PlayerID: 2}
	h := &Hero{ServerID: 1, PlayerID: 2, HeroID: 3, Status: StatusComing}
	if _, err := PlanComingReject(p, 1, h, nil); !errors.Is(err, ErrHeroNotComing) {
		t.Fatal(err)
	}
	h.Status = StatusCaptive
	if _, err := PlanCaptiveRelease(p, 1, h, nil); !errors.Is(err, ErrHeroNotCaptive) {
		t.Fatal(err)
	}
	if _, err := PlanCaptiveRelease(p, 2, h, &CaptiveRecord{CityID: 1}); !errors.Is(err, ErrCaptiveCityMismatch) {
		t.Fatal(err)
	}
	for _, bad := range []PlayerRef{{ServerID: 2, PlayerID: 2}, {ServerID: 1, PlayerID: 3}} {
		if _, err := PlanCaptiveRelease(bad, 1, h, &CaptiveRecord{CityID: 1}); !errors.Is(err, ErrHeroNotFound) {
			t.Fatal(err)
		}
	}
	if err := familyCapacity(p, 2, []*Hero{nil}); !errors.Is(err, ErrInvalidFamilyState) {
		t.Fatal(err)
	}
}
