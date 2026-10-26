package domestic

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func productionTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	admin := openDomesticTestDB(t)
	schema := fmt.Sprintf("production_%d", time.Now().UnixNano())
	if _, err := admin.Exec(context.Background(), "CREATE SCHEMA "+schema); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg := admin.Config()
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
		admin.Close()
	})
	applyDomesticSchema(t, pool)
	return pool
}

func TestPGProductionCheckpointRoundTrip(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	now := time.Unix(1700000000, 123456789)
	h := NewHub(func() time.Time { return now })
	h.UseStore(NewPGStore(pool), 1, 0)
	c := fractionCity(now.Add(-time.Hour))
	c.PlayerID = 42
	seedDomesticOwner(t, pool, c)
	if err := h.RegisterCity(c); !errors.Is(err, ErrNewCityRegistrationRequired) {
		t.Fatal("legacy port", err)
	}
	if _, err := h.SnapshotCity(c.ID); !errors.Is(err, ErrCityNotFound) {
		t.Fatal("legacy published city", err)
	}
	if err := h.RegisterNewCity(ctx, c); err != nil {
		t.Fatal(err)
	}
	if !c.LastSettleAt.Equal(now) || c.Wallet.Food != 0 {
		t.Fatal("registration backdated accrual", c)
	}
	now = now.Add(5 * time.Second)
	if _, err := h.SettleCity(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	h2 := NewHub(func() time.Time { return now })
	h2.UseStore(NewPGStore(pool), 1, 0)
	loaded, err := h2.LoadCity(ctx, c.ID, c.PlayerID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Wallet != c.Wallet || loaded.productionRemainder != c.productionRemainder || !loaded.LastSettleAt.Equal(c.LastSettleAt) {
		t.Fatal("lost durable carry/submicro clock", loaded, c)
	}
	now = now.Add(10 * time.Second)
	if _, err := h2.SettleCity(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	if loaded.Wallet.Food != 1 || loaded.productionRemainder[0] != int64(time.Hour)/20 {
		t.Fatal("restart production", loaded)
	}
	before := *loaded
	if _, err := pool.Exec(ctx, "ALTER TABLE city_building ADD CONSTRAINT reject_save CHECK (level<0) NOT VALID"); err != nil {
		t.Fatal(err)
	}
	now = now.Add(15 * time.Second)
	if _, err := h2.SettleCity(ctx, c.ID); err == nil {
		t.Fatal("expected SQL rollback")
	}
	disk, err := h2.store.LoadCity(ctx, 1, c.ID, c.PlayerID)
	if err != nil {
		t.Fatal(err)
	}
	for _, got := range []*CityState{loaded, disk} {
		if got.Wallet != before.Wallet || got.productionRemainder != before.productionRemainder || !got.LastSettleAt.Equal(before.LastSettleAt) {
			t.Fatal("failure published checkpoint", got, before)
		}
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE city_building DROP CONSTRAINT reject_save"); err != nil {
		t.Fatal(err)
	}
	if _, err := h2.SettleCity(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	if loaded.Wallet.Food != 2 || loaded.productionRemainder[0] != int64(time.Hour)/10 {
		t.Fatal("retry doubled/lost credit", loaded)
	}
}
