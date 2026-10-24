package hero

import (
	"context"
	"testing"
)

func comingTestSetup(t *testing.T) (*Service, *stubHotelCity, PlayerRef, int64) {
	svc := NewService()
	city := &stubHotelCity{hotelLevel: 1, officeLevel: 3, gold: 1_000_000}
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	ctx := context.Background()
	h, err := svc.InjectComing(ctx, p, InjectComingInput{
		CityID: 99, DisplayName: "来投将", Level: 12,
		Force: 75, Intel: 65, Politics: 55, Command: 60,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc, city, p, h.HeroID
}

func TestSureAcceptComingSuccess(t *testing.T) {
	ctx := context.Background()
	svc, city, p, heroID := comingTestSetup(t)

	try, err := svc.TryAcceptComing(ctx, p, 99, heroID)
	if err != nil || try.Summary == "" {
		t.Fatalf("try: %v summary=%q", err, try.Summary)
	}
	res, err := svc.SureAcceptComing(ctx, p, CityRef{CityID: 99}, heroID, city)
	if err != nil {
		t.Fatal(err)
	}
	if res.Hero.Status != StatusIdle {
		t.Fatalf("unexpected status: %d", res.Hero.Status)
	}
	rec, err := svc.ComingStore.GetComing(ctx, p.ServerID, heroID)
	if err != nil || rec != nil {
		t.Fatalf("coming meta should be cleared: %v %v", rec, err)
	}
	list, err := svc.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil || len(list) != 1 || list[0].Status != StatusIdle {
		t.Fatalf("owned list: %v", list)
	}
}

func TestSureAcceptComingCapacityFull(t *testing.T) {
	ctx := context.Background()
	svc, city, p, heroID := comingTestSetup(t)
	city.officeLevel = 1
	_ = svc.Store.SaveHero(ctx, &Hero{
		ServerID: 1, HeroID: 200, PlayerID: 42,
		TemplateCfgID: TemplateCfgIDHotelRandom, Level: 1, Status: StatusIdle, Loyalty: 70,
	})
	_, err := svc.SureAcceptComing(ctx, p, CityRef{CityID: 99}, heroID, city)
	if err != ErrHotelCapacityFull {
		t.Fatalf("expected capacity full, got %v", err)
	}
}

func TestSureAcceptComingNotComing(t *testing.T) {
	ctx := context.Background()
	svc, city, p, heroID := comingTestSetup(t)
	_, err := svc.SureAcceptComing(ctx, p, CityRef{CityID: 99}, heroID, city)
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.SureAcceptComing(ctx, p, CityRef{CityID: 99}, heroID, city)
	if err != ErrHeroNotComing {
		t.Fatalf("expected not coming, got %v", err)
	}
}

func TestRejectComingClearsRecord(t *testing.T) {
	ctx := context.Background()
	svc, _, p, heroID := comingTestSetup(t)
	if err := svc.RejectComing(ctx, p, 99, heroID); err != nil {
		t.Fatal(err)
	}
	h, err := svc.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil || h != nil {
		t.Fatalf("hero row should be deleted: %v", h)
	}
	rec, err := svc.ComingStore.GetComing(ctx, p.ServerID, heroID)
	if err != nil || rec != nil {
		t.Fatalf("coming meta should be gone: %v", rec)
	}
}
