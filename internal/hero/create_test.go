package hero

import (
	"context"
	"errors"
	"sync"
	"testing"
)

func TestMemCreateHeroIdentity(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	const count = 40
	var wg sync.WaitGroup
	ids := make(chan int64, count)
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			h := &Hero{ServerID: int32(i%2 + 1), PlayerID: int64(i + 1)}
			if err := store.CreateHero(ctx, h); err != nil {
				t.Error(err)
				return
			}
			ids <- h.HeroID
		}(i)
	}
	wg.Wait()
	close(ids)
	seen := map[int64]bool{}
	for id := range ids {
		if id <= 0 || seen[id] {
			t.Fatalf("invalid or reused ID %d", id)
		}
		seen[id] = true
	}
	if len(seen) != count {
		t.Fatalf("created %d heroes", len(seen))
	}
	h := &Hero{ServerID: 1}
	if err := store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if err := store.CreateHero(ctx, h); !errors.Is(err, ErrHeroIdentity) {
		t.Fatalf("explicit ID accepted: %v", err)
	}
	if err := store.DeleteHero(ctx, h.ServerID, h.HeroID); err != nil {
		t.Fatal(err)
	}
	next := &Hero{ServerID: 1}
	if err := store.CreateHero(ctx, next); err != nil || next.HeroID <= h.HeroID {
		t.Fatalf("deleted ID reused: %+v %v", next, err)
	}
}

func TestMemCreateCollisionDoesNotOverwrite(t *testing.T) {
	store := NewMemStore()
	// Explicit historical/corrupt allocator fixture, never a production creation API.
	store.heroes[heroKey{1, 1}] = &Hero{ServerID: 1, HeroID: 1, PlayerID: 99}
	h := &Hero{ServerID: 1, PlayerID: 100}
	if err := store.CreateHero(context.Background(), h); !errors.Is(err, ErrHeroIdentity) {
		t.Fatalf("collision: %v", err)
	}
	if h.HeroID != 0 || store.heroes[heroKey{1, 1}].PlayerID != 99 {
		t.Fatal("collision assigned identity or changed existing owner")
	}
}
