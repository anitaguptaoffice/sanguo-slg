package content

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestPGItemGrantPostDebitCapacity(t *testing.T) {
	for _, tc := range []struct {
		name                 string
		id, qty, cost, grant int32
		want                 error
	}{
		{"freed slot with zero output row", 2004, 1, 1, 2, nil},
		{"partial payment keeps slot", 2004, 2, 1, 1, ErrBagFull},
		{"same payment and output at max", 2001, 99, 1, 1, nil},
		{"same output beyond max", 2001, 99, 1, 2, ErrStackLimit},
		{"duplicate sum cannot overflow", 2001, 99, 1, math.MaxInt32, ErrStackLimit},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, pool, p := itemGrantFixture(t)
			s.catalog.BagMaxDistinctItems = 1
			ctx := context.Background()
			if _, err := s.GrantContext(ctx, p, RewardPackage{Items: []RewardItem{{tc.id, tc.qty}}}, ""); err != nil {
				t.Fatal(err)
			}
			if tc.id != 2001 {
				if _, err := pool.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES($1,$2,2001,0)`, p.ServerID, p.PlayerID); err != nil {
					t.Fatal(err)
				}
			}
			tx := itemGrantBegin(t, pool)
			if _, err := s.DebitItemsInTx(ctx, tx, p, []Stack{{tc.id, tc.cost}}); err != nil {
				t.Fatal(err)
			}
			pkg := RewardPackage{Items: []RewardItem{{2001, tc.grant}}}
			if tc.grant == math.MaxInt32 {
				pkg.Items = append(pkg.Items, RewardItem{2001, math.MaxInt32})
			}
			_, err := s.CreateItemGrantInTx(ctx, tx, p, pkg, ItemGrantSource{1001, 1})
			if !errors.Is(err, tc.want) {
				t.Fatalf("want %v got %v", tc.want, err)
			}
			if tc.want != nil {
				if err := tx.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
				if itemPGQuantity(t, pool, p, tc.id) != tc.qty {
					t.Fatal("failed reward kept its payment")
				}
			} else {
				if err := tx.Commit(ctx); err != nil {
					t.Fatal(err)
				}
				want := tc.grant
				if tc.id == 2001 {
					want += tc.qty - tc.cost
				} else if itemPGQuantity(t, pool, p, tc.id) != 0 {
					t.Fatal("spent currency stack remains")
				}
				if itemPGQuantity(t, pool, p, 2001) != want {
					t.Fatal("wrong final reward quantity")
				}
			}
		})
	}
}

type itemGrantCancelWriteTx struct {
	pgx.Tx
	cancel context.CancelFunc
}

func (tx itemGrantCancelWriteTx) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	tag, err := tx.Tx.Exec(ctx, sql, args...)
	if strings.HasPrefix(sql, "INSERT INTO player_item") && err == nil {
		tx.cancel()
	}
	return tag, err
}

func TestPGItemGrantCancellationRollsBackAllStagedWrites(t *testing.T) {
	for _, stage := range []string{"before", "wallet", "items", "receipt", "after item write"} {
		t.Run(stage, func(t *testing.T) {
			s, pool, p := itemGrantFixture(t)
			base := context.Background()
			if _, err := s.GrantContext(base, p, RewardPackage{Items: []RewardItem{{2001, 1}}}, ""); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(base, 100*time.Millisecond)
			defer cancel()
			tx := itemGrantBegin(t, pool)
			var used pgx.Tx = tx
			var blocker pgx.Tx
			if stage == "wallet" || stage == "items" || stage == "receipt" {
				blocker = itemGrantBegin(t, pool)
			}
			if stage == "wallet" || stage == "items" {
				table := "player_wallet"
				if stage == "items" {
					table = "player_item"
				}
				if _, err := blocker.Exec(base, `SELECT 1 FROM `+table+` WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, p.ServerID, p.PlayerID); err != nil {
					t.Fatal(err)
				}
			}
			if stage != "wallet" {
				if _, err := tx.Exec(base, `UPDATE player_wallet SET gold=gold-10 WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID); err != nil {
					t.Fatal(err)
				}
			}
			switch stage {
			case "before":
				cancel()
			case "receipt":
				used = &itemGrantInterleaveTx{Tx: tx, afterMax: func(high int64) {
					if _, err := blocker.Exec(base, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,idempotency_key) VALUES($1,$2,$3,'gm','','cancel collision')`, p.ServerID, high+1, p.PlayerID+1); err != nil {
						t.Fatal(err)
					}
				}}
			case "after item write":
				used = itemGrantCancelWriteTx{tx, cancel}
			}
			pkg := RewardPackage{Items: []RewardItem{{2001, 1}, {2004, 1}}}
			if r, err := s.CreateItemGrantInTx(ctx, used, p, pkg, ItemGrantSource{1001, 1}); err == nil || ctx.Err() == nil || r.GrantID != 0 {
				t.Fatalf("cancellation: %+v %v context=%v", r, err, ctx.Err())
			}
			conn := tx.Conn() // Timed-out pgx queries may close the connection.
			if err := tx.Rollback(base); err != nil && !errors.Is(err, pgx.ErrTxClosed) && !conn.IsClosed() {
				t.Fatal(err)
			}
			if blocker != nil {
				if err := blocker.Rollback(base); err != nil {
					t.Fatal(err)
				}
			}
			var clean bool
			key := fmt.Sprintf("shop:%d:1", p.PlayerID)
			if err := pool.QueryRow(base, `SELECT gold=100 AND NOT EXISTS(SELECT 1 FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$3) FROM player_wallet WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID, key).Scan(&clean); err != nil || !clean || itemPGQuantity(t, pool, p, 2001) != 1 || itemPGQuantity(t, pool, p, 2004) != 0 {
				t.Fatalf("canceled grant left staged state: %v %v", clean, err)
			}
			if qty, _ := s.Get(p, 2001); qty != 1 || len(s.List(p)) != 1 {
				t.Fatal("canceled participant changed cache")
			}
		})
	}
}
