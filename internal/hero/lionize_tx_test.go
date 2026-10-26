package hero

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestPGFamilyLionizeMetadataAtomicProgressHireAndNoRegression(t *testing.T) {
	ctx, store := context.Background(), identityStore(t)
	actor, city := PlayerRef{ServerID: 1, PlayerID: 42}, CityRef{CityID: 99}
	meta, heroes, svc := &PGLionizeStore{}, &PGStore{}, NewService()
	now := time.Unix(1_700_100_000, 0).UTC()
	svc.SetClock(func() time.Time { return now })
	tx := beginHotelTestTx(t, store.Pool)
	got, err := meta.GetLionizeInTx(ctx, tx, actor, 1001, true)
	if err != nil || got != nil {
		t.Fatalf("absent %+v %v", got, err)
	}
	befriend, err := svc.PlanLionize(actor, city, 1001, got, 1, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, got, befriend.Record); err != nil {
		t.Fatal(err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	got, err = meta.GetLionizeInTx(ctx, tx, actor, 1001, true)
	if err != nil || got != nil {
		t.Fatalf("rollback %+v %v", got, err)
	}
	if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, nil, befriend.Record); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	var previous LionizeRecord
	for i := 0; i < 2; i++ {
		tx = beginHotelTestTx(t, store.Pool)
		got, err = meta.GetLionizeInTx(ctx, tx, actor, 1001, true)
		if err != nil || got == nil {
			t.Fatalf("progress %+v %v", got, err)
		}
		if i == 0 && !got.LastPersuadeAt.IsZero() {
			t.Fatal("NULL timestamp fabricated")
		}
		previous = *got
		plan, err := svc.PlanPersuade(actor, city, 1001, got)
		if err != nil {
			t.Fatal(err)
		}
		if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, got, plan.Record); err != nil {
			t.Fatal(err)
		}
		if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, got, plan.Record); !errors.Is(err, ErrInvalidFamilyState) {
			t.Fatalf("stale persuade %v", err)
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		now = now.Add(24 * time.Hour)
	}
	var reserved int64
	for _, rollback := range []bool{true, false} {
		tx = beginHotelTestTx(t, store.Pool)
		owned, err := heroes.LockPlayerHeroesInTx(ctx, tx, 1, 42)
		if err != nil || len(owned) != 0 {
			t.Fatalf("pre-hire %+v %v", owned, err)
		}
		got, err = meta.GetLionizeInTx(ctx, tx, actor, 1001, true)
		if err != nil || got.State != LionizeStateBefriended || got.Friend != 30 {
			t.Fatalf("hire prestate %+v %v", got, err)
		}
		plan, err := svc.PlanLionize(actor, city, 1001, got, 1, owned)
		if err != nil {
			t.Fatal(err)
		}
		if err := heroes.CreateHeroInTx(ctx, tx, plan.Result.Hero); err != nil {
			t.Fatal(err)
		}
		if plan.Result.Hero.HeroID <= reserved {
			t.Fatal("rolled-back identity reused")
		}
		reserved = plan.Result.Hero.HeroID
		if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, got, plan.Record); err != nil {
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
	tx = beginHotelTestTx(t, store.Pool)
	got, err = meta.GetLionizeInTx(ctx, tx, actor, 1001, true)
	if err != nil || got.State != LionizeStateRecruited {
		t.Fatalf("terminal %+v %v", got, err)
	}
	if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, nil, befriend.Record); !errors.Is(err, ErrInvalidFamilyState) {
		t.Fatal(err)
	}
	if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, &previous, befriend.Record); !errors.Is(err, ErrInvalidFamilyState) {
		t.Fatal(err)
	}
	if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, got, befriend.Record); !errors.Is(err, ErrLionizeAlreadyDone) {
		t.Fatal(err)
	}
	owned, err := heroes.ListPlayerHeroesInTx(ctx, tx, 1, 42)
	if err != nil || len(owned) != 1 || owned[0].HeroID != reserved {
		t.Fatalf("hero count %+v %v", owned, err)
	}
}

func TestPGFamilyLionizeMetadataListsExactRowsAndScopes(t *testing.T) {
	ctx, store := context.Background(), identityStore(t)
	if _, err := store.Pool.Exec(ctx, `INSERT INTO player_hero_lionize(server_id,player_id,npc_cfg_id,friend,state,last_persuade_at)
		VALUES(1,42,1001,0,0,NULL),(1,42,7777,-5,8,'2024-01-02 03:04:05+00'),(2,42,1001,21,1,NULL),(1,43,1001,22,1,NULL)`); err != nil {
		t.Fatal(err)
	}
	tx := beginHotelTestTx(t, store.Pool)
	meta, actor := &PGLionizeStore{}, PlayerRef{ServerID: 1, PlayerID: 42}
	rows, err := meta.ListLionizeInTx(ctx, tx, actor)
	if err != nil || len(rows) != 2 || rows[7777].Friend != -5 || rows[7777].State != 8 || !rows[1001].LastPersuadeAt.IsZero() {
		t.Fatalf("raw rows %+v %v", rows, err)
	}
	got, err := meta.GetLionizeInTx(ctx, tx, actor, 7777, false)
	if err != nil || !reflect.DeepEqual(*got, rows[7777]) || got.LastPersuadeAt.IsZero() {
		t.Fatalf("raw timestamp %+v %v", got, err)
	}
	other, err := meta.ListLionizeInTx(ctx, tx, PlayerRef{ServerID: 2, PlayerID: 42})
	if err != nil || len(other) != 1 || other[1001].Friend != 21 {
		t.Fatalf("shard rows %+v %v", other, err)
	}
	current := rows[1001]
	next := LionizeRecord{Friend: 10, State: 1}
	if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 1001, &current, next); err != nil {
		t.Fatal(err)
	}
	if err := meta.CompareAndSwapLionizeInTx(ctx, tx, actor, 7777, got, next); !errors.Is(err, ErrInvalidFamilyState) {
		t.Fatal(err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestFamilyLionizeTxRejectsInvalidBeforeSQL(t *testing.T) {
	ctx, actor, meta := context.Background(), PlayerRef{ServerID: 1, PlayerID: 42}, &PGLionizeStore{}
	_, get := meta.GetLionizeInTx(ctx, nil, actor, 1001, true)
	_, list := meta.ListLionizeInTx(ctx, nil, actor)
	for _, err := range []error{get, list, meta.CompareAndSwapLionizeInTx(ctx, nil, actor, 1001, nil, LionizeRecord{State: 1})} {
		if !errors.Is(err, ErrFamilyTransactionRequired) {
			t.Fatal(err)
		}
	}
	if _, err := meta.GetLionizeInTx(ctx, hotelNoSQL{}, actor, 0, true); !errors.Is(err, ErrInvalidFamilyState) {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		old  *LionizeRecord
		next LionizeRecord
		want error
	}{
		{nil, LionizeRecord{State: 2}, ErrInvalidFamilyState}, {&LionizeRecord{State: 2}, LionizeRecord{State: 1}, ErrLionizeAlreadyDone},
		{&LionizeRecord{}, LionizeRecord{State: 2}, ErrInvalidFamilyState}, {&LionizeRecord{State: 1}, LionizeRecord{}, ErrInvalidFamilyState},
	} {
		if err := meta.CompareAndSwapLionizeInTx(ctx, hotelNoSQL{}, actor, 1001, tc.old, tc.next); !errors.Is(err, tc.want) {
			t.Fatalf("error %v want %v", err, tc.want)
		}
	}
}
