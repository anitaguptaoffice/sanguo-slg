package hero

import (
	"context"
	"math/rand"
	"reflect"
	"testing"
	"time"
)

type familyRandomCounter struct{ draws int }

func (r *familyRandomCounter) Seed(int64)   {}
func (r *familyRandomCounter) Int63() int64 { r.draws++; return 0 }

func TestFamilyLionizePlansMatchLegacy(t *testing.T) {
	ctx, now := context.Background(), time.Unix(1_700_100_000, 0).UTC()
	for _, npc := range []int32{1001, 1002, 1003, 1004, 9999} {
		for _, initial := range []*LionizeRecord{nil, {}, {Friend: 19}, {State: 1, Friend: 10}, {State: 1, Friend: 30}, {State: 2, Friend: 30}, {State: 3, Friend: 7}} {
			svc, city, _, p := persuadeTestSetup(t)
			svc.SetClock(func() time.Time { return now })
			if initial != nil {
				if err := svc.LionizeStore.Put(ctx, p.ServerID, p.PlayerID, npc, *initial); err != nil {
					t.Fatal(err)
				}
			}
			plan, planErr := svc.PlanLionize(p, CityRef{CityID: 100}, npc, initial, city.officeLevel, nil)
			old, oldErr := svc.LionizeHero(ctx, p, CityRef{CityID: 100}, npc, city)
			if planErr != oldErr {
				t.Fatalf("npc %d rec %+v: errors %v / %v", npc, initial, planErr, oldErr)
			}
			if oldErr != nil {
				continue
			}
			if old.Hero != nil {
				old.Hero.HeroID = 0
			}
			if !reflect.DeepEqual(plan.Result, old) || plan.GoldDebit != old.GoldSpent {
				t.Fatalf("result %+v / %+v", plan, old)
			}
			got, err := svc.LionizeStore.Get(ctx, p.ServerID, p.PlayerID, npc)
			if err != nil || *got != plan.Record {
				t.Fatalf("record %+v / %+v %v", got, plan.Record, err)
			}
		}
	}
}

func TestFamilyPersuadePlansMatchLegacy(t *testing.T) {
	ctx, now := context.Background(), time.Unix(1_700_100_000, 0).UTC()
	for _, rec := range []*LionizeRecord{nil, {}, {State: 2}, {State: 1, Friend: 30}, {State: 1, Friend: 10}, {State: 1, Friend: 29},
		{State: 1, Friend: 20, LastPersuadeAt: now.Add(-24 * time.Hour)}, {State: 1, Friend: 20, LastPersuadeAt: now.Add(-24*time.Hour + time.Nanosecond)}} {
		svc, city, inv, p := persuadeTestSetup(t)
		svc.SetClock(func() time.Time { return now })
		if rec != nil {
			if err := svc.LionizeStore.Put(ctx, p.ServerID, p.PlayerID, 1001, *rec); err != nil {
				t.Fatal(err)
			}
		}
		plan, planErr := svc.PlanPersuade(p, CityRef{CityID: 100}, 1001, rec)
		old, oldErr := svc.PersuadeHero(ctx, p, CityRef{CityID: 100}, 1001, city, inv)
		if planErr != oldErr {
			t.Fatalf("rec %+v errors %v / %v", rec, planErr, oldErr)
		}
		if oldErr != nil {
			continue
		}
		if plan.Result != old || plan.ItemDebit != (ItemCost{ItemCfgID: PersuadeItemCfgID, Quantity: PersuadeItemQty}) {
			t.Fatalf("results %+v / %+v", plan, old)
		}
		got, err := svc.LionizeStore.Get(ctx, p.ServerID, p.PlayerID, 1001)
		if err != nil || *got != plan.Record {
			t.Fatalf("record %+v / %+v %v", got, plan.Record, err)
		}
	}
}

func TestFamilyLionizePlansClockRNGCopiesAndEligibility(t *testing.T) {
	svc, _, _, p := persuadeTestSetup(t)
	clockCalls, now := 0, time.Unix(1_700_100_000, 0).UTC()
	svc.SetClock(func() time.Time { clockCalls++; return now })
	rng := &familyRandomCounter{}
	svc.RNG = rand.New(rng)
	svc.Store, svc.LionizeStore = nil, nil
	city := CityRef{CityID: 100}
	befriend, err := svc.PlanLionize(p, city, 1001, nil, 0, nil)
	if err != nil || !befriend.Result.Befriended || clockCalls != 0 {
		t.Fatalf("befriend %+v %v clocks %d", befriend, err, clockCalls)
	}
	before := LionizeRecord{State: 1, Friend: 29}
	rec := before
	persuade, err := svc.PlanPersuade(p, city, 1001, &rec)
	if err != nil || clockCalls != 1 || rec != before || persuade.Record.Friend != 30 || persuade.Result.FriendDelta != 10 {
		t.Fatalf("persuade %+v %v", persuade, err)
	}
	hire, err := svc.PlanLionize(p, city, 1001, &persuade.Record, 1, nil)
	if err != nil || clockCalls != 2 || rng.draws != 0 || hire.Result.Hero.HeroID != 0 || hire.Result.Hero.CreatedAt != now {
		t.Fatalf("hire %+v %v clock=%d rng=%d", hire, err, clockCalls, rng.draws)
	}
	for _, status := range []int16{StatusIdle, StatusComing, StatusCaptive} {
		h := &Hero{ServerID: p.ServerID, PlayerID: p.PlayerID, TemplateCfgID: 1001, Status: status}
		_, err := svc.PlanLionize(p, city, 1001, &persuade.Record, 1, []*Hero{h})
		if status == StatusCaptive && err != nil || status != StatusCaptive && err != ErrAlreadyOwned {
			t.Fatalf("status=%d err=%v", status, err)
		}
	}
	if _, err := svc.PlanLionize(p, city, 1001, &persuade.Record, 0, nil); err != ErrHotelCapacityFull {
		t.Fatal(err)
	}
	delete(svc.Catalog, 1001)
	if _, err := svc.PlanLionize(p, city, 1001, &persuade.Record, 1, nil); err != ErrUnknownTemplate {
		t.Fatal(err)
	}
}
