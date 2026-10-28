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

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
func mustFail(t *testing.T, err error, why string) {
	t.Helper()
	if err == nil {
		t.Fatal(why)
	}
}
func end(t *testing.T, ctx context.Context, o *recruittx.Owner, commit bool) {
	t.Helper()
	if commit {
		must(t, o.Commit(ctx))
		return
	}
	must(t, o.Rollback(ctx))
}

// wallet addresses the live transaction, or an independent one when a is nil.
func wallet(t *testing.T, ctx context.Context, b *recruittx.Binding, a *recruittx.Access, id int64) (Resources, int64) {
	t.Helper()
	if a == nil {
		_, a = recruitWalletBegin(t, ctx, b)
	}
	var r Resources
	var gold int64
	must(t, a.Scan(ctx, b, `SELECT food,wood,iron,stone,gold FROM player_wallet WHERE server_id=1 AND player_id=$1`, []any{id}, &r.Food, &r.Wood, &r.Iron, &r.Stone, &gold))
	return r, gold
}
func TestPGRecruitDebit(t *testing.T) {
	pool, b, p := recruitWalletFixture(t, true)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	_, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food,wood,iron,stone,gold) VALUES (1,1,100,90,80,70,9),(2,1,100,90,80,70,9),(1,2,-1,0,0,0,0),(2,3,100,0,0,0,0),(1,4,9223372036854775807,0,0,0,1),(1,5,100,90,80,70,9)`)
	must(t, err)
	o, a := recruitWalletBegin(t, ctx, b)
	w, err := NewRecruitWallet(ctx, b, a, p)
	must(t, err)
	_, err = w.Lock(ctx, a, 1)
	mustFail(t, err, "unpinned")
	must(t, w.Pin(ctx, a))
	for _, id := range []int64{0, -1, 2, 3, 99} {
		if _, err = w.Lock(ctx, a, id); err == nil {
			t.Fatalf("invalid player %d", id)
		}
	}
	h, err := w.Lock(ctx, a, 1)
	must(t, err)
	// Replacing the public wrapper must not retarget the locked handle's shard.
	original := *w
	p.ServerID = 2
	replacement, err := NewRecruitWallet(ctx, b, a, p)
	must(t, err)
	*w = *replacement
	must(t, h.Debit(ctx, a, Resources{Food: 1}))
	var sealed, otherShard int64
	if err = a.Scan(ctx, b, `SELECT (SELECT food FROM player_wallet WHERE server_id=1 AND player_id=1),(SELECT food FROM player_wallet WHERE server_id=2 AND player_id=1)`, nil, &sealed, &otherShard); err != nil || sealed != 99 || otherShard != 100 {
		t.Fatal(sealed, otherShard, err)
	}
	*w = original
	h, err = w.Lock(ctx, a, 1)
	must(t, err)
	other, _ := recruittx.NewBinding(pool)
	oo, aa := recruitWalletBegin(t, ctx, other)
	mustFail(t, h.Debit(ctx, aa, Resources{Food: 1}), "foreign access")
	if err = h.Debit(ctx, a, Resources{Food: 1}); err != nil {
		t.Fatal("foreign attempt consumed handle", err)
	}
	h, err = w.Lock(ctx, a, 1)
	must(t, err)
	snapshot := *a
	*a = *aa
	mustFail(t, h.Debit(ctx, a, Resources{}), "substitution")
	*a = snapshot
	canceled, stop := context.WithCancel(ctx)
	stop()
	mustFail(t, h.Debit(canceled, a, Resources{}), "cancellation")
	must(t, oo.Rollback(ctx))
	must(t, o.Rollback(ctx))
	t.Run("unused-ended", func(t *testing.T) {
		for _, commit := range []bool{false, true} {
			owner, access := recruitWalletBegin(t, ctx, b)
			must(t, w.Pin(ctx, access))
			locked, err := w.Lock(ctx, access, 5)
			must(t, err)
			end(t, ctx, owner, commit)
			if err = locked.Debit(ctx, access, Resources{Food: 1}); !errors.Is(err, recruittx.ErrInactive) {
				t.Fatal("ended before first debit", commit, err)
			}
			if got, gold := wallet(t, ctx, b, nil, 5); got != (Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}) || gold != 9 {
				t.Fatal(got, gold)
			}
		}
	})
	cases := []struct {
		name        string
		id          int64
		cost        Resources
		live, final Resources
		gold        int64
		expected    error
		commit      bool
	}{
		{"negative", 1, Resources{Iron: -1}, Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}, Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}, 9, ErrRecruitWalletCost, false},
		{"insufficient", 1, Resources{Wood: 91}, Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}, Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}, 9, ErrRecruitWalletFunds, false},
		{"zero", 1, Resources{}, Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}, Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}, 9, nil, false},
		{"rollback", 1, Resources{Food: 7, Wood: 8, Iron: 9, Stone: 10}, Resources{Food: 93, Wood: 82, Iron: 71, Stone: 60}, Resources{Food: 100, Wood: 90, Iron: 80, Stone: 70}, 9, nil, false},
		{"commit", 1, Resources{Food: 7, Wood: 8, Iron: 9, Stone: 10}, Resources{Food: 93, Wood: 82, Iron: 71, Stone: 60}, Resources{Food: 93, Wood: 82, Iron: 71, Stone: 60}, 9, nil, true},
		{"boundary", 4, Resources{Food: math.MaxInt64}, Resources{}, Resources{}, 1, nil, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			owner, access := recruitWalletBegin(t, ctx, b)
			must(t, w.Pin(ctx, access))
			locked, err := w.Lock(ctx, access, tc.id)
			must(t, err)
			if err = locked.Debit(ctx, access, tc.cost); !errors.Is(err, tc.expected) {
				t.Fatalf("debit %v want %v", err, tc.expected)
			}
			// The uncommitted wallet must already show exactly this debit.
			if live, gold := wallet(t, ctx, b, access, tc.id); live != tc.live || gold != tc.gold {
				t.Fatalf("live %+v gold %d", live, gold)
			}
			mustFail(t, locked.Debit(ctx, access, Resources{}), "reuse before end")
			end(t, ctx, owner, tc.commit)
			mustFail(t, locked.Debit(ctx, access, Resources{}), "ended")
			if final, gold := wallet(t, ctx, b, nil, tc.id); final != tc.final || gold != tc.gold {
				t.Fatalf("final %+v gold %d", final, gold)
			}
		})
	}
}

// Definite drift after Lock must fail closed before any write and retire every copy.
func TestPGRecruitDebitSourceDrift(t *testing.T) {
	pool, b, p := recruitWalletFixture(t, false)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food,gold) VALUES(1,1,10,5)`)
	must(t, err)
	_, a := recruitWalletBegin(t, ctx, b)
	w, err := NewRecruitWallet(ctx, b, a, p)
	must(t, err)
	must(t, w.Pin(ctx, a))
	h, err := w.Lock(ctx, a, 1)
	must(t, err)
	copied := *w
	if _, err = pool.Exec(ctx, `CREATE VIEW drift AS SELECT food FROM player_wallet`); err != nil {
		t.Fatal(err)
	}
	if err = h.Debit(ctx, a, Resources{Food: 1}); !errors.Is(err, ErrRecruitWalletSource) || !w.retired.Load() || !copied.retired.Load() {
		t.Fatal("drift admitted or not retired", err, w.retired.Load(), copied.retired.Load())
	}
	if got, gold := wallet(t, ctx, b, a, 1); got != (Resources{Food: 10}) || gold != 5 {
		t.Fatal("mutated", got, gold)
	}
	mustFail(t, copied.Pin(ctx, a), "retired copy pinned")
}

func TestPGRecruitDebitAliasesAndContention(t *testing.T) {
	for _, commit := range []bool{false, true} {
		t.Run(fmt.Sprint(commit), func(t *testing.T) {
			pool, b, p := recruitWalletFixture(t, false)
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()
			_, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food,gold) VALUES(1,1,10,5)`)
			must(t, err)
			first, a := recruitWalletBegin(t, ctx, b)
			w, err := NewRecruitWallet(ctx, b, a, p)
			must(t, err)
			must(t, w.Pin(ctx, a))
			h, err := w.Lock(ctx, a, 1)
			must(t, err)
			second, aa := recruitWalletBegin(t, ctx, b)
			must(t, w.Pin(ctx, aa))
			// A second transaction on this same Binding must not spend the captured handle.
			mustFail(t, h.Debit(ctx, aa, Resources{Food: 1}), "same binding other transaction")
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
			end(t, ctx, first, commit)
			must(t, <-done)
			must(t, second.Commit(ctx))
			if food, gold := wallet(t, ctx, b, nil, 1); food != (Resources{Food: map[bool]int64{true: 0, false: 1}[commit]}) || gold != 5 {
				t.Fatal("final", food, gold)
			}
		})
	}
}
