package domestic

import (
	"testing"
	"time"
)

func TestStorehouseCapacityAndProtection(t *testing.T) {
	if got := StorehouseCapacityBonus(0); got != 0 {
		t.Fatalf("level 0 bonus = %d", got)
	}
	if got := StorehouseCapacityBonus(3); got != 3*4*5000 {
		t.Fatalf("level 3 bonus = %d", got)
	}
	if got := StorehouseProtectionPercent(1); got != 4 {
		t.Fatalf("level 1 protection = %d", got)
	}
	if got := StorehouseProtectionPercent(20); got != 60 {
		t.Fatalf("protection cap = %d", got)
	}
	protected := StorehouseProtected(Resources{Food: 1000, Wood: 500, Stone: 250, Iron: 100}, 5)
	if protected != (Resources{Food: 200, Wood: 100, Stone: 50, Iron: 20}) {
		t.Fatalf("protected = %+v", protected)
	}
	city := &CityState{Buildings: map[string]*BuildingInstance{
		"market":    {CfgID: 12, Level: 3},
		"warehouse": {CfgID: 16, Level: 4},
	}}
	if StorehouseLevel(city) != 4 {
		t.Fatalf("warehouse level = %d", StorehouseLevel(city))
	}
	bonus := int64(4) * 5 * 5000
	if got := int64(whCapBase) + whCapPerLvl*3 + StorehouseCapacityBonus(4); got != int64(whCapBase)+whCapPerLvl*3+bonus {
		t.Fatalf("cap = %d", got)
	}
}

func TestMarketPriceAndDistance(t *testing.T) {
	if got := MarketBuyCost(100, 100); got != 10 {
		t.Fatalf("buy 100 food = %d", got)
	}
	if got := MarketBuyCost(1, 100); got != 1 {
		t.Fatalf("buy rounding = %d", got)
	}
	if got := MarketSellGain(9, 100); got != 0 {
		t.Fatalf("sell rounding = %d", got)
	}
	if got := MarketSellGain(100, 250); got != 25 {
		t.Fatalf("sell iron = %d", got)
	}
	if got := MarketDistance(60, 60, 60, 60); got != 1 {
		t.Fatalf("same cell distance = %d", got)
	}
	if got := MarketDistance(60, 60, 70, 60); got != 10 {
		t.Fatalf("distance = %d", got)
	}
	if got := MarketDeliverSeconds(10); got != 167 {
		t.Fatalf("delivery seconds = %d", got)
	}
}

func TestStorehouseCapacityRaisesProductionCap(t *testing.T) {
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	cat := map[int32]BuildingSpec{
		1:  {ID: 1},
		2:  {ID: 2, ProdRes: 0, ProdPerHour: 1_000_000},
		16: {ID: 16},
	}
	base := func() *CityState {
		return &CityState{
			LastSettleAt: now.Add(-time.Hour),
			Buildings: map[string]*BuildingInstance{
				"hall": {CfgID: 1, Level: 1},
				"farm": {CfgID: 2, Level: 1},
			},
		}
	}
	plain := base()
	settleProduction(plain, cat, now)
	if plain.Wallet.Food != int64(whCapBase)+whCapPerLvl {
		t.Fatalf("plain cap = %d", plain.Wallet.Food)
	}
	withStore := base()
	withStore.Buildings["warehouse"] = &BuildingInstance{CfgID: 16, Level: 2}
	settleProduction(withStore, cat, now)
	want := int64(whCapBase) + whCapPerLvl + StorehouseCapacityBonus(2)
	if withStore.Wallet.Food != want {
		t.Fatalf("storehouse cap = %d, want %d", withStore.Wallet.Food, want)
	}
}
