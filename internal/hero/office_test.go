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

	h1 := &Hero{ServerID: 1, HeroID: 1, PlayerID: 42, TemplateCfgID: 1001, Status: StatusIdle, Loyalty: 80}
	h2 := &Hero{ServerID: 1, HeroID: 2, PlayerID: 42, TemplateCfgID: 1002, Status: StatusIdle, Loyalty: 50}
	if err := svc.Store.SaveHero(ctx, h1); err != nil {
		t.Fatal(err)
	}
	if err := svc.Store.SaveHero(ctx, h2); err != nil {
		t.Fatal(err)
	}

	v, err := svc.SetCityChief(ctx, p, cityID, 1, own)
	if err != nil {
		t.Fatal(err)
	}
	if v.HeroID != 1 || v.ProductionBonus <= 0 {
		t.Fatalf("chief %+v", v)
	}
	got, _ := svc.Store.GetHero(ctx, 1, 1)
	if got.Status != StatusCityChief {
		t.Fatalf("status %d", got.Status)
	}

	v2, err := svc.SetCityChief(ctx, p, cityID, 2, own)
	if err != nil {
		t.Fatal(err)
	}
	if v2.HeroID != 2 {
		t.Fatalf("replace chief %+v", v2)
	}
	old, _ := svc.Store.GetHero(ctx, 1, 1)
	if old.Status != StatusIdle {
		t.Fatalf("old chief status %d", old.Status)
	}
	chief, _ := svc.Store.FindCityChief(ctx, 1, cityID)
	if chief == nil || chief.HeroID != 2 {
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
	h := &Hero{ServerID: 1, HeroID: 3, PlayerID: 42, TemplateCfgID: 1003, Status: StatusMarch}
	if err := svc.Store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	_, err := svc.SetCityChief(ctx, p, 1, 3, stubCityOwn{ok: true})
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
	pool := openHeroTestDB(t)
	ctx := context.Background()
	applyHeroSchema(t, pool)
	store := NewPGStore(pool)
	svc := NewService()
	svc.UseStore(store)
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	own := stubCityOwn{ok: true}
	h := &Hero{ServerID: 1, HeroID: 99, PlayerID: 42, TemplateCfgID: 1004, Status: StatusIdle, Loyalty: 60}
	if err := store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SetCityChief(ctx, p, 3001, 99, own); err != nil {
		t.Fatal(err)
	}
	svc2 := NewService()
	svc2.UseStore(store)
	view, err := svc2.GetCityChief(ctx, p, 3001, own)
	if err != nil || view.HeroID != 99 {
		t.Fatalf("reload chief %+v err=%v", view, err)
	}
}
