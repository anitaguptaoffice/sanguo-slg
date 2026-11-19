package domestic

import (
	"context"
	"testing"
	"time"
)

func TestProductionFieldBonusStacksOnBuildings(t *testing.T) {
	start := time.Unix(1700000000, 0)
	c := fractionCity(start)
	settleProductionWithBonus(c, DefaultCatalog(), start.Add(time.Hour), [4]int64{20, 10, 0, 0})
	// Base rates: food 252/h, wood 105/h, stone 84/h, iron 63/h.
	want := Resources{302, 115, 84, 63} // 252*1.2=302, 105*1.1=115, others unchanged.
	if c.Wallet != want {
		t.Fatalf("wallet=%+v want=%+v", c.Wallet, want)
	}
}

func TestHubSettleUsesFieldBonusProvider(t *testing.T) {
	start := time.Unix(1700000000, 0)
	h := NewHub(func() time.Time { return start })
	c := fractionCity(start)
	h.RegisterCity(c)
	h.UseFieldBonus(func(_ context.Context, sid int32, cityID int64) [4]int64 {
		if cityID != 1 {
			t.Fatalf("provider got server=%d city=%d", sid, cityID)
		}
		return [4]int64{50, 0, 0, 0}
	})
	h.now = func() time.Time { return start.Add(time.Hour) }
	if _, err := h.SettleCity(context.Background(), 1); err != nil {
		t.Fatal(err)
	}
	if c.Wallet.Food != 378 { // 252 * 1.5
		t.Fatalf("food=%d want=378", c.Wallet.Food)
	}
}
