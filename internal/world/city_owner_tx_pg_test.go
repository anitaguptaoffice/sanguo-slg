package world

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func ownerPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool := creationPool(t)
	creationSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y)
 VALUES (1,10,7,'original',1,1),(2,10,8,'other shard',1,1)`)
	return pool
}

func TestPGCityOwnerInTxGuardsAndRollback(t *testing.T) {
	pool, ctx := ownerPool(t), context.Background()
	svc := &Service{Store: NewPGStore(nil)}
	for _, tc := range []struct {
		sid          int32
		city, player int64
		want         error
	}{
		{1, 10, 7, nil}, {1, 10, 8, ErrCityNotOwned}, {2, 10, 7, ErrCityNotOwned},
		{2, 10, 8, nil}, {3, 10, 7, ErrCityNotOwned}, {1, 11, 7, ErrCityNotOwned},
	} {
		tx := creationBegin(t, pool)
		if err := svc.LockCityOwnerInTx(ctx, tx, tc.sid, tc.city, tc.player); !errors.Is(err, tc.want) {
			t.Fatal(tc, err)
		}
		if err := tx.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
	}
	// The participant must observe this supplied transaction's staged owner,
	// not a pooled connection. It must leave caller state uncommitted.
	tx := creationBegin(t, pool)
	if _, err := tx.Exec(ctx, `UPDATE player_city SET player_id=8 WHERE server_id=1 AND city_id=10`); err != nil {
		t.Fatal(err)
	}
	if err := svc.LockCityOwnerInTx(ctx, tx, 1, 10, 8); err != nil {
		t.Fatal(err)
	}
	var owner int64
	if err := pool.QueryRow(ctx, `SELECT player_id FROM player_city WHERE server_id=1 AND city_id=10`).Scan(&owner); err != nil || owner != 7 {
		t.Fatal(owner, err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx = creationBegin(t, pool)
	if err := svc.LockCityOwnerInTx(ctx, tx, 1, 10, 7); err != nil {
		t.Fatal(err)
	}
	_ = tx.Rollback(ctx)
	if err := svc.LockCityOwnerInTx(ctx, tx, 1, 10, 7); err != ErrCityOwnershipUnavailable {
		t.Fatal("closed transaction", err)
	}
	tx = creationBegin(t, pool)
	if _, err := tx.Exec(ctx, `DROP TABLE player_city`); err != nil {
		t.Fatal(err)
	}
	if err := svc.LockCityOwnerInTx(ctx, tx, 1, 10, 7); err != ErrCityOwnershipUnavailable {
		t.Fatal("missing schema not sanitized", err)
	}
	_ = tx.Rollback(ctx)
}

// Observe a real blocking relationship, rather than treating a sleep as proof.
func awaitOwnerBlock(t *testing.T, pool *pgxpool.Pool, waiting, holding uint32) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		var blocked bool
		err := pool.QueryRow(ctx, `SELECT $2::int = ANY(pg_blocking_pids($1::int))`, int64(waiting), int64(holding)).Scan(&blocked)
		if err != nil {
			t.Fatal("blocking relationship not observed", err)
		}
		if blocked {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal("ownership UPDATE did not block")
		case <-time.After(5 * time.Millisecond):
		}
	}
}

func TestPGCityOwnerInTxBlocksOwnerUpdateUntilCallerEnds(t *testing.T) {
	pool, ctx := ownerPool(t), context.Background()
	for _, commit := range []bool{false, true} {
		t.Run(map[bool]string{false: "rollback", true: "commit"}[commit], func(t *testing.T) {
			tx := creationBegin(t, pool)
			if err := NewPGStore(nil).LockCityOwnerInTx(ctx, tx, 1, 10, 7); err != nil {
				t.Fatal(err)
			}
			writer, err := pool.Acquire(ctx)
			if err != nil {
				t.Fatal(err)
			}
			bounded, cancel := context.WithTimeout(ctx, 10*time.Second)
			done := make(chan error, 1)
			go func() {
				_, err := writer.Exec(bounded, `UPDATE player_city SET player_id=8 WHERE server_id=1 AND city_id=10`)
				done <- err
			}()
			finished := false
			defer func() {
				cancel()
				_ = tx.Rollback(ctx)
				if !finished {
					<-done
				}
				writer.Release()
			}()
			awaitOwnerBlock(t, pool, writer.Conn().PgConn().PID(), tx.Conn().PgConn().PID())
			if commit {
				err = tx.Commit(ctx)
			} else {
				err = tx.Rollback(ctx)
			}
			if err != nil {
				t.Fatal(err)
			}
			err = <-done
			finished = true
			if err != nil {
				t.Fatal("owner UPDATE did not resume", err)
			}
			check := creationBegin(t, pool)
			if err := NewPGStore(nil).LockCityOwnerInTx(ctx, check, 1, 10, 7); err != ErrCityNotOwned {
				t.Fatal("stale owner accepted", err)
			}
			if err := NewPGStore(nil).LockCityOwnerInTx(ctx, check, 1, 10, 8); err != nil {
				t.Fatal(err)
			}
			_ = check.Rollback(ctx)
			creationSQL(t, pool, `UPDATE player_city SET player_id=7 WHERE server_id=1 AND city_id=10`)
		})
	}
}

func TestPGCityOwnerInTxCancellationWhileWaiting(t *testing.T) {
	pool, ctx := ownerPool(t), context.Background()
	holder, waiter := creationBegin(t, pool), creationBegin(t, pool)
	if err := NewPGStore(nil).LockCityOwnerInTx(ctx, holder, 1, 10, 7); err != nil {
		t.Fatal(err)
	}
	bounded, cancel := context.WithTimeout(ctx, 10*time.Second)
	done := make(chan error, 1)
	go func() { done <- NewPGStore(nil).LockCityOwnerInTx(bounded, waiter, 1, 10, 7) }()
	finished := false
	defer func() {
		cancel()
		_ = holder.Rollback(ctx)
		if !finished {
			<-done
		}
		_ = waiter.Rollback(ctx)
	}()
	awaitOwnerBlock(t, pool, waiter.Conn().PgConn().PID(), holder.Conn().PgConn().PID())
	cancel()
	err := <-done
	finished = true
	if !errors.Is(err, context.Canceled) {
		t.Fatal("cancellation lost", err)
	}
	_ = waiter.Rollback(ctx)
	if err := NewPGStore(nil).LockCityOwnerInTx(ctx, holder, 1, 10, 7); err != nil {
		t.Fatal("holder changed", err)
	}
	if err := holder.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	check := creationBegin(t, pool)
	if err := NewPGStore(nil).LockCityOwnerInTx(ctx, check, 1, 10, 7); err != nil {
		t.Fatal("lock survived rollback", err)
	}
}
