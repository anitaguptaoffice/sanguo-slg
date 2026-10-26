package hero

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestPGFamilyCaptiveSummonRollbackAndTerminalGuards(t *testing.T) {
	ctx, store := context.Background(), identityStore(t)
	actor := PlayerRef{ServerID: 1, PlayerID: 42}
	heroes, meta := &PGStore{}, &PGCaptiveStore{}
	h := &Hero{ServerID: 1, PlayerID: 42, Level: 60, Loyalty: 7, Status: StatusCaptive}
	rec := CaptiveRecord{CityID: 99, SummonItemCfgID: 2049, SummonItemQty: 3}
	tx := beginHotelTestTx(t, store.Pool)
	if err := heroes.CreateHeroInTx(ctx, tx, h); err != nil {
		t.Fatal(err)
	}
	if err := meta.InsertCaptiveInTx(ctx, tx, actor, h.HeroID, rec); err != nil {
		t.Fatal(err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := store.Pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_hero)+(SELECT count(*) FROM player_hero_captive)`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("injection rollback %d %v", count, err)
	}
	h.HeroID = 0
	tx = beginHotelTestTx(t, store.Pool)
	if err := heroes.CreateHeroInTx(ctx, tx, h); err != nil {
		t.Fatal(err)
	}
	if err := meta.InsertCaptiveInTx(ctx, tx, actor, h.HeroID, rec); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	for _, rollback := range []bool{true, false} {
		tx = beginHotelTestTx(t, store.Pool)
		owned, err := heroes.LockPlayerHeroesInTx(ctx, tx, 1, 42)
		if err != nil {
			t.Fatal(err)
		}
		got, err := meta.GetCaptiveInTx(ctx, tx, actor, h.HeroID, true)
		if err != nil || got == nil || *got != rec {
			t.Fatalf("record %+v %v", got, err)
		}
		plan, err := PlanCaptiveSummon(actor, 99, owned[0], got, 1, owned)
		if err != nil || len(plan.ItemDebits) != 1 || plan.ItemDebits[0].ItemCfgID != 2049 {
			t.Fatalf("plan %+v %v", plan, err)
		}
		wrong := actor
		wrong.PlayerID++
		if err := meta.ConsumeCaptiveInTx(ctx, tx, wrong, h.HeroID, rec); !errors.Is(err, ErrHeroNotCaptive) {
			t.Fatal(err)
		}
		if err := meta.ConsumeCaptiveInTx(ctx, tx, actor, h.HeroID, rec); err != nil {
			t.Fatal(err)
		}
		if err := heroes.SetFamilyHeroIdleInTx(ctx, tx, actor, h.HeroID, StatusCaptive, plan.Hero.Loyalty); err != nil {
			t.Fatal(err)
		}
		if err := meta.UpdateCaptiveInTx(ctx, tx, actor, h.HeroID, rec, rec); !errors.Is(err, ErrHeroNotCaptive) {
			t.Fatal(err)
		}
		if err := heroes.DeleteFamilyHeroInTx(ctx, tx, actor, h.HeroID, StatusCaptive); !errors.Is(err, ErrHeroNotCaptive) {
			t.Fatal(err)
		}
		if rollback {
			err = tx.Rollback(ctx)
		} else {
			err = tx.Commit(ctx)
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	// Existing orphan metadata is not adopted, normalized, or removed by reads.
	if _, err := store.Pool.Exec(ctx, `INSERT INTO player_hero_captive VALUES(1,999999,0,2050,-3)`); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	if got, err := meta.GetCaptiveInTx(ctx, tx, actor, 999999, true); err != nil || got != nil {
		t.Fatalf("orphan adopted %+v %v", got, err)
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM player_hero_captive WHERE hero_id=999999 AND summon_item_qty=-3`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("orphan changed %d %v", count, err)
	}
}

func TestPGFamilyMetadataMissingOrMalformedSchemaFailsClosed(t *testing.T) {
	ctx, store := context.Background(), identityStore(t)
	actor := PlayerRef{ServerID: 1, PlayerID: 42}
	for _, tc := range []struct {
		table, column string
		read          func(pgx.Tx) error
	}{
		{"player_hero_coming", "city_id", func(tx pgx.Tx) error { _, err := (&PGComingStore{}).GetComingInTx(ctx, tx, actor, 1, true); return err }},
		{"player_hero_captive", "summon_item_qty", func(tx pgx.Tx) error {
			_, err := (&PGCaptiveStore{}).GetCaptiveInTx(ctx, tx, actor, 1, true)
			return err
		}},
		{"player_hero_lionize", "friend", func(tx pgx.Tx) error { _, err := (&PGLionizeStore{}).ListLionizeInTx(ctx, tx, actor); return err }},
	} {
		t.Run(tc.table, func(t *testing.T) {
			for _, missing := range []bool{true, false} {
				tx := beginHotelTestTx(t, store.Pool)
				sql := "DROP TABLE " + tc.table
				want := "42P01"
				if !missing {
					sql, want = "ALTER TABLE "+tc.table+" DROP COLUMN "+tc.column, "42703"
				}
				if _, err := tx.Exec(ctx, sql); err != nil {
					t.Fatal(err)
				}
				err := tc.read(tx)
				var pgErr *pgconn.PgError
				if !errors.As(err, &pgErr) || pgErr.Code != want {
					t.Fatalf("did not fail closed: %v", err)
				}
				if err := tx.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}

func TestPGFamilyMetadataLocksUseSuppliedTransaction(t *testing.T) {
	ctx, store := context.Background(), identityStore(t)
	actor, heroes := PlayerRef{ServerID: 1, PlayerID: 42}, &PGStore{}
	coming := &Hero{ServerID: 1, PlayerID: 42, Level: 1, Loyalty: 70, Status: StatusComing}
	captive := &Hero{ServerID: 1, PlayerID: 42, Level: 1, Loyalty: 50, Status: StatusCaptive}
	tx := beginHotelTestTx(t, store.Pool)
	for _, h := range []*Hero{coming, captive} {
		if err := heroes.CreateHeroInTx(ctx, tx, h); err != nil {
			t.Fatal(err)
		}
	}
	if err := (&PGComingStore{}).InsertComingInTx(ctx, tx, actor, coming.HeroID, ComingRecord{CityID: 99}); err != nil {
		t.Fatal(err)
	}
	if err := (&PGCaptiveStore{}).InsertCaptiveInTx(ctx, tx, actor, captive.HeroID, CaptiveRecord{CityID: 99}); err != nil {
		t.Fatal(err)
	}
	if err := (&PGLionizeStore{}).CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, nil, LionizeRecord{State: 1, Friend: 10}); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	// These low-level lock probes do not claim API wallet/city/item coordination.
	for _, read := range []func(pgx.Tx, bool) error{
		func(tx pgx.Tx, lock bool) error {
			_, err := (&PGComingStore{}).GetComingInTx(ctx, tx, actor, coming.HeroID, lock)
			return err
		},
		func(tx pgx.Tx, lock bool) error {
			_, err := (&PGCaptiveStore{}).GetCaptiveInTx(ctx, tx, actor, captive.HeroID, lock)
			return err
		},
		func(tx pgx.Tx, lock bool) error {
			_, err := (&PGLionizeStore{}).GetLionizeInTx(ctx, tx, actor, 1001, lock)
			return err
		},
	} {
		first, second := beginHotelTestTx(t, store.Pool), beginHotelTestTx(t, store.Pool)
		if err := read(first, true); err != nil {
			t.Fatal(err)
		}
		if err := read(second, false); err != nil {
			t.Fatal(err)
		}
		if _, err := second.Exec(ctx, "SET LOCAL lock_timeout='50ms'"); err != nil {
			t.Fatal(err)
		}
		err := read(second, true)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "55P03" {
			t.Fatalf("metadata lock missing: %v", err)
		}
		if err := second.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
		if err := first.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
	}
}

func TestPGFamilyConcurrentStaleLionizeCannotOverwriteHire(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	store := identityStore(t)
	actor, meta := PlayerRef{ServerID: 1, PlayerID: 42}, &PGLionizeStore{}
	old := LionizeRecord{State: 1, Friend: 30}
	seed := beginHotelTestTx(t, store.Pool)
	if err := meta.CompareAndSwapLionizeInTx(ctx, seed, actor, 1001, nil, old); err != nil {
		t.Fatal(err)
	}
	if err := seed.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	first, second := beginHotelTestTx(t, store.Pool), beginHotelTestTx(t, store.Pool)
	if _, err := meta.GetLionizeInTx(ctx, first, actor, 1001, true); err != nil {
		t.Fatal(err)
	}
	hire := old
	hire.State = 2
	if err := meta.CompareAndSwapLionizeInTx(ctx, first, actor, 1001, &old, hire); err != nil {
		t.Fatal(err)
	}
	var pid int
	if err := second.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&pid); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() {
		done <- meta.CompareAndSwapLionizeInTx(ctx, second, actor, 1001, &old, LionizeRecord{State: 1, Friend: 20})
	}()
	// Observe real server waiting rather than assuming goroutine scheduling/order.
	for {
		var waiting bool
		if err := store.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock')`, pid).Scan(&waiting); err != nil {
			t.Fatal(err)
		}
		if waiting {
			break
		}
		select {
		case err := <-done:
			t.Fatalf("stale CAS unexpectedly finished: %v", err)
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(time.Millisecond):
		}
	}
	if err := first.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err := <-done; !errors.Is(err, ErrInvalidFamilyState) {
		t.Fatalf("stale CAS %v", err)
	}
	if err := second.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx := beginHotelTestTx(t, store.Pool)
	got, err := meta.GetLionizeInTx(ctx, tx, actor, 1001, true)
	if err != nil || got == nil || *got != hire {
		t.Fatalf("terminal regressed %+v %v", got, err)
	}
}
