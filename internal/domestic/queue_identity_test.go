package domestic

import (
	"context"
	"testing"
	"time"
)

func TestPGQueueIdentityTwoCities(t *testing.T) {
	pool := productionTestPool(t)
	h := NewHub(func() time.Time { return time.Unix(1700000000, 0) })
	h.UseStore(NewPGStore(pool), 1, 0)
	ids := make(map[int64]bool)
	for i := int64(1); i <= 2; i++ {
		c := &CityState{ID: i, PlayerID: 42, Wallet: Resources{10000, 10000, 10000, 10000}, Buildings: map[string]*BuildingInstance{"hall": {1, 3}}}
		seedDomesticOwner(t, pool, c)
		if err := h.RegisterNewCity(context.Background(), c); err != nil {
			t.Fatal(err)
		}
		res, err := h.StartBuildingUpgrade(c.ID, "farm", 2)
		if err != nil {
			t.Fatalf("city %d: %v", i, err)
		}
		if ids[res.JobID] {
			t.Fatalf("duplicate ID %d", res.JobID)
		}
		ids[res.JobID] = true
	}
}

func TestMemoryQueueIDsRemainCityLocal(t *testing.T) {
	h := NewHub(func() time.Time { return time.Unix(1700000000, 0) })
	for i := int64(1); i <= 2; i++ {
		c := &CityState{ID: i, Wallet: Resources{10000, 10000, 10000, 10000}, Buildings: map[string]*BuildingInstance{"hall": {1, 3}}}
		if err := h.RegisterCity(c); err != nil {
			t.Fatal(err)
		}
		result, err := h.StartBuildingUpgrade(i, "farm", 2)
		if err != nil || result.JobID != 1 || result.FinishAt.Sub(h.now()) != 45*time.Second || result.Wallet.Food != 9950 {
			t.Fatal(result, err)
		}
		waiting, err := h.StartBuildingUpgrade(i, "lumber", 3)
		if err != nil || waiting.JobID != 2 || waiting.InProgress || waiting.FinishAt.Sub(result.FinishAt) != 45*time.Second {
			t.Fatal(waiting, err)
		}
	}
}
