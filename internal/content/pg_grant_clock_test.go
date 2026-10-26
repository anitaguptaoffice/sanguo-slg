package content

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
)

func TestPGGrantPreservesItemOnlyWalletClock(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	ctx := context.Background()
	if err := db.ApplySpecs(ctx, pool, "../../spec/db"); err != nil {
		t.Fatal(err)
	}
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	fresh := func() *Service { s := NewService(cat); s.UseStore(NewPGStore(pool)); return s }
	p := PlayerRef{ServerID: 1, PlayerID: time.Now().UnixNano()}
	key := fmt.Sprintf("clock:%d", p.PlayerID)
	old := time.Date(2020, 1, 2, 3, 4, 5, 0, time.UTC)
	want := ResourceWallet{Food: 101, Wood: 202, Iron: 303, Stone: 404, Gold: 505}
	if _, err := pool.Exec(ctx, "INSERT INTO player_wallet(server_id,player_id,food,wood,iron,stone,gold,updated_at) VALUES($1,$2,101,202,303,404,505,$3)", p.ServerID, p.PlayerID, old); err != nil {
		t.Fatal(err)
	}
	check := func(wallet ResourceWallet, qty int32, unchanged bool) {
		t.Helper()
		var got ResourceWallet
		var stamp time.Time
		err := pool.QueryRow(ctx, "SELECT food,wood,iron,stone,gold,updated_at FROM player_wallet WHERE server_id=$1 AND player_id=$2", p.ServerID, p.PlayerID).Scan(&got.Food, &got.Wood, &got.Iron, &got.Stone, &got.Gold, &stamp)
		if err != nil || got != wallet || (unchanged && !stamp.Equal(old)) || (!unchanged && !stamp.After(old)) {
			t.Fatalf("wallet=%+v timestamp=%v unchanged=%v err=%v", got, stamp, unchanged, err)
		}
		s := fresh()
		if err := s.LoadPlayer(ctx, p); err != nil {
			t.Fatal(err)
		}
		q, err := s.Get(p, 2001)
		if err != nil || q != qty || s.Wallet(p) != wallet {
			t.Fatalf("reloaded wallet=%+v qty=%d err=%v", s.Wallet(p), q, err)
		}
	}
	// Concurrent first submissions still lock the wallet and apply the bag exactly once.
	pkg := RewardPackage{Items: []RewardItem{{ItemCfgID: 2001, Qty: 2}}}
	var wg sync.WaitGroup
	var applied atomic.Int32
	start := make(chan struct{})
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			s := fresh()
			r, e := s.Grant(p, pkg, key)
			if e != nil || r.Wallet != want || s.Wallet(p) != want {
				t.Errorf("grant=%+v cache=%+v err=%v", r, s.Wallet(p), e)
				return
			}
			if !r.Duplicate {
				applied.Add(1)
			}
		}()
	}
	close(start)
	wg.Wait()
	if applied.Load() != 1 {
		t.Fatalf("applied %d times", applied.Load())
	}
	check(want, 2, true)

	// A guard proves zero-resource variants do not even rewrite the same balances.
	name := fmt.Sprintf("content_clock_guard_%d", p.PlayerID)
	cleanup := fmt.Sprintf("DROP TRIGGER IF EXISTS %s ON player_wallet; DROP FUNCTION IF EXISTS %s()", name, name)
	if _, err := pool.Exec(ctx, fmt.Sprintf("CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unexpected wallet rewrite'; END $$; CREATE TRIGGER %s BEFORE UPDATE ON player_wallet FOR EACH ROW WHEN (NEW.player_id=%d) EXECUTE FUNCTION %s()", name, name, p.PlayerID, name)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, cleanup) })
	for i, resources := range []map[string]int64{nil, {}, {"food": 0, "wood": 0, "iron": 0, "stone": 0, "gold": 0}} {
		s := fresh()
		r, e := s.Grant(p, RewardPackage{Resources: resources}, fmt.Sprintf("%s:empty:%d", key, i))
		if e != nil || r.Wallet != want || s.Wallet(p) != want {
			t.Fatalf("empty grant=%+v cache=%+v err=%v", r, s.Wallet(p), e)
		}
	}
	r, e := fresh().Grant(p, pkg, key)
	if e != nil || !r.Duplicate || r.Wallet != want {
		t.Fatalf("replay=%+v err=%v", r, e)
	}
	check(want, 2, true)

	// A later invalid item rolls back earlier bag writes and the pending receipt.
	badKey := key + ":bad"
	bad := RewardPackage{Items: []RewardItem{{ItemCfgID: 2001, Qty: 1}, {ItemCfgID: 2001, Qty: 0}}}
	if _, e := fresh().Grant(p, bad, badKey); e == nil {
		t.Fatal("invalid grant succeeded")
	}
	var receipts int
	if e := pool.QueryRow(ctx, "SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$2", p.ServerID, badKey).Scan(&receipts); e != nil || receipts != 0 {
		t.Fatalf("failed receipts=%d err=%v", receipts, e)
	}
	check(want, 2, true)
	if _, e := pool.Exec(ctx, cleanup); e != nil {
		t.Fatal(e)
	}

	// Actual resource deltas preserve the existing update/timestamp semantics.
	mixed := RewardPackage{Resources: map[string]int64{"food": 7}, Items: pkg.Items}
	r, e = fresh().Grant(p, mixed, key+":mixed")
	want.Food += 7
	if e != nil || r.Wallet != want {
		t.Fatalf("mixed=%+v err=%v", r, e)
	}
	check(want, 4, false)

	// Item-only grants still create missing wallets with their normal initial clock.
	np := PlayerRef{ServerID: p.ServerID, PlayerID: p.PlayerID + 1}
	r, e = fresh().Grant(np, pkg, key+":new")
	if e != nil || r.Wallet != (ResourceWallet{}) {
		t.Fatalf("new=%+v err=%v", r, e)
	}
	var stamp time.Time
	if e := pool.QueryRow(ctx, "SELECT updated_at FROM player_wallet WHERE server_id=$1 AND player_id=$2", np.ServerID, np.PlayerID).Scan(&stamp); e != nil || !stamp.After(old) {
		t.Fatalf("new clock=%v err=%v", stamp, e)
	}
	s := fresh()
	if e := s.LoadPlayer(ctx, np); e != nil {
		t.Fatal(e)
	}
	if q, e := s.Get(np, 2001); e != nil || q != 2 {
		t.Fatalf("new bag=%d err=%v", q, e)
	}
}
