package domestic

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestPGPendingBuildConcurrentStaleHubs(t *testing.T) {
	for _, waiting := range []bool{false, true} {
		pool := productionTestPool(t)
		now := time.Unix(1700000000, 0)
		owner, c := queueCity(t, pool, 1, 1, 42, &now)
		if waiting {
			if _, err := owner.StartBuildingUpgrade(c.ID, "hall", 1); err != nil {
				t.Fatal(err)
			}
		}
		const n = 8
		hubs := make([]*Hub, n)
		states := make([]*CityState, n)
		before := make([]*CityState, n)
		for i := range hubs {
			hubs[i] = NewHub(func() time.Time { return now })
			hubs[i].UseStore(NewPGStore(queuePeerPool(t, pool)), 1, 0)
			var err error
			states[i], err = hubs[i].LoadCity(context.Background(), c.ID, c.PlayerID)
			if err != nil {
				t.Fatal(err)
			}
			before[i] = cloneCity(states[i])
		}
		start := make(chan struct{})
		errs := make([]error, n)
		var wg sync.WaitGroup
		for i := range hubs {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				_, errs[i] = hubs[i].StartBuildingUpgrade(c.ID, "farm", 2)
			}(i)
		}
		close(start)
		wg.Wait()
		success := 0
		for i, err := range errs {
			if err == nil {
				success++
			} else if !errors.Is(err, ErrInvalidUpgrade) || !reflect.DeepEqual(cloneCity(states[i]), before[i]) {
				t.Fatalf("loser %d mutated or unexpected error: %v", i, err)
			}
		}
		if success != 1 {
			t.Fatalf("waiting=%v: accepted %d duplicate submissions", waiting, success)
		}
		disk, err := owner.store.LoadCity(context.Background(), 1, c.ID, c.PlayerID)
		if err != nil {
			t.Fatal(err)
		}
		want := before[0].Wallet
		want.Sub(upCost(DefaultCatalog()[2], 2))
		if disk.Wallet != want || len(disk.BuildJobs) != len(before[0].BuildJobs)+1 {
			t.Fatal("duplicate debit or lost queue", disk)
		}
		// A fresh process must also reject the committed unfinished job.
		restarted := NewHub(func() time.Time { return now })
		restarted.UseStore(NewPGStore(queuePeerPool(t, pool)), 1, 0)
		if _, err := restarted.LoadCity(context.Background(), c.ID, c.PlayerID); err != nil {
			t.Fatal(err)
		}
		if _, err := restarted.StartBuildingUpgrade(c.ID, "farm", 2); !errors.Is(err, ErrInvalidUpgrade) {
			t.Fatal("restart accepted duplicate", err)
		}
	}
}

func TestPGPendingBuildFirstConstructionAndCompletion(t *testing.T) {
	pool := productionTestPool(t)
	now := time.Unix(1700000000, 0)
	h, c := queueCity(t, pool, 1, 1, 42, &now)
	first, err := h.StartBuildingUpgrade(c.ID, "lumber", 3)
	if err != nil {
		t.Fatal(err)
	}
	before := cloneCity(c)
	scheduled := len(h.sched.q)
	now = first.FinishAt.Add(time.Second)
	if _, err := h.StartBuildingUpgrade(c.ID, "lumber", 3); !errors.Is(err, ErrInvalidUpgrade) {
		t.Fatal("elapsed unfinished construction accepted", err)
	}
	queueUnchanged(t, pool, h, c, before, scheduled)
	if h.Tick() != 1 || c.Buildings["lumber"].Level != 1 {
		t.Fatal("first construction did not complete")
	}
	if _, err := h.StartBuildingUpgrade(c.ID, "lumber", 3); err != nil || c.BuildJobs[len(c.BuildJobs)-1].Target != 2 {
		t.Fatal("completed construction could not upgrade", err)
	}
	// Same slot in another city must not be blocked by this city's pending job.
	other, second := queueCity(t, pool, 1, 2, 42, &now)
	if _, err := other.StartBuildingUpgrade(second.ID, "lumber", 3); err != nil {
		t.Fatal("other city blocked", err)
	}
}

func TestPGPendingBuildRollbackDoesNotReserveSlot(t *testing.T) {
	pool := productionTestPool(t)
	now := time.Unix(1700000000, 0)
	h, c := queueCity(t, pool, 1, 1, 42, &now)
	before := cloneCity(c)
	productionSQL(t, pool, "ALTER TABLE city_building ADD CONSTRAINT pending_reject_save CHECK(level<0) NOT VALID")
	if _, err := h.StartBuildingUpgrade(c.ID, "farm", 2); err == nil {
		t.Fatal("expected database rollback")
	}
	queueUnchanged(t, pool, h, c, before, 0)
	productionSQL(t, pool, "ALTER TABLE city_building DROP CONSTRAINT pending_reject_save")
	if _, err := h.StartBuildingUpgrade(c.ID, "farm", 2); err != nil {
		t.Fatal("rollback incorrectly reserved slot", err)
	}
	before = cloneCity(c)
	if _, err := h.StartBuildingUpgrade(c.ID, "farm", 2); !errors.Is(err, ErrInvalidUpgrade) {
		t.Fatal("committed job failed to reserve slot", err)
	}
	queueUnchanged(t, pool, h, c, before, 1)
}
