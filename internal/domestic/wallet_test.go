package domestic

import (
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"math"
	"sync"
	"testing"
	"time"
)

func TestWalletReconcile(t *testing.T) {
	for _, tc := range []struct {
		current, local, base, want int64
		fail                       bool
	}{
		{1500, 1000, 1000, 1500, false}, {1500, 1100, 1000, 1600, false},
		{1500, 900, 1000, 1400, false}, {50, 900, 1000, 0, true},
		{math.MaxInt64, 1, 0, 0, true},
	} {
		got, err := reconcileWallet(Resources{Food: tc.current}, Resources{Food: tc.local}, Resources{Food: tc.base})
		if (err != nil) != tc.fail || (!tc.fail && got.Food != tc.want) {
			t.Fatalf("%+v: %+v %v", tc, got, err)
		}
	}
}

func TestWalletOperationRollback(t *testing.T) {
	h := NewHub(nil)
	c := &CityState{ID: 1, Wallet: Resources{Food: 1000}}
	h.RegisterCity(c)
	_, err := h.WithWallet(context.Background(), 1, func(w Resources) (Resources, error) { return Resources{}, errors.New("reject") })
	if err == nil || c.Wallet.Food != 1000 {
		t.Fatal(c.Wallet, err)
	}
}
func TestPGWalletAuthority(t *testing.T) {
	pool := openDomesticTestDB(t)
	ctx := context.Background()
	// Isolated schema permits the existing roundtrip test in the same database.
	schema := fmt.Sprintf("dom_wallet_%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	pool.Close()
	// Open an independent pool configured for this test's schema.
	cfgPool := openDomesticTestDB(t)
	cfg := cfgPool.Config()
	cfgPool.Close()
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer p.Close()
	defer func() {
		if _, err := p.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	}()
	applyDomesticSchema(t, p)
	now := time.Unix(1700000000, 0)
	h := NewHub(func() time.Time { return now })
	h.UseStore(NewPGStore(p), 1, time.Second)
	c := &CityState{ID: 1, PlayerID: 42, Wallet: Resources{Food: 1000}, LastSettleAt: now, Buildings: map[string]*BuildingInstance{"farm": {2, 1}}}
	h.RegisterCity(c)
	if _, err = p.Exec(ctx, "UPDATE player_wallet SET food=food+500"); err != nil {
		t.Fatal(err)
	}
	w, err := h.RefreshWallet(ctx, 1)
	if err != nil || w.Food != 1500 {
		t.Fatal(w, err)
	}
	now = now.Add(time.Hour)
	w, err = h.SettleCity(ctx, 1)
	if err != nil || w.Food != 1620 {
		t.Fatal(w, err)
	}
	// A failure after wallet UPDATE must roll back the wallet and cached city.
	if _, err = p.Exec(ctx, "ALTER TABLE city_building ADD CONSTRAINT reject_save CHECK (level < 0) NOT VALID"); err != nil {
		t.Fatal(err)
	}
	_, err = h.WithWallet(ctx, 1, func(w Resources) (Resources, error) { w.Food -= 100; return w, nil })
	if err == nil || c.Wallet.Food != 1620 {
		t.Fatal(c.Wallet, err)
	}
	if _, err := p.Exec(ctx, "ALTER TABLE city_building DROP CONSTRAINT reject_save"); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			if _, e := p.Exec(ctx, "UPDATE player_wallet SET food=food+1"); e != nil {
				t.Error(e)
			}
		}()
		go func() {
			defer wg.Done()
			if _, e := h.RefreshWallet(ctx, 1); e != nil {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	w, err = h.WithWallet(ctx, 1, func(w Resources) (Resources, error) { w.Food -= 100; return w, nil })
	if err != nil || w.Food != 1530 {
		t.Fatal(w, err)
	}
	loaded, err := h.store.LoadCity(ctx, 1, 1, 42)
	if err != nil || loaded.Wallet.Food != 1530 {
		t.Fatal(loaded, err)
	}
}

func TestProductionDoesNotDestroyRewardAboveCap(t *testing.T) {
	now := time.Unix(1700000000, 0)
	c := &CityState{Wallet: Resources{Food: 100000}, LastSettleAt: now, Buildings: map[string]*BuildingInstance{"farm": {2, 1}}}
	settleProduction(c, DefaultCatalog(), now.Add(time.Hour))
	if c.Wallet.Food != 100000 {
		t.Fatal(c.Wallet)
	}
	c.Wallet.Food = 49999
	settleProduction(c, DefaultCatalog(), now.Add(2*time.Hour))
	if c.Wallet.Food != 50000 {
		t.Fatal(c.Wallet)
	}
}
