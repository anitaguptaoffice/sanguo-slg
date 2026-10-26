package domestic

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func atomicCityPlayer(t *testing.T, p *pgxpool.Pool) {
	t.Helper()
	var account int64
	if err := p.QueryRow(context.Background(), "INSERT INTO account(login_name,password_hash) VALUES('atomic-city','unused') RETURNING account_id").Scan(&account); err != nil {
		t.Fatal(err)
	}
	productionSQL(t, p, "INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,42,$1,'fixture')", account)
}

func atomicCityTemplate() *CityState {
	return &CityState{PlayerID: 42, Wallet: Resources{8000, 8000, 5000, 5000},
		LastSettleAt: time.Unix(1, 0), productionRemainder: [4]int64{1, 2, 3, 4},
		Buildings: map[string]*BuildingInstance{"hall": {1, 1}, "farm": {2, 1}}}
}

// This test participant models only WORLD's tx boundary; actual terrain/ID
// validation belongs to the separately reviewed WORLD participant and API tests.
func atomicWorld(id int64) NewCityWorldParticipant {
	return func(ctx context.Context, tx pgx.Tx) (int64, error) {
		_, err := tx.Exec(ctx, "INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,$1,42,'atomic',$2,1)", id, int32(id))
		return id, err
	}
}

func TestAtomicCityRequiresDurableStoreAndCancelableHubLock(t *testing.T) {
	h, initial := NewHub(nil), atomicCityTemplate()
	called := false
	cb := func(context.Context, pgx.Tx) (int64, error) { called = true; return 1, nil }
	if _, err := h.CreateNewCity(context.Background(), 1, initial, cb); !errors.Is(err, ErrAtomicCityCreation) || called {
		t.Fatal("memory fallback", err, called)
	}
	h.mu.Lock()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	done := make(chan error, 1)
	go func() { _, err := h.CreateNewCity(ctx, 1, initial, cb); done <- err }()
	select {
	case err := <-done:
		if !errors.Is(err, context.DeadlineExceeded) || called {
			t.Error("blocked mutex", err, called)
		}
	case <-time.After(time.Second):
		t.Error("creation ignored cancellation while Hub locked")
	}
	h.mu.Unlock()
}

func TestPGAtomicCityCommitSharedWalletAndReload(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	atomicCityPlayer(t, pool)
	now := time.Unix(1700000000, 123456789)
	h := productionHub(pool, &now)
	if !h.SupportsAtomicCityCreation(pool, 1) || h.SupportsAtomicCityCreation(nil, 1) || h.SupportsAtomicCityCreation(pool, 2) {
		t.Fatal("pool/shard provenance")
	}
	other, err := pgxpool.NewWithConfig(ctx, pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(other.Close)
	if h.SupportsAtomicCityCreation(other, 1) {
		t.Fatal("distinct pool accepted")
	}
	initial := atomicCityTemplate()
	before := cloneCity(initial)
	before.BuildJobs = nil // cloneCity normalizes nil to empty; preserve exact input shape.
	calls := 0
	id, err := h.CreateNewCity(ctx, 1, initial, func(ctx context.Context, tx pgx.Tx) (int64, error) {
		calls++
		var food int64
		if err := tx.QueryRow(ctx, "SELECT food FROM player_wallet WHERE server_id=1 AND player_id=42").Scan(&food); err != nil || food != 8000 {
			return 0, fmt.Errorf("wallet not staged: %d %v", food, err)
		}
		return atomicWorld(1)(ctx, tx)
	})
	if err != nil || id != 1 || calls != 1 || !reflect.DeepEqual(initial, before) {
		t.Fatal("creation/input", id, calls, err)
	}
	city, err := h.SnapshotCity(id)
	if err != nil || !city.LastSettleAt.Equal(now) || city.productionRemainder != [4]int64{} || city.Wallet != initial.Wallet {
		t.Fatal("published state", city, err)
	}
	oldTime := now
	now = now.Add(time.Hour)
	initial.Wallet.Food = 999999
	if _, err := h.CreateNewCity(ctx, 1, initial, atomicWorld(2)); err != nil {
		t.Fatal(err)
	}
	second, _ := h.SnapshotCity(2)
	if second.Wallet.Food != 8000 || !second.LastSettleAt.Equal(now) {
		t.Fatal("second city regranted/backdated", second)
	}
	fresh := productionHub(pool, &now)
	loaded, err := fresh.LoadCity(ctx, 1, 42)
	if err != nil || !loaded.LastSettleAt.Equal(oldTime) || loaded.Wallet.Food != 8000 {
		t.Fatal("complete state after lost response/restart", loaded, err)
	}
	if _, err := h.CreateNewCity(ctx, 2, initial, atomicWorld(3)); !errors.Is(err, ErrAtomicCityCreation) {
		t.Fatal("configured shard mismatch", err)
	}
}

func TestPGAtomicCityFailuresRollBackAllState(t *testing.T) {
	for _, mode := range []string{"participant", "invalid_id", "domestic_sql", "commit", "missing_player"} {
		t.Run(mode, func(t *testing.T) {
			pool, ctx := productionTestPool(t), context.Background()
			if mode != "missing_player" {
				atomicCityPlayer(t, pool)
			}
			if mode == "domestic_sql" {
				productionSQL(t, pool, "ALTER TABLE city_building ADD CONSTRAINT reject_atomic CHECK(level<0)")
			}
			if mode == "commit" {
				productionSQL(t, pool, `CREATE FUNCTION reject_atomic_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'atomic commit rejected'; END $$;
 CREATE CONSTRAINT TRIGGER reject_atomic_commit AFTER INSERT ON city_production_checkpoint DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_atomic_commit()`)
			}
			now := time.Unix(1700000000, 999)
			h, initial := productionHub(pool, &now), atomicCityTemplate()
			before := cloneCity(initial)
			initial.BuildJobs = []*BuildJob{{ID: 1, Slot: "farm", CfgID: 2, Target: 2, Status: QueueActive, FinishAt: now}}
			before.BuildJobs = initial.BuildJobs
			rejected, inserted := errors.New("participant rejected after insert"), 0
			_, err := h.CreateNewCity(ctx, 1, initial, func(ctx context.Context, tx pgx.Tx) (int64, error) {
				id, err := atomicWorld(1)(ctx, tx)
				if err != nil {
					return 0, err
				}
				inserted++
				if mode == "participant" {
					return 0, rejected
				}
				if mode == "invalid_id" {
					return 0, nil
				}
				return id, nil
			})
			if err == nil || inserted != 1 || len(h.cities) != 0 || len(h.sched.q) != 0 || !reflect.DeepEqual(initial, before) {
				t.Fatal("failure published or changed input", err)
			}
			var pgErr *pgconn.PgError
			switch mode {
			case "participant":
				if !errors.Is(err, rejected) {
					t.Fatal("wrong failure", err)
				}
			case "invalid_id":
				if !errors.Is(err, ErrAtomicCityCreation) {
					t.Fatal("wrong failure", err)
				}
			case "missing_player":
				if !errors.Is(err, ErrProductionOwnerMismatch) {
					t.Fatal("wrong failure", err)
				}
			case "domestic_sql":
				if !errors.As(err, &pgErr) || pgErr.Code != "23514" {
					t.Fatal("wrong failure", err)
				}
			case "commit":
				if !errors.As(err, &pgErr) || pgErr.Code != "P0001" {
					t.Fatal("wrong failure", err)
				}
			}
			var rows int
			if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_city)+(SELECT count(*) FROM player_wallet)+
 (SELECT count(*) FROM city_production_checkpoint)+(SELECT count(*) FROM city_building)+(SELECT count(*) FROM work_queue)`).Scan(&rows); err != nil || rows != 0 {
				t.Fatal("partial creation survived", rows, err)
			}
		})
	}
}

func TestPGAtomicCityWaitingForHubDoesNotLockWallet(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	atomicCityPlayer(t, pool)
	productionSQL(t, pool, "INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,42,123)")
	now := time.Now()
	h := productionHub(pool, &now)
	h.mu.Lock()
	short, cancel := context.WithTimeout(ctx, 30*time.Millisecond)
	defer cancel()
	done := make(chan error, 1)
	go func() { _, err := h.CreateNewCity(short, 1, atomicCityTemplate(), atomicWorld(1)); done <- err }()
	tx, err := pool.Begin(ctx)
	if err != nil {
		h.mu.Unlock()
		t.Fatal(err)
	}
	_, lockErr := tx.Exec(ctx, "SELECT food FROM player_wallet WHERE server_id=1 AND player_id=42 FOR UPDATE NOWAIT")
	_ = tx.Rollback(ctx)
	select {
	case err = <-done:
	case <-time.After(time.Second):
		h.mu.Unlock()
		t.Fatal("Hub wait did not honor deadline")
	}
	h.mu.Unlock()
	if lockErr != nil || !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal("wallet acquired before Hub", lockErr, err)
	}
}

func TestPGAtomicCityWalletCancellationPrecedesParticipant(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	atomicCityPlayer(t, pool)
	productionSQL(t, pool, "INSERT INTO player_wallet(server_id,player_id,food,gold) VALUES(1,42,123,55)")
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "SELECT food FROM player_wallet WHERE server_id=1 AND player_id=42 FOR UPDATE"); err != nil {
		t.Fatal(err)
	}
	now, called := time.Now(), false
	h := productionHub(pool, &now)
	short, cancel := context.WithTimeout(ctx, 30*time.Millisecond)
	defer cancel()
	_, err = h.CreateNewCity(short, 1, atomicCityTemplate(), func(ctx context.Context, tx pgx.Tx) (int64, error) {
		called = true
		return atomicWorld(1)(ctx, tx)
	})
	if !errors.Is(err, context.DeadlineExceeded) || called || len(h.cities) != 0 {
		t.Fatal("wallet wait published/called participant", err, called)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := h.CreateNewCity(ctx, 1, atomicCityTemplate(), atomicWorld(1)); err != nil {
		t.Fatal("known uncommitted retry", err)
	}
	var food, gold int64
	if err := pool.QueryRow(ctx, "SELECT food,gold FROM player_wallet WHERE server_id=1 AND player_id=42").Scan(&food, &gold); err != nil || food != 123 || gold != 55 {
		t.Fatal("existing wallet changed", food, gold, err)
	}
}
