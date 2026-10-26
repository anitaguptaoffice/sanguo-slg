package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGItemGrantConcurrentLegacyAndGMWriters(t *testing.T) {
	_, pool, p := itemGrantFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	players := []PlayerRef{p, {p.ServerID, p.PlayerID + 1}, {p.ServerID, p.PlayerID + 2}}
	for _, actor := range players[1:] {
		if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,gold) VALUES($1,$2,100)`, actor.ServerID, actor.PlayerID); err != nil {
			t.Fatal(err)
		}
	}
	type result struct {
		worker, success, rejected int
		err                       error
	}
	results, start := make(chan result, 4), make(chan struct{})
	for worker := 0; worker < 4; worker++ {
		cfg := pool.Config()
		cfg.MaxConns, cfg.MinConns = 2, 0
		other, err := pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(other.Close)
		s := itemPGService(t, other)
		go func(worker int, pool *pgxpool.Pool, s *Service) {
			r := result{worker: worker}
			defer func() { results <- r }()
			<-start
			actor := players[0]
			if worker >= 2 {
				actor = players[worker-1]
			}
			pkg := RewardPackage{Items: []RewardItem{{2001, 1}}}
			for n := 1; n <= 12; n++ {
				var err error
				if worker == 0 || worker == 2 {
					tx, beginErr := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
					if beginErr != nil {
						r.err = beginErr
						return
					}
					_, err = tx.Exec(ctx, `UPDATE player_wallet SET gold=gold-1 WHERE server_id=$1 AND player_id=$2`, actor.ServerID, actor.PlayerID)
					if err == nil {
						_, err = s.CreateItemGrantInTx(ctx, tx, actor, pkg, ItemGrantSource{1001, int64(n)})
					}
					if err == nil {
						err = tx.Commit(ctx)
					}
					_ = tx.Rollback(context.Background())
					if errors.Is(err, ErrGrantIDContention) {
						r.rejected++
						continue // A known rejected purchase is never replayed.
					}
				} else if worker == 1 {
					_, err = s.GrantContext(ctx, actor, pkg, fmt.Sprintf("legacy:%d:%d", actor.PlayerID, n))
				} else {
					// Reproduce GM's independent MAX+1 enqueue, then its real
					// ProcessGrant consumer. Existing GM PK rejects are allowed.
					key := fmt.Sprintf("gm:%d:%d", actor.PlayerID, n)
					id, nextErr := NewPGStore(pool).NextGrantID(ctx, actor.ServerID)
					err = nextErr
					if err == nil {
						raw, _ := json.Marshal(pkg)
						_, err = pool.Exec(ctx, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,rewards,status,idempotency_key) VALUES($1,$2,$3,'gm','stress',$4,1,$5)`, actor.ServerID, id, actor.PlayerID, raw, key)
					}
					var pgErr *pgconn.PgError
					if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "reward_grant_queue_pkey" {
						r.rejected++
						continue
					}
					if err == nil {
						_, _, err = s.ProcessGrant(GrantJob{ServerID: actor.ServerID, PlayerID: actor.PlayerID, GrantID: id, SourceType: "gm", SourceRef: "stress", Rewards: pkg, IdempotencyKey: key})
					}
				}
				if err != nil {
					r.err = err
					return
				}
				r.success++
			}
		}(worker, other, s)
	}
	close(start)
	counts := make([]int, 4)
	for range 4 {
		r := <-results
		if r.err != nil || r.success+r.rejected != 12 {
			t.Fatalf("worker result: %+v", r)
		}
		counts[r.worker] = r.success
	}
	for i, actor := range players {
		want, spent := counts[0]+counts[1], counts[0]
		if i > 0 {
			want, spent = counts[i+1], 0
			if i == 1 {
				spent = want
			}
		}
		var gold int64
		var receipts, pending int
		if err := pool.QueryRow(ctx, `SELECT gold,(SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2),(SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2 AND status<>2) FROM player_wallet WHERE server_id=$1 AND player_id=$2`, actor.ServerID, actor.PlayerID).Scan(&gold, &receipts, &pending); err != nil || gold != int64(100-spent) || receipts != want || pending != 0 || itemPGQuantity(t, pool, actor, 2001) != int32(want) {
			t.Fatalf("actor=%+v gold=%d receipts=%d pending=%d want=%d err=%v", actor, gold, receipts, pending, want, err)
		}
	}
	if counts[0]+counts[2] == 0 {
		t.Fatal("no new participant succeeded")
	}
}

func TestPGItemGrantReceiptAndInventoryShardIsolation(t *testing.T) {
	s, pool, p := itemGrantFixture(t)
	ctx := context.Background()
	other := PlayerRef{2, p.PlayerID}
	if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,gold) VALUES($1,$2,100)`, other.ServerID, other.PlayerID); err != nil {
		t.Fatal(err)
	}
	for _, actor := range []PlayerRef{p, other} {
		tx := itemGrantBegin(t, pool)
		pkg := RewardPackage{Items: []RewardItem{{2001, actor.ServerID}}}
		if _, err := s.CreateItemGrantInTx(ctx, tx, actor, pkg, ItemGrantSource{1001, 1}); err != nil {
			t.Fatal(err)
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		key := fmt.Sprintf("shop:%d:1", actor.PlayerID)
		if _, found, err := s.FindGrantReceipt(ctx, actor, pkg, key); err != nil || !found || itemPGQuantity(t, pool, actor, 2001) != actor.ServerID {
			t.Fatalf("cross-shard receipt or inventory: %+v %v %v", actor, found, err)
		}
	}
}
