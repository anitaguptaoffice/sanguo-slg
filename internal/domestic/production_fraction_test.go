package domestic

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"
)

func fractionCity(now time.Time) *CityState {
	return &CityState{ID: 1, LastSettleAt: now, Buildings: map[string]*BuildingInstance{
		"hall": {1, 2}, "farm": {2, 2}, "wood": {3, 1}, "stone": {4, 1}, "iron": {5, 1},
	}}
}

func TestProductionPollingPartition(t *testing.T) {
	start := time.Unix(1700000000, 0)
	for _, step := range []time.Duration{5 * time.Second, 137 * time.Millisecond} {
		once, polled := fractionCity(start), fractionCity(start)
		end := start.Add(time.Hour)
		settleProduction(once, DefaultCatalog(), end)
		for at := start.Add(step); at.Before(end); at = at.Add(step) {
			settleProduction(polled, DefaultCatalog(), at)
		}
		settleProduction(polled, DefaultCatalog(), end)
		want := Resources{252, 105, 84, 63}
		if once.Wallet != want || polled.Wallet != want {
			t.Fatalf("step=%v once=%+v polled=%+v want=%+v", step, once.Wallet, polled.Wallet, want)
		}
	}
}

func TestProductionFractionCapsAndClock(t *testing.T) {
	start := time.Unix(1700000000, 0)
	c := fractionCity(start)
	settleProduction(c, DefaultCatalog(), start.Add(5*time.Second))
	before := *c
	for _, at := range []time.Time{start, start.Add(5 * time.Second)} {
		settleProduction(c, DefaultCatalog(), at)
		if c.Wallet != before.Wallet || c.LastSettleAt != before.LastSettleAt || c.productionRemainder != before.productionRemainder {
			t.Fatal("non-forward read changed settlement")
		}
	}
	settleProduction(c, DefaultCatalog(), start.Add(48*time.Hour))
	if c.Wallet != (Resources{6048, 2520, 2016, 1512}) || !c.LastSettleAt.Equal(start.Add(48*time.Hour)) {
		t.Fatal("offline cap", c)
	}
	for _, balance := range []int64{100000, math.MaxInt64} {
		c = fractionCity(start)
		c.Wallet.Food = balance
		c.productionRemainder[0] = int64(time.Hour) - 1
		settleProduction(c, DefaultCatalog(), start.Add(time.Second))
		if c.Wallet.Food != balance || c.productionRemainder[0] != 0 {
			t.Fatal("capped credit", c)
		}
		c.Wallet.Food = 0
		settleProduction(c, DefaultCatalog(), start.Add(2*time.Second))
		if c.Wallet.Food != 0 {
			t.Fatal("banked capped production", c.Wallet)
		}
	}
	c = fractionCity(start)
	c.Wallet.Food = 99999
	settleProduction(c, DefaultCatalog(), start.Add(20*time.Second))
	if c.Wallet.Food != 100000 || c.productionRemainder[0] != 0 {
		t.Fatal("crossed cap", c)
	}
	cat := DefaultCatalog()
	cat[2] = BuildingSpec{ID: 2, ProdPerHour: math.MaxInt64}
	c = fractionCity(start)
	c.Buildings["hall"].Level, c.Buildings["farm"].Level = math.MaxInt32, math.MaxInt32
	settleProduction(c, cat, start.Add(time.Nanosecond))
	if c.Wallet.Food != whCapBase+whCapPerLvl*int64(math.MaxInt32) {
		t.Fatal("large rate", c.Wallet)
	}
}

func TestProductionFractionRateChangeAndRollback(t *testing.T) {
	now := time.Unix(1700000000, 0)
	h := NewHub(func() time.Time { return now })
	c := fractionCity(now)
	c.Buildings["farm"].Level = 1
	c.BuildJobs = []*BuildJob{{ID: 1, Slot: "farm", CfgID: 2, Target: 2, Status: QueueActive, FinishAt: now.Add(5 * time.Second)}}
	if err := h.RegisterCity(c); err != nil {
		t.Fatal(err)
	}
	now = now.Add(5 * time.Second)
	h.Tick() // Settle 126/h before switching to 252/h.
	if c.Buildings["farm"].Level != 2 {
		t.Fatal("upgrade did not finish")
	}
	before := *c
	now = now.Add(15 * time.Second)
	if _, err := h.WithWallet(context.Background(), 1, func(Resources) (Resources, error) { return Resources{}, errors.New("reject") }); err == nil {
		t.Fatal("missing rejection")
	}
	if c.Wallet != before.Wallet || c.LastSettleAt != before.LastSettleAt || c.productionRemainder != before.productionRemainder {
		t.Fatal("failed callback published carry")
	}
	if _, err := h.SettleCity(context.Background(), 1); err != nil {
		t.Fatal(err)
	}
	if c.Wallet.Food != 1 || c.productionRemainder[0] != 225*int64(time.Hour)/1000 {
		t.Fatal("rate change repriced old remainder", c)
	}
}

func TestProductionFractionMultipleProducersAndMainHall(t *testing.T) {
	now := time.Unix(1700000000, 123)
	h := NewHub(func() time.Time { return now })
	c := fractionCity(now)
	c.Buildings["farm2"] = &BuildingInstance{2, 1}
	c.BuildJobs = []*BuildJob{{ID: 1, Slot: "hall", CfgID: 1, Target: 3, Status: QueueActive, FinishAt: now.Add(5 * time.Second)}}
	if err := h.RegisterCity(c); err != nil {
		t.Fatal(err)
	}
	now = now.Add(5 * time.Second)
	h.Tick() // Old total 378/h earns 0.525; new total 396/h then earns 1.65.
	now = now.Add(15 * time.Second)
	wallet, produced, err := h.SettleCityWithProduction(context.Background(), 1)
	if err != nil || wallet.Food != 2 || produced.Food != 2 || c.productionRemainder[0] != 175*int64(time.Hour)/1000 {
		t.Fatal(wallet, produced, c.productionRemainder, err)
	}
	before := *c
	if _, err := h.RefreshWallet(context.Background(), 1); err != nil {
		t.Fatal(err)
	}
	if c.LastSettleAt != before.LastSettleAt || c.productionRemainder != before.productionRemainder {
		t.Fatal("refresh changed production")
	}
	delete(c.Buildings, "farm")
	delete(c.Buildings, "farm2")
	now = now.Add(time.Hour)
	if _, err := h.SettleCity(context.Background(), 1); err != nil {
		t.Fatal(err)
	}
	if c.Wallet.Food != 2 || c.productionRemainder[0] != before.productionRemainder[0] {
		t.Fatal("zero rate lost prior carry")
	}
}

func TestProductionInvalidNegativeWalletDoesNotAccrue(t *testing.T) {
	start := time.Unix(1700000000, 0)
	for _, invalid := range []int64{-1, math.MinInt64} {
		c := fractionCity(start)
		c.Wallet.Food = invalid
		c.productionRemainder[0] = int64(time.Hour) - 1
		before := *c
		settleProduction(c, DefaultCatalog(), start.Add(time.Hour))
		if c.Wallet != before.Wallet || c.LastSettleAt != before.LastSettleAt || c.productionRemainder != before.productionRemainder {
			t.Fatal("invalid wallet minted or lost credit", c)
		}
	}
}
