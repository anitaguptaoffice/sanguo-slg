package content

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestPGAbsoluteWritesFailBeforeMutation(t *testing.T) {
	s := testService(t)
	p := PlayerRef{1, 83}
	if _, err := s.Add(p, 2004, 3); err != nil {
		t.Fatal(err)
	}
	// A nil pool proves these paths cannot reach the database, even to inspect it.
	store := NewPGStore(nil)
	s.UseStore(store)
	for _, qty := range []int32{-1, 0, 1, 4} {
		if _, err := s.Add(p, 2004, qty); !errors.Is(err, ErrOfflineStackWrite) {
			t.Fatalf("Add(%d): %v", qty, err)
		}
		if err := s.Set(p, 2004, qty); !errors.Is(err, ErrOfflineStackWrite) {
			t.Fatalf("Set(%d): %v", qty, err)
		}
		if err := store.SaveStack(context.Background(), p, 2004, qty); !errors.Is(err, ErrOfflineStackWrite) {
			t.Fatalf("SaveStack(%d): %v", qty, err)
		}
	}
	if got, _ := s.Get(p, 2004); got != 3 {
		t.Fatalf("rejected writers changed cache to %d", got)
	}
}

func TestRemoveContextWaitIsBounded(t *testing.T) {
	s := testService(t)
	p := PlayerRef{1, 84}
	if _, err := s.Add(p, 2004, 1); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	start := time.Now()
	_, err := s.RemoveContext(ctx, p, 2004, 1)
	cancel()
	s.mu.Unlock()
	if !errors.Is(err, context.DeadlineExceeded) || time.Since(start) > time.Second {
		t.Fatalf("blocked remove: %v after %s", err, time.Since(start))
	}
	if got, _ := s.Get(p, 2004); got != 1 {
		t.Fatal("canceled remove changed cache")
	}
}

func TestEmptyBagReadersDoNotRepopulateInvalidatedCache(t *testing.T) {
	s := testService(t)
	p := PlayerRef{1, 85}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if got := s.List(p); got == nil || len(got) != 0 {
				t.Errorf("empty bag representation changed: %v", got)
			}
			if qty, err := s.Get(p, 2004); err != nil || qty != 0 {
				t.Errorf("empty stock: %d %v", qty, err)
			}
		}()
	}
	wg.Wait()
	if len(s.bags) != 0 {
		t.Fatal("readers created cache entries under shared locks")
	}
}
