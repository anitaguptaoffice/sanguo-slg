package content

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestPGItemDebitCancellationKeepsCacheAndStock(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	for _, table := range []string{"player_wallet", "player_item"} {
		for _, participant := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s_participant_%v", table, participant), func(t *testing.T) {
				ctx := context.Background()
				s := itemPGService(t, pool)
				p := PlayerRef{1, time.Now().UnixNano()}
				if _, err := s.Grant(p, RewardPackage{Items: []RewardItem{{2004, 1}}}, ""); err != nil {
					t.Fatal(err)
				}
				blocker, err := pool.Begin(ctx)
				if err != nil {
					t.Fatal(err)
				}
				defer func(rollback func(context.Context) error, ctx context.Context) {
					_ = rollback(ctx)
				}(blocker.Rollback, ctx)
				if _, err := blocker.Exec(ctx, `SELECT 1 FROM `+table+` WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, p.ServerID, p.PlayerID); err != nil {
					t.Fatal(err)
				}
				deadline, cancel := context.WithTimeout(ctx, 60*time.Millisecond)
				start := time.Now()
				if participant {
					tx, beginErr := pool.Begin(ctx)
					if beginErr != nil {
						t.Fatal(beginErr)
					}
					_, err = s.DebitItemsInTx(deadline, tx, p, []Stack{{2004, 1}})
					_ = tx.Rollback(ctx)
				} else {
					_, err = s.RemoveContext(deadline, p, 2004, 1)
				}
				cancel()
				if !errors.Is(err, context.DeadlineExceeded) || time.Since(start) > time.Second {
					t.Fatalf("blocked debit: %v after %s", err, time.Since(start))
				}
				if err := blocker.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
				if qty, _ := s.Get(p, 2004); qty != 1 || itemPGQuantity(t, pool, p, 2004) != 1 {
					t.Fatal("canceled debit changed cache/stock")
				}
				if _, err := s.RemoveContext(ctx, p, 2004, 1); err != nil {
					t.Fatalf("fresh attempt after explicit rollback: %v", err)
				}
			})
		}
	}
}

func TestPGItemReadSerializesAbsentGrant(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	ctx := context.Background()
	s, grant := itemPGService(t, pool), itemPGService(t, pool)
	p := PlayerRef{1, time.Now().UnixNano()}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, ctx)
	if bag, err := s.LoadBagInTx(ctx, tx, p); err != nil || len(bag) != 0 {
		t.Fatalf("absent tx read: %v %v", bag, err)
	}
	deadline, cancel := context.WithTimeout(ctx, 60*time.Millisecond)
	_, err = grant.GrantContext(deadline, p, RewardPackage{Items: []RewardItem{{2004, 1}}}, "")
	cancel()
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Grant bypassed absent-player wallet lock: %v", err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if itemPGQuantity(t, pool, p, 2004) != 0 || len(grant.bags) != 0 {
		t.Fatal("blocked Grant published stock/cache")
	}
	if _, err := grant.Grant(p, RewardPackage{Items: []RewardItem{{2004, 1}}}, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Remove(p, 2004, 1); err != nil {
		t.Fatal(err)
	}
}

func TestPGRemoveStatementAndCommitFailureDoNotPublish(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	for _, deferred := range []bool{false, true} {
		t.Run(fmt.Sprintf("deferred_%v", deferred), func(t *testing.T) {
			ctx := context.Background()
			s := itemPGService(t, pool)
			p := PlayerRef{1, time.Now().UnixNano()}
			if _, err := s.Grant(p, RewardPackage{Items: []RewardItem{{2004, 2}}}, ""); err != nil {
				t.Fatal(err)
			}
			name := fmt.Sprintf("item_debit_fail_%d", p.PlayerID)
			sql := fmt.Sprintf(`CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected debit failure'; END $$; `, name)
			if deferred {
				sql += fmt.Sprintf(`CREATE CONSTRAINT TRIGGER %s AFTER UPDATE ON player_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.player_id=%d) EXECUTE FUNCTION %s()`, name, p.PlayerID, name)
			} else {
				sql += fmt.Sprintf(`CREATE TRIGGER %s BEFORE UPDATE ON player_item FOR EACH ROW WHEN (NEW.player_id=%d) EXECUTE FUNCTION %s()`, name, p.PlayerID, name)
			}
			if _, err := pool.Exec(ctx, sql); err != nil {
				t.Fatal(err)
			}
			cleanup := func() {
				if _, err := pool.Exec(ctx, fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON player_item; DROP FUNCTION IF EXISTS %s()`, name, name)); err != nil {
					t.Errorf("cleanup: %v", err)
				}
			}
			defer cleanup()
			if _, err := s.Remove(p, 2004, 1); err == nil {
				t.Fatal("injected failure ignored")
			}
			if qty, _ := s.Get(p, 2004); qty != 2 || itemPGQuantity(t, pool, p, 2004) != 2 {
				t.Fatal("failed transaction published stock/cache")
			}
			cleanup()
			if left, err := s.Remove(p, 2004, 1); err != nil || left != 1 {
				t.Fatalf("fresh attempt: left=%d err=%v", left, err)
			}
		})
	}
}
