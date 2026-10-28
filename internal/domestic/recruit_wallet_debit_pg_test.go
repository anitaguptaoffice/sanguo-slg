package domestic

import (
	"context"
	"errors"
	"fmt"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"math"
	"sync"
	"testing"
	"time"
)

func TestPGRecruitDebit(t *testing.T) {
	pool, b, p := recruitWalletFixture(t, true)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food,wood,iron,stone,gold) VALUES (1,1,100,90,80,70,9),(2,1,100,90,80,70,9),(1,2,-1,0,0,0,0),(2,3,100,0,0,0,0),(1,4,9223372036854775807,0,0,0,1)`); err != nil {
		t.Fatal(err)
	}
	o, a := recruitWalletBegin(t, ctx, b)
	w, err := NewRecruitWallet(ctx, b, a, p)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = w.Lock(ctx, a, 1); err == nil {
		t.Fatal("unpinned")
	}
	if err = w.Pin(ctx, a); err != nil {
		t.Fatal(err)
	}
	for _, id := range []int64{0, -1, 2, 3, 99} {
		if _, err = w.Lock(ctx, a, id); err == nil {
			t.Fatalf("invalid player %d", id)
		}
	}
	h, err := w.Lock(ctx, a, 1)
	if err != nil {
		t.Fatal(err)
	}
	// Replacing the public wrapper must not retarget the locked handle's shard.
	original := *w
	p.ServerID = 2
	replacement, err := NewRecruitWallet(ctx, b, a, p)
	if err != nil {
		t.Fatal(err)
	}
	*w = *replacement
	if err = h.Debit(ctx, a, Resources{Food: 1}); err != nil {
		t.Fatal(err)
	}
	var sealed, otherShard int64
	if err = a.Scan(ctx, b, `SELECT (SELECT food FROM player_wallet WHERE server_id=1 AND player_id=1),(SELECT food FROM player_wallet WHERE server_id=2 AND player_id=1)`, nil, &sealed, &otherShard); err != nil || sealed != 99 || otherShard != 100 {
		t.Fatal(sealed, otherShard, err)
	}
	*w = original
	h, err = w.Lock(ctx, a, 1)
	if err != nil {
		t.Fatal(err)
	}
	other, _ := recruittx.NewBinding(pool)
	oo, aa := recruitWalletBegin(t, ctx, other)
	if err = h.Debit(ctx, aa, Resources{Food: 1}); err == nil {
		t.Fatal("foreign access")
	}
	if err = h.Debit(ctx, a, Resources{Food: 1}); err != nil {
		t.Fatal("foreign attempt consumed handle", err)
	}
	h, err = w.Lock(ctx, a, 1)
	if err != nil {
		t.Fatal(err)
	}
	snapshot := *a
	*a = *aa
	if h.Debit(ctx, a, Resources{}) == nil {
		t.Fatal("substitution")
	}
	*a = snapshot
	h, err = w.Lock(ctx, a, 1)
	if err != nil {
		t.Fatal(err)
	}
	canceled, stop := context.WithCancel(ctx)
	stop()
	if h.Debit(canceled, a, Resources{}) == nil {
		t.Fatal("cancellation")
	}
	if err = oo.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if err = o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name     string
		id       int64
		cost     Resources
		expected error
		commit   bool
		want     Resources
	}{
		{"negative", 1, Resources{Iron: -1}, ErrRecruitWalletCost, false, Resources{}},
		{"insufficient", 1, Resources{Wood: 91}, ErrRecruitWalletFunds, false, Resources{}},
		{"zero", 1, Resources{}, nil, false, Resources{}},
		{"rollback", 1, Resources{Food: 7, Wood: 8, Iron: 9, Stone: 10}, nil, false, Resources{}},
		{"commit", 1, Resources{Food: 7, Wood: 8, Iron: 9, Stone: 10}, nil, true, Resources{Food: 93, Wood: 82, Iron: 71, Stone: 60}},
		{"boundary", 4, Resources{Food: math.MaxInt64}, nil, true, Resources{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			owner, access := recruitWalletBegin(t, ctx, b)
			if err := w.Pin(ctx, access); err != nil {
				t.Fatal(err)
			}
			locked, err := w.Lock(ctx, access, tc.id)
			if err != nil {
				t.Fatal(err)
			}
			err = locked.Debit(ctx, access, tc.cost)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("debit %v want %v", err, tc.expected)
			}
			if locked.Debit(ctx, access, Resources{}) == nil {
				t.Fatal("reuse")
			}
			if tc.commit {
				err = owner.Commit(ctx)
			} else {
				err = owner.Rollback(ctx)
			}
			if err != nil {
				t.Fatal(err)
			}
			if locked.Debit(ctx, access, Resources{}) == nil {
				t.Fatal("ended")
			}
			var got Resources
			var gold int64
			if err = pool.QueryRow(ctx, `SELECT food,wood,iron,stone,gold FROM player_wallet WHERE server_id=1 AND player_id=$1`, tc.id).Scan(&got.Food, &got.Wood, &got.Iron, &got.Stone, &gold); err != nil {
				t.Fatal(err)
			}
			want := tc.want
			if !tc.commit {
				want = Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}
			}
			if got != want || (tc.id == 1 && gold != 9) || (tc.id == 4 && gold != 1) {
				t.Fatalf("balance %+v gold %d", got, gold)
			}
		})
	}
}
func TestPGRecruitDebitAliasesAndContention(t *testing.T) {
	for _, commit := range []bool{false, true} {
		t.Run(fmt.Sprint(commit), func(t *testing.T) {
			pool, b, p := recruitWalletFixture(t, false)
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()
			if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food,gold) VALUES(1,1,10,5)`); err != nil {
				t.Fatal(err)
			}
			setup, a := recruitWalletBegin(t, ctx, b)
			w, err := NewRecruitWallet(ctx, b, a, p)
			if err != nil {
				t.Fatal(err)
			}
			if err = setup.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			first, a := recruitWalletBegin(t, ctx, b)
			if err = w.Pin(ctx, a); err != nil {
				t.Fatal(err)
			}
			h, err := w.Lock(ctx, a, 1)
			if err != nil {
				t.Fatal(err)
			}
			second, aa := recruitWalletBegin(t, ctx, b)
			if err = w.Pin(ctx, aa); err != nil {
				t.Fatal(err)
			}
			started := make(chan struct{})
			done := make(chan error, 1)
			go func() {
				close(started)
				next, e := w.Lock(ctx, aa, 1)
				if e == nil {
					e = next.Debit(ctx, aa, Resources{Food: 9})
				}
				done <- e
			}()
			<-started
			select {
			case e := <-done:
				t.Fatalf("lock did not block: %v", e)
			case <-time.After(100 * time.Millisecond):
			}
			var wg sync.WaitGroup
			results := make(chan error, 16)
			for i := 0; i < 16; i++ {
				wg.Add(1)
				go func() { defer wg.Done(); alias := *h; results <- alias.Debit(ctx, a, Resources{Food: 1}) }()
			}
			wg.Wait()
			close(results)
			n := 0
			for e := range results {
				if e == nil {
					n++
				}
			}
			if n != 1 {
				t.Fatal("successful aliases", n)
			}
			if commit {
				err = first.Commit(ctx)
			} else {
				err = first.Rollback(ctx)
			}
			if err != nil {
				t.Fatal(err)
			}
			if err = <-done; err != nil {
				t.Fatal(err)
			}
			if err = second.Commit(ctx); err != nil {
				t.Fatal(err)
			}
			var food, gold int64
			if err = pool.QueryRow(ctx, `SELECT food,gold FROM player_wallet WHERE server_id=1 AND player_id=1`).Scan(&food, &gold); err != nil || food != map[bool]int64{true: 0, false: 1}[commit] || gold != 5 {
				t.Fatal(fmt.Sprint(food, gold), err)
			}
		})
	}
}
