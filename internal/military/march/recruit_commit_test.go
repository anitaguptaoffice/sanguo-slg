package march

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestRecruitWithWalletFailureDoesNotPublish(t *testing.T) {
	clk := &stepClock{t: time.Unix(0, 0)}
	h := NewHub(clk.Now)
	original := Resources{Food: 999, Wood: 888}
	h.EnsureCity(&CityState{ID: 42, Wallet: original})
	req := RecruitRequest{CityID: 42, UnitCfgID: 1, Count: 2}
	failed := errors.New("commit failed")
	if _, err := h.RecruitWithWallet(req, func(Resources) (Resources, error) { return Resources{}, failed }); !errors.Is(err, failed) {
		t.Fatal(err)
	}
	c := h.SnapshotCity(42)
	if c.Wallet != original || len(c.RecruitJobs) != 0 || len(c.Troops) != 0 || c.nextJobID != 0 {
		t.Fatalf("failed commit changed city: %+v", c)
	}
	clk.Advance(24 * time.Hour)
	if n := h.Tick(); n != 0 {
		t.Fatalf("failed job scheduled %d events", n)
	}
	after := Resources{Food: 123, Wood: 456}
	res, err := h.RecruitWithWallet(req, func(cost Resources) (Resources, error) {
		want := h.catalog[1].RecruitCost.Scale(2)
		if cost != want {
			t.Fatalf("cost %+v want %+v", cost, want)
		}
		return after, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.JobID != 1 || res.Wallet != after {
		t.Fatalf("result %+v", res)
	}
	clk.Advance(res.FinishAt.Sub(clk.Now()))
	if h.Tick() != 1 || h.Tick() != 0 {
		t.Fatal("completion must run once")
	}
	if got := h.SnapshotCity(42).Troops[1]; got != 2 {
		t.Fatalf("troops %d", got)
	}
}

func TestRecruitWithWalletValidatesBeforeCommit(t *testing.T) {
	h := NewHub(nil)
	h.EnsureCity(&CityState{ID: 42})
	calls := 0
	commit := func(Resources) (Resources, error) { calls++; return Resources{}, nil }
	for _, tc := range []struct {
		req  RecruitRequest
		want error
	}{
		{RecruitRequest{CityID: 99, UnitCfgID: 1, Count: 1}, ErrCityNotFound},
		{RecruitRequest{CityID: 42, UnitCfgID: 1, Count: 0}, ErrInvalidCount},
		{RecruitRequest{CityID: 42, UnitCfgID: 999, Count: 1}, ErrUnknownUnit},
	} {
		if _, err := h.RecruitWithWallet(tc.req, commit); !errors.Is(err, tc.want) {
			t.Fatalf("got %v want %v", err, tc.want)
		}
	}
	if calls != 0 {
		t.Fatalf("invalid request committed %d times", calls)
	}
	if _, err := h.RecruitWithWallet(RecruitRequest{CityID: 42, UnitCfgID: 1, Count: 1}, nil); !errors.Is(err, ErrWalletCommitRequired) {
		t.Fatal(err)
	}
}

func TestRecruitWithWalletConcurrentAuthoritativeBalance(t *testing.T) {
	clk := &stepClock{t: time.Unix(0, 0)}
	h := NewHub(clk.Now)
	h.EnsureCity(&CityState{ID: 42}) // Deliberately stale zero military wallet.
	balance := h.catalog[1].RecruitCost.Scale(1)
	var wins atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := h.RecruitWithWallet(RecruitRequest{CityID: 42, UnitCfgID: 1, Count: 1}, func(cost Resources) (Resources, error) {
				if !balance.Sub(cost) {
					return Resources{}, ErrInsufficientRes
				}
				return balance, nil
			})
			if err == nil {
				wins.Add(1)
			} else if !errors.Is(err, ErrInsufficientRes) {
				t.Errorf("recruit: %v", err)
			}
			h.SnapshotCity(42)
		}()
	}
	wg.Wait()
	c := h.SnapshotCity(42)
	if wins.Load() != 1 || balance != (Resources{}) || len(c.RecruitJobs) != 1 || c.nextJobID != 1 {
		t.Fatalf("wins %d balance %+v city %+v", wins.Load(), balance, c)
	}
	clk.Advance(24 * time.Hour)
	if h.Tick() != 1 || h.Tick() != 0 || h.SnapshotCity(42).Troops[1] != 1 {
		t.Fatal("free or duplicate troops")
	}
}

func TestRecruitWithWalletPreservesFIFO(t *testing.T) {
	clk := &stepClock{t: time.Unix(0, 0)}
	h := NewHub(clk.Now)
	h.EnsureCity(&CityState{ID: 42})
	wallet := h.catalog[1].RecruitCost.Scale(2)
	commit := func(cost Resources) (Resources, error) {
		if !wallet.Sub(cost) {
			return Resources{}, ErrInsufficientRes
		}
		return wallet, nil
	}
	req := RecruitRequest{CityID: 42, UnitCfgID: 1, Count: 1}
	first, err := h.RecruitWithWallet(req, commit)
	if err != nil {
		t.Fatal(err)
	}
	second, err := h.RecruitWithWallet(req, commit)
	if err != nil {
		t.Fatal(err)
	}
	if !first.InProgress || second.InProgress || !second.FinishAt.After(first.FinishAt) {
		t.Fatalf("FIFO results %+v %+v", first, second)
	}
	clk.Advance(first.FinishAt.Sub(clk.Now()))
	if h.Tick() != 1 || h.SnapshotCity(42).Troops[1] != 1 {
		t.Fatal("first completion")
	}
	clk.Advance(second.FinishAt.Sub(clk.Now()))
	if h.Tick() != 1 || h.SnapshotCity(42).Troops[1] != 2 {
		t.Fatal("second completion")
	}
}

func TestEnsureCityAndSnapshotsAreIsolated(t *testing.T) {
	h := NewHub(nil)
	input := &CityState{ID: 42, PlayerID: 7, Wallet: Resources{Food: 50}, Troops: map[int32]int32{1: 3}, RecruitJobs: []*RecruitJob{{ID: 1, Count: 2}}}
	first := h.EnsureCity(input)
	input.Troops[1] = 90
	input.RecruitJobs[0].Count = 90
	first.Troops[1] = 80
	first.RecruitJobs[0].Count = 80
	h.EnsureCity(&CityState{ID: 42, PlayerID: 99, Wallet: Resources{Food: 1000}})
	c := h.SnapshotCity(42)
	if c.PlayerID != 7 || c.Wallet.Food != 50 || c.Troops[1] != 3 || c.RecruitJobs[0].Count != 2 {
		t.Fatalf("city overwritten or aliased: %+v", c)
	}
	c.Troops[1] = 70
	c.RecruitJobs[0].Count = 70
	if h.SnapshotCity(42).Troops[1] != 3 || h.SnapshotCity(42).RecruitJobs[0].Count != 2 {
		t.Fatal("snapshot aliases state")
	}
	if h.EnsureCity(nil) != nil || h.SnapshotCity(99) != nil {
		t.Fatal("missing city")
	}
}

func TestRecruitCommitFailureConcurrentCompletion(t *testing.T) {
	clk := &stepClock{t: time.Unix(0, 0)}
	h := NewHub(clk.Now)
	h.EnsureCity(&CityState{ID: 42})
	req := RecruitRequest{CityID: 42, UnitCfgID: 1, Count: 1}
	first, err := h.RecruitWithWallet(req, func(Resources) (Resources, error) { return Resources{}, nil })
	if err != nil {
		t.Fatal(err)
	}
	clk.Advance(first.FinishAt.Sub(clk.Now()))
	entered, release, done := make(chan struct{}), make(chan struct{}), make(chan error, 1)
	failed := errors.New("wallet canceled")
	go func() {
		_, err := h.RecruitWithWallet(req, func(Resources) (Resources, error) { close(entered); <-release; return Resources{}, failed })
		done <- err
	}()
	<-entered
	ticked := make(chan int, 1)
	go func() { ticked <- h.Tick() }()
	close(release)
	if err := <-done; !errors.Is(err, failed) {
		t.Fatal(err)
	}
	if n := <-ticked; n != 1 {
		t.Fatalf("completion events %d", n)
	}
	c := h.SnapshotCity(42)
	if len(c.RecruitJobs) != 1 || c.nextJobID != 1 || c.Troops[1] != 1 || c.RecruitJobs[0].Status != QueueDone {
		t.Fatalf("failed commit leaked alongside completion: %+v", c)
	}
	if h.Tick() != 0 {
		t.Fatal("failed job scheduled")
	}
}
