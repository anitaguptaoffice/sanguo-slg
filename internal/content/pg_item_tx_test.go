package content

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func itemPGService(t *testing.T, pool *pgxpool.Pool) *Service {
	t.Helper()
	s := testService(t)
	s.UseStore(NewPGStore(pool))
	return s
}

func itemPGQuantity(t *testing.T, pool *pgxpool.Pool, p PlayerRef, id int32) int32 {
	t.Helper()
	var qty int32
	if err := pool.QueryRow(context.Background(), `SELECT COALESCE((SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=$3),0)`, p.ServerID, p.PlayerID, id).Scan(&qty); err != nil {
		t.Fatal(err)
	}
	return qty
}

func TestPGItemTxRollbackAndPostcommitInvalidation(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	// The caller holds the only connection: participant pool access would time out.
	cfg := pool.Config()
	cfg.MaxConns, cfg.MinConns = 1, 0
	one, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(one.Close)
	s := itemPGService(t, one)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	p := PlayerRef{1, time.Now().UnixNano()}
	if _, err := s.GrantContext(ctx, p, RewardPackage{Resources: map[string]int64{"food": 7}, Items: []RewardItem{{2001, 2}, {2004, 2}}}, ""); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		costs []Stack
		want  error
	}{
		{[]Stack{{2001, 1}, {2004, 3}}, ErrInsufficientItems},
		{[]Stack{{2001, 1}, {2004, 0}}, ErrInvalidQuantity},
		{[]Stack{{2001, 1}, {2004, -1}}, ErrInvalidQuantity},
		{[]Stack{{2001, 1}, {999999, 1}}, ErrUnknownItem},
	} {
		tx, err := one.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		_, err = s.DebitItemsInTx(ctx, tx, p, tc.costs)
		if !errors.Is(err, tc.want) {
			t.Fatalf("debit %v: %v", tc.costs, err)
		}
		if err := tx.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
		for _, id := range []int32{2001, 2004} {
			if qty := itemPGQuantity(t, pool, p, id); qty != 2 {
				t.Fatalf("rolled-back debit changed %d to %d", id, qty)
			}
			if qty, _ := s.Get(p, id); qty != 2 {
				t.Fatalf("failed debit published cache %d=%d", id, qty)
			}
		}
	}
	tx, err := one.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	bag, err := s.LoadBagInTx(ctx, tx, p)
	if err != nil || !reflect.DeepEqual(bag, []Stack{{2001, 2}, {2004, 2}}) {
		t.Fatalf("tx bag=%v err=%v", bag, err)
	}
	left, err := s.DebitItemsInTx(ctx, tx, p, []Stack{{2004, 1}, {2001, 1}, {2004, 1}})
	if err != nil || !reflect.DeepEqual(left, []Stack{{2001, 1}, {2004, 0}}) {
		t.Fatalf("actual ordered debit=%v err=%v", left, err)
	}
	if qty, _ := s.Get(p, 2004); qty != 2 {
		t.Fatal("participant published uncommitted cache")
	}
	if qty := itemPGQuantity(t, pool, p, 2004); qty != 2 {
		t.Fatal("participant committed caller transaction")
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	canceled, stop := context.WithCancel(ctx)
	stop()
	if err := s.InvalidatePlayerContext(canceled, p); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled invalidation: %v", err)
	}
	if qty, _ := s.Get(p, 2004); qty != 2 || itemPGQuantity(t, pool, p, 2004) != 0 {
		t.Fatal("postcommit diagnostic altered transaction/cache")
	}
	if err := s.InvalidatePlayerContext(ctx, p); err != nil {
		t.Fatal(err)
	}
	if len(s.bags)+len(s.wallets) != 0 {
		t.Fatal("stale snapshots survived invalidation")
	}
	if err := s.LoadPlayer(ctx, p); err != nil {
		t.Fatal(err)
	}
	if qty, _ := s.Get(p, 2001); qty != 1 || s.Wallet(p).Food != 7 {
		t.Fatalf("postcommit hydration: qty=%d wallet=%+v", qty, s.Wallet(p))
	}
}

func TestPGItemTxExactIdentityAbsentAndZero(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	s := itemPGService(t, pool)
	ctx := context.Background()
	p := PlayerRef{1, time.Now().UnixNano()}
	for _, owner := range []PlayerRef{p, {2, p.PlayerID}, {1, p.PlayerID + 1}} {
		if _, err := s.Grant(owner, RewardPackage{Items: []RewardItem{{2004, 1}}}, ""); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.Remove(p, 2004, 1); err != nil {
		t.Fatal(err)
	}
	for _, owner := range []PlayerRef{{2, p.PlayerID}, {1, p.PlayerID + 1}} {
		if itemPGQuantity(t, pool, owner, 2004) != 1 {
			t.Fatal("debit crossed owner/shard")
		}
	}
	for _, owner := range []PlayerRef{p, {1, p.PlayerID + 2}} {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		_, err = s.DebitItemsInTx(ctx, tx, owner, []Stack{{2004, 1}})
		if !errors.Is(err, ErrInsufficientItems) {
			t.Fatalf("absent/zero debit: %v", err)
		}
		if err := tx.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
	}
	// Failed debit of an absent player must not leave the coordinating wallet.
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM player_wallet WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID+2).Scan(&n); err != nil || n != 0 {
		t.Fatalf("failed debit created wallet n=%d err=%v", n, err)
	}
}
