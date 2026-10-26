package content

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestItemGrantPoolProvenance(t *testing.T) {
	s := testService(t)
	pool, foreign := new(pgxpool.Pool), new(pgxpool.Pool)
	if s.SupportsItemTransactionsFor(pool, s.catalog) || (*Service)(nil).SupportsItemTransactionsFor(pool, s.catalog) {
		t.Fatal("memory/nil service reported durable provenance")
	}
	s.UseStore(NewPGStore(pool))
	if !s.SupportsItemTransactionsFor(pool, s.catalog) || s.SupportsItemTransactionsFor(foreign, s.catalog) || s.SupportsItemTransactionsFor(pool, &Catalog{}) || s.SupportsItemTransactionsFor(nil, s.catalog) {
		t.Fatal("pool/catalog identity not enforced")
	}
	s.store.(*PGStore).Pool = foreign
	if s.SupportsItemTransactionsFor(pool, s.catalog) {
		t.Fatal("rewired pool accepted")
	}
	if _, err := s.CreateItemGrantInTx(context.Background(), nil, PlayerRef{1, 1}, RewardPackage{}, ItemGrantSource{}); !errors.Is(err, ErrItemTransactionsUnsupported) {
		t.Fatalf("nil tx: %v", err)
	}
}

func itemGrantFixture(t *testing.T) (*Service, *pgxpool.Pool, PlayerRef) {
	t.Helper()
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	s := itemPGService(t, pool)
	p := PlayerRef{1, time.Now().UnixNano()}
	if _, err := pool.Exec(context.Background(), `INSERT INTO player_wallet(server_id,player_id,food,gold,updated_at) VALUES($1,$2,20,100,'2020-01-01')`, p.ServerID, p.PlayerID); err != nil {
		t.Fatal(err)
	}
	return s, pool, p
}

func itemGrantBegin(t *testing.T, pool *pgxpool.Pool) pgx.Tx {
	t.Helper()
	tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	return tx
}

func TestPGItemGrantCallerRollbackAndCommit(t *testing.T) {
	s, pool, p := itemGrantFixture(t)
	cfg := pool.Config()
	cfg.MaxConns, cfg.MinConns = 1, 0
	one, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(one.Close)
	s.UseStore(NewPGStore(one))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.LoadPlayer(ctx, p); err != nil {
		t.Fatal(err)
	}
	pkg := RewardPackage{Resources: map[string]int64{}, Items: []RewardItem{{2004, 1}, {2001, 1}, {2004, 1}}}
	key := fmt.Sprintf("shop:%d:9", p.PlayerID)
	for _, commit := range []bool{false, true} {
		tx := itemGrantBegin(t, one)
		receipt, err := s.CreateItemGrantInTx(ctx, tx, p, pkg, ItemGrantSource{1001, 9})
		if err != nil || receipt.GrantID <= 0 || !reflect.DeepEqual(receipt.Rewards, pkg) {
			t.Fatalf("receipt=%+v err=%v", receipt, err)
		}
		if itemPGQuantity(t, pool, p, 2004) != 0 || len(s.List(p)) != 0 {
			t.Fatal("participant committed or published cache")
		}
		if _, found, err := NewPGStore(pool).FindGrantReceipt(ctx, p, pkg, key); err != nil || found {
			t.Fatalf("provisional receipt visible: %v %v", found, err)
		}
		if commit {
			err = tx.Commit(ctx)
		} else {
			err = tx.Rollback(ctx)
		}
		if err != nil {
			t.Fatal(err)
		}
		_, found, err := NewPGStore(pool).FindGrantReceipt(ctx, p, pkg, key)
		if err != nil || found != commit {
			t.Fatalf("durable receipt: %v %v", found, err)
		}
	}
	var source, ref string
	var complete, unchanged bool
	if err := pool.QueryRow(ctx, `SELECT source_type,source_ref,completed_at IS NOT NULL FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$2`, p.ServerID, key).Scan(&source, &ref, &complete); err != nil || source != "shop" || ref != "offer:1001:purchase:9" || !complete {
		t.Fatalf("source=%s ref=%s complete=%v err=%v", source, ref, complete, err)
	}
	if err := pool.QueryRow(ctx, `SELECT food=20 AND gold=100 AND updated_at='2020-01-01' FROM player_wallet WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID).Scan(&unchanged); err != nil || !unchanged {
		t.Fatalf("item grant rewrote wallet: %v %v", unchanged, err)
	}
	restarted := itemPGService(t, pool)
	if err := restarted.LoadPlayer(ctx, p); err != nil || !reflect.DeepEqual(restarted.List(p), []Stack{{2001, 1}, {2004, 2}}) || len(s.List(p)) != 0 {
		t.Fatalf("restart/cache ownership: %v %v", restarted.List(p), err)
	}
}

func TestPGItemGrantValidationRollback(t *testing.T) {
	s, pool, p := itemGrantFixture(t)
	s.catalog.BagMaxDistinctItems = 1
	ctx := context.Background()
	if _, err := s.GrantContext(ctx, p, RewardPackage{Items: []RewardItem{{2001, 1}}}, ""); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		player PlayerRef
		pkg    RewardPackage
		source ItemGrantSource
		want   error
	}{
		{"capacity", p, RewardPackage{Items: []RewardItem{{2004, 1}}}, ItemGrantSource{1, 1}, ErrBagFull},
		{"stack", p, RewardPackage{Items: []RewardItem{{2001, 99}}}, ItemGrantSource{1, 1}, ErrStackLimit},
		{"quantity", p, RewardPackage{Items: []RewardItem{{2001, 0}}}, ItemGrantSource{1, 1}, ErrInvalidReward},
		{"unknown", p, RewardPackage{Items: []RewardItem{{999999, 1}}}, ItemGrantSource{1, 1}, ErrUnknownItem},
		{"resources", p, RewardPackage{Resources: map[string]int64{"gold": 0}, Items: []RewardItem{{2001, 1}}}, ItemGrantSource{1, 1}, ErrInvalidReward},
		{"empty", p, RewardPackage{}, ItemGrantSource{1, 1}, ErrInvalidReward},
		{"source", p, RewardPackage{Items: []RewardItem{{2001, 1}}}, ItemGrantSource{0, 1}, ErrInvalidGrantSource},
		{"actor", PlayerRef{}, RewardPackage{Items: []RewardItem{{2001, 1}}}, ItemGrantSource{1, 1}, ErrInvalidPlayer},
		{"no wallet", PlayerRef{p.ServerID, p.PlayerID + 1}, RewardPackage{Items: []RewardItem{{2001, 1}}}, ItemGrantSource{1, 1}, pgx.ErrNoRows},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tx := itemGrantBegin(t, pool)
			if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold-10 WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID); err != nil {
				t.Fatal(err)
			}
			if _, err := s.CreateItemGrantInTx(ctx, tx, tc.player, tc.pkg, tc.source); !errors.Is(err, tc.want) {
				t.Fatalf("want %v got %v", tc.want, err)
			}
			if err := tx.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			var clean bool
			if err := pool.QueryRow(ctx, `SELECT gold=100 AND NOT EXISTS(SELECT 1 FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2) AND NOT EXISTS(SELECT 1 FROM player_wallet WHERE server_id=$1 AND player_id=$3) FROM player_wallet WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID, p.PlayerID+1).Scan(&clean); err != nil || !clean || itemPGQuantity(t, pool, p, 2001) != 1 {
				t.Fatalf("failed grant left partial state: %v %v", clean, err)
			}
		})
	}
}
