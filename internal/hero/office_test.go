package hero

import (
	"context"
	"testing"
)

type stubCityOwn struct {
	ok bool
}

func (s stubCityOwn) PlayerOwnsCity(_ context.Context, _ PlayerRef, _ int64) (bool, error) {
	return s.ok, nil
}

func TestSetAndClearCityChiefOnePerCity(t *testing.T) {
	ctx := context.Background()
	svc := NewService()
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	own := stubCityOwn{ok: true}
	cityID := int64(9001)

	h1 := &Hero{ServerID: 1, PlayerID: 42, TemplateCfgID: 1001, Status: StatusIdle, Loyalty: 80}
	h2 := &Hero{ServerID: 1, PlayerID: 42, TemplateCfgID: 1002, Status: StatusIdle, Loyalty: 50}
	if err := svc.Store.CreateHero(ctx, h1); err != nil {
		t.Fatal(err)
	}
	if err := svc.Store.CreateHero(ctx, h2); err != nil {
		t.Fatal(err)
	}

	v, err := svc.SetCityChief(ctx, p, cityID, h1.HeroID, own)
	if err != nil {
		t.Fatal(err)
	}
	if v.HeroID != h1.HeroID || v.ProductionBonus <= 0 {
		t.Fatalf("chief %+v", v)
	}
	got, _ := svc.Store.GetHero(ctx, 1, h1.HeroID)
	if got.Status != StatusCityChief {
		t.Fatalf("status %d", got.Status)
	}

	v2, err := svc.SetCityChief(ctx, p, cityID, h2.HeroID, own)
	if err != nil {
		t.Fatal(err)
	}
	if v2.HeroID != h2.HeroID {
		t.Fatalf("replace chief %+v", v2)
	}
	old, _ := svc.Store.GetHero(ctx, 1, h1.HeroID)
	if old.Status != StatusIdle {
		t.Fatalf("old chief status %d", old.Status)
	}
	chief, _ := svc.Store.FindCityChief(ctx, 1, cityID)
	if chief == nil || chief.HeroID != h2.HeroID {
		t.Fatalf("assignment %+v", chief)
	}

	if err := svc.ClearCityChief(ctx, p, cityID, own); err != nil {
		t.Fatal(err)
	}
	if err := svc.ClearCityChief(ctx, p, cityID, own); err != ErrNoCityChief {
		t.Fatalf("second clear %v", err)
	}
}

func TestSetCityChiefRejectsMarchingHero(t *testing.T) {
	ctx := context.Background()
	svc := NewService()
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	h := &Hero{ServerID: 1, PlayerID: 42, TemplateCfgID: 1003, Status: StatusMarch}
	if err := svc.Store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	_, err := svc.SetCityChief(ctx, p, 1, h.HeroID, stubCityOwn{ok: true})
	if err != ErrHeroBusy {
		t.Fatalf("err %v", err)
	}
}

func TestMustClearOfficeBeforeMarch(t *testing.T) {
	h := &Hero{Status: StatusCityChief}
	if err := MustClearOfficeBeforeMarch(h); err != ErrHeroBusy {
		t.Fatal(err)
	}
	h.Status = StatusIdle
	if err := MustClearOfficeBeforeMarch(h); err != nil {
		t.Fatal(err)
	}
}

func TestChiefLoyaltyProductionBonusStub(t *testing.T) {
	if ChiefLoyaltyProductionBonus(0) != 0 {
		t.Fatal("zero loyalty")
	}
	if ChiefLoyaltyProductionBonus(100) != 0.05 {
		t.Fatalf("cap %f", ChiefLoyaltyProductionBonus(100))
	}
}

func TestPGCityChiefAssignment(t *testing.T) {
	pool := identityStore(t).Pool
	ctx := context.Background()
	store := NewPGStore(pool)
	svc := NewService()
	svc.UseStore(store)
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	own := stubCityOwn{ok: true}
	h := &Hero{ServerID: 1, PlayerID: 42, TemplateCfgID: 1004, Status: StatusIdle, Loyalty: 60}
	if err := store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SetCityChief(ctx, p, 3001, h.HeroID, own); err != nil {
		t.Fatal(err)
	}
	svc2 := NewService()
	svc2.UseStore(store)
	view, err := svc2.GetCityChief(ctx, p, 3001, own)
	if err != nil || view.HeroID != h.HeroID {
		t.Fatalf("reload chief %+v err=%v", view, err)
	}
}
