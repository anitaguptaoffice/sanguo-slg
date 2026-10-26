package hero

import (
	"context"
	"testing"
)

func TestPGIdentityPreservesExistingTransitions(t *testing.T) {
	ctx := context.Background()
	store := identityStore(t)
	svc := NewService()
	svc.UseStore(store)
	p := PlayerRef{ServerID: 1, PlayerID: 20}
	city := &stubHotelCity{hotelLevel: 3, officeLevel: 20, gold: 1000000}
	inv := &memInventory{wallet: Resources{Gold: 1000000}, items: map[int32]int32{}}
	coming, err := svc.InjectComing(ctx, p, InjectComingInput{CityID: 1, TemplateCfgID: 1001})
	if err != nil {
		t.Fatal(err)
	}
	accepted, err := svc.SureAcceptComing(ctx, p, CityRef{CityID: 1}, coming.HeroID, city)
	if err != nil || accepted.Hero.HeroID != coming.HeroID || accepted.Hero.Status != StatusIdle {
		t.Fatalf("accept: %+v %v", accepted, err)
	}
	captive, err := svc.InjectCaptive(ctx, p, InjectCaptiveInput{CityID: 1, TemplateCfgID: 1002})
	if err != nil {
		t.Fatal(err)
	}
	summoned, err := svc.SureSummonCaptive(ctx, p, CityRef{CityID: 1}, captive.HeroID, city, inv)
	if err != nil || summoned.Hero.HeroID != captive.HeroID || summoned.Hero.Status != StatusIdle {
		t.Fatalf("summon: %+v %v", summoned, err)
	}
	h, err := store.GetHero(ctx, p.ServerID, coming.HeroID)
	if err != nil || h == nil {
		t.Fatalf("reload: %+v %v", h, err)
	}
	h.Exp = 1000
	if err := store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if err := svc.SetHeroLoyalty(ctx, h, 81); err != nil {
		t.Fatal(err)
	}
	upgrade, err := svc.UpgradePlayer(ctx, p, h.HeroID)
	if err != nil || upgrade.Hero.HeroID != h.HeroID || upgrade.Hero.Level != 2 {
		t.Fatalf("upgrade: %+v %v", upgrade, err)
	}
	if _, err := svc.SetCityChief(ctx, p, 1, h.HeroID, stubCityOwn{ok: true}); err != nil {
		t.Fatal(err)
	}
	if err := svc.ClearCityChief(ctx, p, 1, stubCityOwn{ok: true}); err != nil {
		t.Fatal(err)
	}
	if err := svc.ClaimForMarch(ctx, p, h.HeroID); err != nil {
		t.Fatal(err)
	}
	if err := svc.ReleaseFromMarch(ctx, p, h.HeroID); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetHero(ctx, p.ServerID, h.HeroID)
	if err != nil || got == nil || got.Status != StatusIdle || got.Loyalty != 81 {
		t.Fatalf("final hero: %+v %v", got, err)
	}
	rows, err := store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil || len(rows) != 2 {
		t.Fatalf("transitions inserted heroes: %d %v", len(rows), err)
	}
}
