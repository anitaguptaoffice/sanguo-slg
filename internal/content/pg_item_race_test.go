package content

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestPGRemoveTwoStaleServicesOneBook(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	a, b := itemPGService(t, pool), itemPGService(t, pool)
	p := PlayerRef{1, time.Now().UnixNano()}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := a.GrantContext(ctx, p, RewardPackage{Items: []RewardItem{{2004, 1}}}, ""); err != nil {
		t.Fatal(err)
	}
	if err := b.LoadPlayer(ctx, p); err != nil {
		t.Fatal(err)
	}
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, s := range []*Service{a, b} {
		go func(s *Service) {
			<-start
			remaining, err := s.RemoveContext(ctx, p, 2004, 1)
			if err == nil && remaining != 0 {
				err = fmt.Errorf("remaining=%d", remaining)
			}
			if errors.Is(err, ErrInsufficientItems) {
				if qty, _ := s.Get(p, 2004); qty != 1 {
					err = fmt.Errorf("failed remove changed stale cache to %d", qty)
				}
			}
			results <- err
		}(s)
	}
	close(start)
	success := 0
	for i := 0; i < 2; i++ {
		err := <-results
		if err == nil {
			success++
		} else if !errors.Is(err, ErrInsufficientItems) {
			t.Fatal(err)
		}
	}
	if success != 1 || itemPGQuantity(t, pool, p, 2004) != 0 {
		t.Fatalf("one book reused: successes=%d", success)
	}
}

func TestPGGrantRemoveRaceAbsentZeroAndPositive(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	for _, initial := range []int32{-1, 0, 1} {
		t.Run(fmt.Sprintf("initial_%d", initial), func(t *testing.T) {
			for attempt := 0; attempt < 12; attempt++ {
				a, b := itemPGService(t, pool), itemPGService(t, pool)
				p := PlayerRef{1, time.Now().UnixNano()}
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				if initial >= 0 {
					if _, err := a.GrantContext(ctx, p, RewardPackage{Items: []RewardItem{{2004, 1}}}, ""); err != nil {
						t.Fatal(err)
					}
					if initial == 0 {
						if _, err := a.RemoveContext(ctx, p, 2004, 1); err != nil {
							t.Fatal(err)
						}
					}
				}
				if err := b.LoadPlayer(ctx, p); err != nil {
					t.Fatal(err)
				}
				var wg sync.WaitGroup
				var grantErr, debitErr error
				start := make(chan struct{})
				wg.Add(2)
				go func() {
					defer wg.Done()
					<-start
					_, grantErr = a.GrantContext(ctx, p, RewardPackage{Items: []RewardItem{{2004, 5}}}, "")
				}()
				go func() {
					defer wg.Done()
					<-start
					_, debitErr = b.RemoveContext(ctx, p, 2004, 1)
				}()
				close(start)
				wg.Wait()
				cancel()
				if grantErr != nil || (debitErr != nil && !errors.Is(debitErr, ErrInsufficientItems)) {
					t.Fatalf("grant=%v remove=%v", grantErr, debitErr)
				}
				want := int32(5)
				if initial > 0 {
					want += initial
				}
				if debitErr == nil {
					want--
				}
				if got := itemPGQuantity(t, pool, p, 2004); got != want {
					t.Fatalf("lost grant/debit: got=%d want=%d", got, want)
				}
				if initial > 0 && debitErr != nil {
					t.Fatal("existing stock disappeared")
				}
			}
		})
	}
}
