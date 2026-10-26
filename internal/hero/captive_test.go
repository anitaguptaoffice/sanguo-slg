package hero

import (
	"context"
	"testing"
)

func captiveTestSetup(t *testing.T) (*Service, *stubHotelCity, *memInventory, PlayerRef, int64) {
	svc := NewService()
	city := &stubHotelCity{hotelLevel: 1, officeLevel: 3, gold: 1_000_000}
	inv := &memInventory{
		wallet: Resources{Gold: 1_000_000},
		items:  map[int32]int32{CaptiveSummonItemCfgID: 10},
	}
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	ctx := context.Background()
	h, err := svc.InjectCaptive(ctx, p, InjectCaptiveInput{
		CityID: 99, DisplayName: "张俘", Level: 10,
		Force: 80, Intel: 70, Politics: 60, Command: 50,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc, city, inv, p, h.HeroID
}

func TestSureSummonCaptiveSuccess(t *testing.T) {
	ctx := context.Background()
	svc, city, inv, p, heroID := captiveTestSetup(t)

	try, err := svc.TrySummonCaptive(ctx, p, 99, heroID)
	if err != nil || try.GoldCost <= 0 {
		t.Fatalf("try: %v cost=%d", err, try.GoldCost)
	}
	res, err := svc.SureSummonCaptive(ctx, p, CityRef{CityID: 99}, heroID, city, inv)
	if err != nil {
		t.Fatal(err)
	}
	if res.Hero.Status != StatusIdle || res.Hero.Loyalty != 50 {
		t.Fatalf("unexpected hero after summon: status=%d loyalty=%d", res.Hero.Status, res.Hero.Loyalty)
	}
	rec, err := svc.CaptiveStore.GetCaptive(ctx, p.ServerID, heroID)
	if err != nil || rec != nil {
		t.Fatalf("captive meta should be cleared: %v %v", rec, err)
	}
	list, err := svc.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil || len(list) != 1 || list[0].Status != StatusIdle {
		t.Fatalf("owned list: %v", list)
	}
}

func TestSureSummonCaptiveInsufficientItem(t *testing.T) {
	ctx := context.Background()
	svc, city, inv, p, _ := captiveTestSetup(t)
	inv.items[CaptiveSummonItemCfgID] = 0

	_, err := svc.InjectCaptive(ctx, p, InjectCaptiveInput{
		CityID: 99, DisplayName: "高俘", Level: 55,
		Force: 90, Intel: 90, Politics: 90, Command: 90,
	})
	if err != nil {
		t.Fatal(err)
	}
	heroes, _, _ := svc.ListCaptiveHeroes(ctx, p)
	var highHeroID int64
	for _, h := range heroes {
		if h.Level == 55 {
			highHeroID = h.HeroID
		}
	}
	if highHeroID == 0 {
		t.Fatal("missing high level captive")
	}
	_, err = svc.SureSummonCaptive(ctx, p, CityRef{CityID: 99}, highHeroID, city, inv)
	if err != ErrInsufficientItem {
		t.Fatalf("expected insufficient item, got %v", err)
	}
}

func TestSureSummonCaptiveNotCaptive(t *testing.T) {
	ctx := context.Background()
	svc, city, inv, p, heroID := captiveTestSetup(t)
	_, err := svc.SureSummonCaptive(ctx, p, CityRef{CityID: 99}, heroID, city, inv)
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.SureSummonCaptive(ctx, p, CityRef{CityID: 99}, heroID, city, inv)
	if err != ErrHeroNotCaptive {
		t.Fatalf("expected not captive, got %v", err)
	}
}

func TestSureSummonCaptiveCapacityFull(t *testing.T) {
	ctx := context.Background()
	svc, city, inv, p, heroID := captiveTestSetup(t)
	city.officeLevel = 1
	for i := 0; i < 1; i++ {
		if err := svc.Store.CreateHero(ctx, &Hero{
			ServerID: 1, PlayerID: 42,
			TemplateCfgID: TemplateCfgIDHotelRandom, Level: 1, Status: StatusIdle, Loyalty: 70,
		}); err != nil {
			t.Fatal(err)
		}
	}
	_, err := svc.SureSummonCaptive(ctx, p, CityRef{CityID: 99}, heroID, city, inv)
	if err != ErrHotelCapacityFull {
		t.Fatalf("expected capacity full, got %v", err)
	}
}

func TestReleaseCaptiveClearsRecord(t *testing.T) {
	ctx := context.Background()
	svc, _, _, p, heroID := captiveTestSetup(t)
	if err := svc.ReleaseCaptive(ctx, p, 99, heroID); err != nil {
		t.Fatal(err)
	}
	h, err := svc.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil || h != nil {
		t.Fatalf("hero row should be deleted: %v", h)
	}
	rec, err := svc.CaptiveStore.GetCaptive(ctx, p.ServerID, heroID)
	if err != nil || rec != nil {
		t.Fatalf("captive meta should be gone: %v", rec)
	}
}
