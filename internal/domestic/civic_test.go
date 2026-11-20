package domestic

import (
	"context"
	"testing"
	"time"
)

func civicHub(t *testing.T) (*Hub, *CityState, *time.Time) {
	t.Helper()
	now := time.Unix(1798000000, 0)
	h := NewHub(func() time.Time { return now })
	city := &CityState{ID: 1, PlayerID: 7, Name: "主城", Buildings: map[string]*BuildingInstance{
		"hall":  {CfgID: 1, Level: 3},
		"farm":  {CfgID: 2, Level: 2},
		"house": {CfgID: 20, Level: 2},
	}, Wallet: Resources{10000, 10000, 10000, 10000}}
	if err := h.RegisterCity(city); err != nil {
		t.Fatal(err)
	}
	return h, city, &now
}

func TestCivicSettlementGrowsPopulationAndTaxesGold(t *testing.T) {
	h, city, now := civicHub(t)
	h.UseTroopCount(func(int64) int64 { return 100 })
	city.Civic = CivicState{Population: 1000, Morale: 80, TaxRate: 10, WorkRate: 100, LastCivicAt: *now}
	*now = now.Add(time.Hour)
	view, err := h.Civic(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if view.Population <= 1000 || view.Population > view.PopulationCap {
		t.Fatalf("population: %+v", view)
	}
	if view.Gold < 10 || view.Gold > 12 {
		t.Fatalf("gold: %d", view.Gold)
	}
	if city.Wallet.Food != 9990 {
		t.Fatalf("food upkeep: %d", city.Wallet.Food)
	}
	if view.FoodUpkeepHour != 10 || view.GoldPerHour != view.Population*10/1000 {
		t.Fatalf("rates: %+v", view)
	}
	if view.EffectiveWork != 100 {
		t.Fatalf("effective work: %+v", view)
	}
}

func TestCivicWorkRateLimitedByPopulation(t *testing.T) {
	_, city, _ := civicHub(t)
	city.Civic = CivicState{Population: 50, Morale: 80, TaxRate: 10, WorkRate: 100, LastCivicAt: time.Unix(1798000000, 0)}
	if got := EffectiveWorkRate(city); got != 50 {
		t.Fatalf("two farm levels need 100 workers, got %d", got)
	}
	city.Buildings["lumber"] = &BuildingInstance{CfgID: 3, Level: 4}
	if got := EffectiveWorkRate(city); got != 16 {
		t.Fatalf("six production levels need 300 workers, got %d", got)
	}
}

func TestCivicDecrees(t *testing.T) {
	h, _, _ := civicHub(t)
	ctx := context.Background()
	if _, err := h.ApplyCivicDecree(ctx, 1, DecreeSetTax, 31, ""); err != ErrCivicInvalid {
		t.Fatalf("tax over 30: %v", err)
	}
	view, err := h.ApplyCivicDecree(ctx, 1, DecreeSetTax, 20, "")
	if err != nil || view.TaxRate != 20 {
		t.Fatalf("tax: %+v %v", view, err)
	}
	if _, err = h.ApplyCivicDecree(ctx, 1, DecreeSetWorkRate, 10, ""); err != ErrCivicInvalid {
		t.Fatalf("work rate under 20: %v", err)
	}
	if view, err = h.ApplyCivicDecree(ctx, 1, DecreeSetWorkRate, 60, ""); err != nil || view.WorkRate != 60 {
		t.Fatalf("work rate: %+v %v", view, err)
	}
	if _, err = h.ApplyCivicDecree(ctx, 1, DecreePacify, 0, ""); err != ErrInsufficientGold {
		t.Fatalf("pacify without gold: %v", err)
	}
	h.cities[1].Gold = 200
	if view, err = h.ApplyCivicDecree(ctx, 1, DecreePacify, 0, ""); err != nil || view.Gold != 100 || view.Morale < 80 {
		t.Fatalf("pacify: %+v %v", view, err)
	}
	food, wood := h.cities[1].Wallet.Food, h.cities[1].Wallet.Wood
	if view, err = h.ApplyCivicDecree(ctx, 1, DecreeLevy, 0, ""); err != nil ||
		h.cities[1].Wallet.Food <= food || h.cities[1].Wallet.Wood <= wood || view.Morale > 100 {
		t.Fatalf("levy: %+v %v", view, err)
	}
	if _, err = h.ApplyCivicDecree(ctx, 1, DecreeRename, 0, "  "); err != ErrCivicInvalid {
		t.Fatalf("empty rename: %v", err)
	}
	if view, err = h.ApplyCivicDecree(ctx, 1, DecreeRename, 0, "新野"); err != nil || view.Name != "新野" {
		t.Fatalf("rename: %+v %v", view, err)
	}
}
