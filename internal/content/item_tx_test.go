package content

import (
	"context"
	"errors"
	"math"
	"reflect"
	"testing"
	"time"
)

func TestItemCostsValidateAndOrder(t *testing.T) {
	s := testService(t)
	input := []Stack{{2004, 1}, {2001, 2}, {2004, 3}}
	got, err := s.itemCosts(input)
	if err != nil || !reflect.DeepEqual(got, []Stack{{2001, 2}, {2004, 4}}) || input[0].ItemCfgID != 2004 {
		t.Fatalf("ordered=%v original=%v err=%v", got, input, err)
	}
	for _, tc := range []struct {
		costs []Stack
		want  error
	}{
		{[]Stack{{2004, 0}}, ErrInvalidQuantity},
		{[]Stack{{2004, -1}}, ErrInvalidQuantity},
		{[]Stack{{2004, math.MaxInt32}, {2004, 1}}, ErrInvalidQuantity},
		{[]Stack{{987654, 1}}, ErrUnknownItem},
	} {
		if _, err := s.itemCosts(tc.costs); !errors.Is(err, tc.want) {
			t.Fatalf("costs=%v err=%v want=%v", tc.costs, err, tc.want)
		}
	}
}

func TestItemTransactionsFailClosedWithoutPG(t *testing.T) {
	s := testService(t)
	p := PlayerRef{1, 81}
	if s.SupportsItemTransactions() {
		t.Fatal("memory service claims item transactions")
	}
	if _, err := s.LoadBagInTx(context.Background(), nil, p); !errors.Is(err, ErrItemTransactionsUnsupported) {
		t.Fatalf("memory read: %v", err)
	}
	if _, err := s.DebitItemsInTx(context.Background(), nil, p, []Stack{{2004, 1}}); !errors.Is(err, ErrItemTransactionsUnsupported) {
		t.Fatalf("memory debit: %v", err)
	}
}

func TestInvalidatePlayerContextBounded(t *testing.T) {
	s := testService(t)
	p := PlayerRef{1, 82}
	if _, err := s.Grant(p, RewardPackage{Resources: map[string]int64{"food": 3}, Items: []RewardItem{{2004, 1}}}, ""); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	start := time.Now()
	err := s.InvalidatePlayerContext(ctx, p)
	cancel()
	if !errors.Is(err, context.DeadlineExceeded) || time.Since(start) > time.Second {
		t.Fatalf("blocked invalidation: %v after %s", err, time.Since(start))
	}
	if s.bags[p].Stacks[2004] != 1 || s.wallets[p].Food != 3 {
		t.Fatal("failed invalidation changed cache")
	}
	s.mu.Unlock()
	if err := s.InvalidatePlayerContext(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	if len(s.bags)+len(s.wallets) != 0 {
		t.Fatal("successful invalidation retained cache")
	}
}
