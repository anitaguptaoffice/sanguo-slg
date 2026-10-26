package content

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestGrantContextCanceledAndWaitingForMutex(t *testing.T) {
	for _, waiting := range []bool{false, true} {
		svc := testService(t)
		p := PlayerRef{ServerID: 1, PlayerID: 77}
		pkg := RewardPackage{Resources: map[string]int64{"food": 3}, Items: []RewardItem{{ItemCfgID: 2004, Qty: 1}}}
		ctx, cancel := context.WithTimeout(context.Background(), 40*time.Millisecond)
		want := context.Canceled
		if waiting {
			svc.mu.Lock()
			want = context.DeadlineExceeded
		} else {
			cancel()
		}
		done := make(chan error, 1)
		go func() { _, err := svc.GrantContext(ctx, p, pkg, "fixed"); done <- err }()
		select {
		case err := <-done:
			if !errors.Is(err, want) {
				t.Errorf("waiting=%v: got %v, want %v", waiting, err, want)
			}
		case <-time.After(time.Second):
			t.Error("grant did not stop while the mutex was held")
		}
		cancel()
		if waiting {
			svc.mu.Unlock()
		}
		// Release must not wake a detached grant that mutates after returning.
		svc.mu.Lock()
		if len(svc.bags)+len(svc.wallets)+len(svc.idempotency)+len(svc.grantSeq) != 0 {
			t.Error("canceled grant mutated service state")
		}
		svc.mu.Unlock()
		first, err := svc.GrantContext(context.Background(), p, pkg, "fixed")
		if err != nil || first.Duplicate || first.Wallet.Food != 3 {
			t.Fatalf("retry: %+v %v", first, err)
		}
		dup, err := svc.Grant(p, pkg, "fixed")
		if err != nil || !dup.Duplicate || dup.GrantID != first.GrantID || svc.Wallet(p).Food != 3 {
			t.Fatalf("duplicate: %+v %v", dup, err)
		}
	}
}

type legacyContextStore struct {
	Store
	calls int
}

func (s *legacyContextStore) NextGrantID(context.Context, int32) (int64, error) {
	s.calls++
	return int64(s.calls), nil
}

func TestGrantContextRejectsCancelableLegacyStore(t *testing.T) {
	svc := testService(t)
	store := &legacyContextStore{}
	svc.UseStore(store)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	p := PlayerRef{ServerID: 1, PlayerID: 78}
	if _, err := svc.GrantContext(ctx, p, RewardPackage{}, ""); !errors.Is(err, ErrGrantContextUnsupported) {
		t.Fatalf("legacy cancelable grant: %v", err)
	}
	if store.calls != 0 || len(svc.bags)+len(svc.wallets)+len(svc.idempotency) != 0 {
		t.Fatal("unsupported grant mutated state")
	}
	if _, err := svc.Grant(p, RewardPackage{}, ""); err != nil || store.calls != 1 {
		t.Fatalf("legacy background compatibility: %v calls=%d", err, store.calls)
	}
}

type contextOutcomeStore struct {
	Store
	finish func() (GrantResult, error)
}

func (s contextOutcomeStore) grantAtomic(context.Context, PlayerRef, RewardPackage, string, *Catalog) (GrantResult, error) {
	return s.finish()
}

func TestGrantContextPreservesCommitOutcome(t *testing.T) {
	uncertain := errors.New("commit outcome unknown")
	for _, commitErr := range []error{nil, uncertain} {
		svc := testService(t)
		ctx, cancel := context.WithCancel(context.Background())
		svc.UseStore(contextOutcomeStore{finish: func() (GrantResult, error) {
			cancel() // Cancellation races the completed commit result.
			return GrantResult{GrantID: 9, Wallet: ResourceWallet{Food: 3}}, commitErr
		}})
		p := PlayerRef{ServerID: 1, PlayerID: 79}
		got, err := svc.GrantContext(ctx, p, RewardPackage{}, "fixed")
		if !errors.Is(err, commitErr) {
			t.Fatalf("commit result replaced: %v", err)
		}
		if commitErr == nil && (got.GrantID != 9 || svc.Wallet(p).Food != 3) {
			t.Fatal("confirmed commit was not published")
		}
		if commitErr != nil && len(svc.bags)+len(svc.wallets)+len(svc.idempotency) != 0 {
			t.Fatal("uncertain commit published partial cache")
		}
	}
}
