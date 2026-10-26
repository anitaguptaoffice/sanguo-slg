package hero

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func hotelIdentityStores(t *testing.T) (*PGHotelStore, *PGHotelStore) {
	t.Helper()
	first := NewPGHotelStore(identityStore(t).Pool)
	pool, err := pgxpool.NewWithConfig(context.Background(), first.Pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return first, NewPGHotelStore(pool)
}

func TestPGHotelCandidateIDsReserveBeforePersistence(t *testing.T) {
	a, b := hotelIdentityStores(t)
	ctx := context.Background()
	const workers, batch = 8, 20
	ids, errs := make(chan int64, workers*batch), make(chan error, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			store := []*PGHotelStore{a, b}[i%2]
			for j := 0; j < batch; j++ {
				// Include identical scopes: no row is persisted to advance a MAX.
				id, err := store.NextCandidateID(ctx, int32(1+i%2), int64(1+i%3))
				if err != nil {
					errs <- err
					return
				}
				ids <- id
			}
		}(i)
	}
	wg.Wait()
	close(ids)
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	seen := map[int64]bool{}
	for id := range ids {
		if id <= 0 || seen[id] {
			t.Fatalf("nonpositive/reused candidate ID %d", id)
		}
		seen[id] = true
	}
	if len(seen) != workers*batch {
		t.Fatalf("reserved %d IDs", len(seen))
	}
	var candidates, heroID int64
	if err := a.Pool.QueryRow(ctx, "SELECT count(*) FROM city_hotel_recruit").Scan(&candidates); err != nil || candidates != 0 {
		t.Fatalf("allocation wrote candidates: %d %v", candidates, err)
	}
	if err := a.Pool.QueryRow(ctx, "SELECT nextval('player_hero_id_seq')").Scan(&heroID); err != nil || heroID != 1 {
		t.Fatalf("candidate allocation consumed hero identity: %d %v", heroID, err)
	}
}

func TestPGHotelCandidateIDsSyncRefreshDeleteReopen(t *testing.T) {
	a, b := hotelIdentityStores(t)
	ctx := context.Background()
	now := time.Unix(1_700_000_000, 0)
	seen := map[int64]bool{}
	observe := func(store *PGHotelStore, server int32, city int64) {
		t.Helper()
		rows, err := store.ListCandidates(ctx, server, city)
		if err != nil || len(rows) != 3 {
			t.Fatalf("batch: %d %v", len(rows), err)
		}
		for _, row := range rows {
			if row.CandidateID <= 0 || seen[row.CandidateID] {
				t.Fatalf("reused candidate identity %d", row.CandidateID)
			}
			seen[row.CandidateID] = true
		}
	}
	for i, store := range []*PGHotelStore{a, b} {
		server, city := int32(i+1), int64(77)
		if err := SyncHotelPool(ctx, store, rand.New(rand.NewSource(1)), server, city, 3, now); err != nil {
			t.Fatal(err)
		}
		observe(store, server, city)
		if err := RefreshHotelPool(ctx, store, rand.New(rand.NewSource(2)), server, city, 3, now); err != nil {
			t.Fatal(err)
		}
		observe(store, server, city)
		rows, err := store.ListCandidates(ctx, server, city)
		if err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			if err := store.DeleteCandidate(ctx, server, city, row.CandidateID); err != nil {
				t.Fatal(err)
			}
		}
	}
	// New pool/store: no process-local counter may be necessary for nonreuse.
	cfg := b.Pool.Config()
	b.Pool.Close()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	reopened := NewPGHotelStore(pool)
	if err := SyncHotelPool(ctx, reopened, rand.New(rand.NewSource(3)), 2, 77, 3, now); err != nil {
		t.Fatal(err)
	}
	observe(reopened, 2, 77)
	if len(seen) != 15 {
		t.Fatalf("observed IDs=%d", len(seen))
	}
}

func TestPGHotelCandidateIDsConcurrentRefreshDistinctCities(t *testing.T) {
	a, b := hotelIdentityStores(t)
	ctx := context.Background()
	ids, errs := make(chan int64, 48), make(chan error, 4)
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			store, rng := []*PGHotelStore{a, b}[i%2], rand.New(rand.NewSource(int64(i)))
			for round := 0; round < 4; round++ {
				if err := RefreshHotelPool(ctx, store, rng, 1, int64(i+1), 3, time.Unix(1_700_000_000, 0)); err != nil {
					errs <- err
					return
				}
				rows, err := store.ListCandidates(ctx, 1, int64(i+1))
				if err != nil || len(rows) != 3 {
					errs <- fmt.Errorf("refresh rows=%d err=%v", len(rows), err)
					return
				}
				for _, row := range rows {
					ids <- row.CandidateID
				}
			}
		}(i)
	}
	wg.Wait()
	close(ids)
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	seen := map[int64]bool{}
	for id := range ids {
		if id <= 0 || seen[id] {
			t.Fatalf("concurrent refresh reused candidate ID=%d", id)
		}
		seen[id] = true
	}
	if len(seen) != 48 {
		t.Fatalf("concurrent refresh reserved %d IDs", len(seen))
	}
}

func TestPGHotelCandidateIDsUnavailableFailClosed(t *testing.T) {
	for _, unavailable := range []string{"missing", "exhausted", "canceled"} {
		t.Run(unavailable, func(t *testing.T) {
			store := NewPGHotelStore(identityStore(t).Pool)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			var err error
			switch unavailable {
			case "missing":
				_, err = store.Pool.Exec(ctx, "DROP SEQUENCE city_hotel_candidate_id_seq")
			case "exhausted":
				_, err = store.Pool.Exec(ctx, "SELECT setval('city_hotel_candidate_id_seq',9223372036854775807,true)")
			case "canceled":
				cancel()
			}
			if err != nil {
				t.Fatal(err)
			}
			if id, err := store.NextCandidateID(ctx, 1, 77); err == nil || id != 0 {
				t.Fatalf("fallback allocation: id=%d err=%v", id, err)
			}
		})
	}
}
