package hero

import (
	"context"
	"math/rand"
	"reflect"
	"testing"
	"time"
)

func TestFamilyInjectionPlansPreserveExistingSeams(t *testing.T) {
	ctx, now := context.Background(), time.Unix(1_700_000_000, 0).UTC()
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	for _, level := range []int32{-1, 1, 50, 70} {
		for _, loyalty := range []int{0, 73} {
			svc := NewService()
			calls, rng := 0, &familyRandomCounter{}
			svc.RNG = rand.New(rng)
			svc.SetClock(func() time.Time { calls++; return now })
			coming := InjectComingInput{CityID: 3, Level: level, Loyalty: loyalty, Force: 9, Intel: 8, Politics: 7, Command: 6, DisplayName: "offer"}
			plan, err := svc.PlanComingInjection(p, coming)
			if err != nil || calls != 1 || plan.Hero.HeroID != 0 {
				t.Fatalf("coming plan %+v %v clock=%d", plan, err, calls)
			}
			h, err := svc.InjectComing(ctx, p, coming)
			if err != nil {
				t.Fatal(err)
			}
			rec, err := svc.ComingStore.GetComing(ctx, p.ServerID, h.HeroID)
			h.HeroID = 0
			if err != nil || !reflect.DeepEqual(h, plan.Hero) || *rec != plan.Record {
				t.Fatalf("coming parity %+v %+v %v", h, plan, err)
			}
			captive := InjectCaptiveInput{CityID: 3, Level: level, Loyalty: loyalty, Force: 9, Intel: 8, Politics: 7, Command: 6, DisplayName: "captive"}
			calls = 0
			cp, err := svc.PlanCaptiveInjection(p, captive)
			if err != nil || calls != 1 || cp.Hero.HeroID != 0 {
				t.Fatalf("captive plan %+v %v clock=%d", cp, err, calls)
			}
			h, err = svc.InjectCaptive(ctx, p, captive)
			if err != nil {
				t.Fatal(err)
			}
			cr, err := svc.CaptiveStore.GetCaptive(ctx, p.ServerID, h.HeroID)
			h.HeroID = 0
			if err != nil || !reflect.DeepEqual(h, cp.Hero) || *cr != cp.Record || rng.draws != 0 {
				t.Fatalf("captive parity %+v %+v %v rng=%d", h, cp, err, rng.draws)
			}
		}
	}
}
