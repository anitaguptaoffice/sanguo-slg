package domestic

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func hotelLevelsFixture(t *testing.T) (*pgxpool.Pool, *Hub) {
	t.Helper()
	pool, now := productionTestPool(t), time.Unix(1700000000, 0)
	h := productionHub(pool, &now)
	productionCity(t, h, 1, 42)
	productionSQL(t, pool, `DELETE FROM city_building;
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES
		(1,1,'hotel-a',8,2),(1,1,'hotel-b',8,4),(1,1,'office-a',1,3),(1,1,'office-b',1,5),
		(1,1,'unrelated',9,99),(2,1,'hotel',8,88),(1,2,'hotel',8,77)`)
	return pool, h
}

// Fixture coordinator only: production actor/owner authorization belongs to API
// and WORLD, not to the domestic participant.
func hotelLevelsLockedTx(t *testing.T, pool *pgxpool.Pool) pgx.Tx {
	t.Helper()
	tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	for _, sql := range []string{
		"SELECT player_id FROM player WHERE server_id=1 AND player_id=42 FOR KEY SHARE",
		"SELECT player_id FROM player_wallet WHERE server_id=1 AND player_id=42 FOR UPDATE",
		"SELECT player_id FROM player_city WHERE server_id=1 AND city_id=1 AND player_id=42 FOR UPDATE",
	} {
		var id int64
		if err := tx.QueryRow(context.Background(), sql).Scan(&id); err != nil || id != 42 {
			t.Fatal("fixture lock", id, err)
		}
	}
	return tx
}

func TestHotelLevelsPortRejectsUnavailableWiring(t *testing.T) {
	var nilHub *Hub
	if nilHub.HotelLevelsPort() != nil || NewHub(nil).HotelLevelsPort() != nil {
		t.Fatal("memory-only port")
	}
	var p *HotelLevelPort
	if p.Supports(nil, 1) {
		t.Fatal("nil provenance")
	}
	if _, err := p.LevelsInTx(context.Background(), nil, 1, 1); !errors.Is(err, ErrHotelLevelsUnavailable) {
		t.Fatal(err)
	}
}

func TestPGHotelLevelsTxCommittedLocalRollbackAndScope(t *testing.T) {
	pool, h := hotelLevelsFixture(t)
	p, ctx := h.HotelLevelsPort(), context.Background()
	if !p.Supports(pool, 1) || p.Supports(nil, 1) || p.Supports(pool, 2) || p.Supports(pool, 0) {
		t.Fatal("provenance")
	}
	tx := hotelLevelsLockedTx(t, pool)
	check := func(city int64, want HotelLevels) {
		t.Helper()
		got, err := p.LevelsInTx(ctx, tx, 1, city)
		if err != nil || got != want {
			t.Fatal("levels", got, want, err)
		}
	}
	check(1, HotelLevels{4, 5})
	check(2, HotelLevels{77, 0}) // No implicit authorization; caller owns that check.
	check(999, HotelLevels{})
	for _, scope := range []struct {
		sid  int32
		city int64
	}{{2, 1}, {0, 1}, {1, 0}, {1, -1}} {
		if _, err := p.LevelsInTx(ctx, tx, scope.sid, scope.city); !errors.Is(err, ErrHotelLevelsUnavailable) {
			t.Fatal("invalid scope", scope, err)
		}
	}
	if _, err := p.LevelsInTx(ctx, nil, 1, 1); !errors.Is(err, ErrHotelLevelsUnavailable) {
		t.Fatal("nil tx", err)
	}
	if _, err := tx.Exec(ctx, "UPDATE city_building SET level=12 WHERE server_id=1 AND city_id=1 AND building_cfg_id=8"); err != nil {
		t.Fatal(err)
	}
	check(1, HotelLevels{12, 5})
	if _, err := tx.Exec(ctx, "DELETE FROM city_building WHERE server_id=1 AND city_id=1"); err != nil {
		t.Fatal(err)
	}
	check(1, HotelLevels{})
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx = hotelLevelsLockedTx(t, pool)
	check(1, HotelLevels{4, 5})
	if _, err := tx.Exec(ctx, "UPDATE city_building SET level=-2 WHERE server_id=1 AND city_id=1 AND building_cfg_id=8"); err != nil {
		t.Fatal(err)
	}
	check(1, HotelLevels{-2, 5}) // Preserve MAX rather than adding a floor/rule.
	if _, err := tx.Exec(ctx, "ALTER TABLE city_building RENAME TO unavailable_building"); err != nil {
		t.Fatal(err)
	}
	if got, err := p.LevelsInTx(ctx, tx, 1, 1); !errors.Is(err, ErrHotelLevelsUnavailable) || got != (HotelLevels{}) {
		t.Fatal("missing table error not sanitized", got, err)
	}
}

func TestPGHotelLevelsTxSanitizedFailuresAndCancellation(t *testing.T) {
	pool, h := hotelLevelsFixture(t)
	p := h.HotelLevelsPort()
	for _, mode := range []string{"closed", "private_diagnostic", "canceled", "deadline"} {
		t.Run(mode, func(t *testing.T) {
			tx := hotelLevelsLockedTx(t, pool)
			ctx, want := context.Background(), ErrHotelLevelsUnavailable
			switch mode {
			case "closed":
				if err := tx.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
			case "private_diagnostic":
				_, err := tx.Exec(ctx, `ALTER TABLE city_building RENAME TO hidden_city_building;
					CREATE FUNCTION private_level_check() RETURNS int LANGUAGE plpgsql AS $$
					BEGIN RAISE EXCEPTION 'private-schema private-sql private-diagnostic'; END $$;
					CREATE VIEW city_building AS SELECT 1 AS server_id,1::bigint AS city_id,
					8 AS building_cfg_id,private_level_check() AS level`)
				if err != nil {
					t.Fatal(err)
				}
			case "canceled":
				var cancel context.CancelFunc
				ctx, cancel = context.WithCancel(ctx)
				cancel()
				want = context.Canceled
			case "deadline":
				var cancel context.CancelFunc
				ctx, cancel = context.WithDeadline(ctx, time.Now().Add(-time.Second))
				defer cancel()
				want = context.DeadlineExceeded
			}
			got, err := p.LevelsInTx(ctx, tx, 1, 1)
			if !errors.Is(err, want) || err.Error() != want.Error() || got != (HotelLevels{}) {
				t.Fatal("unsanitized error or lost cancellation identity", got, err, "want", want)
			}
		})
	}
}

func TestPGHotelLevelsTxSingleConnectionAndFrozenProvenance(t *testing.T) {
	base, _ := hotelLevelsFixture(t)
	cfg := base.Config()
	cfg.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	h := NewHub(nil)
	store := NewPGStore(pool)
	h.UseStore(store, 1, 0)
	p := h.HotelLevelsPort()
	if p.Supports(base, 1) {
		t.Fatal("distinct pool accepted")
	}
	tx := hotelLevelsLockedTx(t, pool)
	before := pool.Stat().AcquireCount()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	got, err := p.LevelsInTx(ctx, tx, 1, 1)
	if err != nil || got != (HotelLevels{4, 5}) || pool.Stat().AcquireCount() != before || pool.Stat().AcquiredConns() != 1 {
		t.Fatal("participant acquired another connection", got, err, pool.Stat())
	}
	// Startup mutations are sequential here: no concurrent rewiring is supported.
	for _, rewire := range []func(){
		func() { store.Pool = base },
		func() { store.Pool = pool; h.UseStore(NewPGStore(pool), 1, 0) },
		func() { h.UseStore(store, 2, 0) },
		func() { h.UseStore(nil, 1, 0) },
	} {
		rewire()
		if p.Supports(pool, 1) || p.Supports(base, 1) {
			t.Fatal("retargeted provenance")
		}
		if _, err := p.LevelsInTx(ctx, tx, 1, 1); !errors.Is(err, ErrHotelLevelsUnavailable) {
			t.Fatal("rewired read", err)
		}
	}
}

func TestPGHotelLevelsTxDoesNotInvertHubWalletOrder(t *testing.T) {
	pool, h := hotelLevelsFixture(t)
	p, tx := h.HotelLevelsPort(), hotelLevelsLockedTx(t, pool)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	writer := make(chan error, 1)
	go func() { _, err := h.SettleCity(ctx, 1); writer <- err }()
	// Observe the real DOM writer blocked on our wallet, while holding Hub.
	for {
		var blocked bool
		err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity
			WHERE datname=current_database() AND wait_event_type='Lock'
			AND query LIKE 'SELECT food,wood,stone,iron FROM player_wallet%')`).Scan(&blocked)
		if err != nil {
			t.Fatal(err)
		}
		if blocked {
			break
		}
		select {
		case err := <-writer:
			t.Fatal("writer did not wait", err)
		case <-time.After(time.Millisecond):
		}
	}
	read := make(chan error, 1)
	go func() {
		got, err := p.LevelsInTx(ctx, tx, 1, 1)
		if err == nil && got != (HotelLevels{4, 5}) {
			err = errors.New("read nonpersisted or partially rewritten levels")
		}
		read <- err
	}()
	select {
	case err := <-read:
		if err != nil {
			t.Error(err)
		}
	case <-ctx.Done():
		t.Error("level reader waited on Hub while holding wallet")
	}
	if err := tx.Rollback(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := <-writer; err != nil {
		t.Fatal("DOM writer did not resume", err)
	}
}
