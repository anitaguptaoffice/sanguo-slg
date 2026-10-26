package content

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestPGGrantContextLockTimeoutAndRetry(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	ctx := context.Background()
	for _, lockTable := range []string{"player_wallet", "player_item"} {
		t.Run(lockTable, func(t *testing.T) {
			svc := testService(t)
			svc.UseStore(NewPGStore(pool))
			p := PlayerRef{ServerID: 1, PlayerID: time.Now().UnixNano()}
			key := fmt.Sprintf("context:%d", p.PlayerID)
			pkg := RewardPackage{Resources: map[string]int64{"food": 7}, Items: []RewardItem{{ItemCfgID: 2004, Qty: 1}}}
			if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food) VALUES($1,$2,11)`, p.ServerID, p.PlayerID); err != nil {
				t.Fatal(err)
			}
			if _, err := pool.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES($1,$2,2004,1)`, p.ServerID, p.PlayerID); err != nil {
				t.Fatal(err)
			}
			if err := svc.LoadPlayer(ctx, p); err != nil {
				t.Fatal(err)
			}
			canceled, stop := context.WithCancel(ctx)
			stop()
			if _, err := svc.GrantContext(canceled, p, pkg, key); !errors.Is(err, context.Canceled) {
				t.Fatalf("already-canceled PG grant: %v", err)
			}
			blocker, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer blocker.Rollback(ctx)
			// The item lock blocks after the transaction has inserted its receipt.
			if _, err = blocker.Exec(ctx, `SELECT 1 FROM `+lockTable+` WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, p.ServerID, p.PlayerID); err != nil {
				t.Fatal(err)
			}
			deadline, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
			start := time.Now()
			_, err = svc.GrantContext(deadline, p, pkg, key)
			cancel()
			if !errors.Is(err, context.DeadlineExceeded) || time.Since(start) > time.Second {
				t.Fatalf("row lock did not honor deadline: %v after %s", err, time.Since(start))
			}
			if err = blocker.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			qty, _ := svc.Get(p, 2004)
			if qty != 1 || svc.Wallet(p).Food != 11 {
				t.Fatal("timed-out transaction published cache")
			}
			var food int64
			var receipts int
			if err = pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID).Scan(&food); err != nil || food != 11 {
				t.Fatalf("wallet changed: %d %v", food, err)
			}
			if err = pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=2004`, p.ServerID, p.PlayerID).Scan(&qty); err != nil || qty != 1 {
				t.Fatalf("bag changed: %d %v", qty, err)
			}
			if err = pool.QueryRow(ctx, `SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$2`, p.ServerID, key).Scan(&receipts); err != nil || receipts != 0 {
				t.Fatalf("receipt survived rollback: %d %v", receipts, err)
			}
			retry, err := svc.GrantContext(ctx, p, pkg, key)
			if err != nil || retry.Duplicate || retry.Wallet.Food != 18 {
				t.Fatalf("retry: %+v %v", retry, err)
			}
			restarted := testService(t)
			restarted.UseStore(NewPGStore(pool))
			dup, err := restarted.GrantContext(ctx, p, pkg, key)
			qty, _ = restarted.Get(p, 2004)
			if err != nil || !dup.Duplicate || dup.GrantID != retry.GrantID || dup.Wallet.Food != 18 || qty != 2 {
				t.Fatalf("restart duplicate: %+v qty=%d %v", dup, qty, err)
			}
		})
	}
}
