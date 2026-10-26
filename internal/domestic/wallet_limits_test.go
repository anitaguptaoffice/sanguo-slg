package domestic

import (
	"context"
	"math"
	"sync"
	"testing"
	"time"
)

func TestProductionIntegerPrecision(t *testing.T) {
	now := time.Unix(1700000000, 0)
	for _, balance := range []int64{math.MaxInt64, 1<<53 + 1, 100000, 49999} {
		for _, elapsed := range []time.Duration{0, time.Hour} {
			c := &CityState{Wallet: Resources{balance, balance, balance, balance}, LastSettleAt: now, Buildings: map[string]*BuildingInstance{"farm": {2, 1}}}
			settleProduction(c, DefaultCatalog(), now.Add(elapsed))
			want := balance
			if balance < 50000 && elapsed > 0 {
				want = 50000
			}
			if c.Wallet.Food != want || c.Wallet.Wood != balance || c.Wallet.Stone != balance || c.Wallet.Iron != balance {
				t.Fatalf("balance=%d elapsed=%v got=%+v", balance, elapsed, c.Wallet)
			}
		}
	}
}

func TestSnapshotCityConcurrent(t *testing.T) {
	h := NewHub(nil)
	if err := h.RegisterCity(&CityState{ID: 1, Wallet: Resources{Food: 1000}, Buildings: map[string]*BuildingInstance{"hall": {1, 1}}, BuildJobs: []*BuildJob{{ID: 1}}}); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			_, err := h.WithWallet(context.Background(), 1, func(w Resources) (Resources, error) { w.Food--; return w, nil })
			if err != nil {
				t.Error(err)
			}
		}()
		go func() {
			defer wg.Done()
			c, err := h.SnapshotCity(1)
			if err != nil {
				t.Error(err)
				return
			}
			c.Wallet.Food = 0
			c.Buildings["hall"].Level = 99
			c.BuildJobs[0].ID = 99
		}()
	}
	wg.Wait()
	c, err := h.SnapshotCity(1)
	if err != nil || c.Wallet.Food != 980 || c.Buildings["hall"].Level != 1 || c.BuildJobs[0].ID != 1 {
		t.Fatal(c, err)
	}
}
