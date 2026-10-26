package hero

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestPGFamilyHeroTxConditionalTransitionsAndRollback(t *testing.T) {
	store, ctx := identityStore(t), context.Background()
	actor := PlayerRef{ServerID: 1, PlayerID: 42}
	h := &Hero{ServerID: 1, PlayerID: 42, Level: 11, Exp: 31, Loyalty: 70, Force: 87, Status: StatusComing}
	if err := store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	port := &PGStore{} // No pool use, no lazy schema setup.
	tx := beginHotelTestTx(t, store.Pool)
	rows, err := port.LockPlayerHeroesInTx(ctx, tx, 1, 42)
	if err != nil || len(rows) != 1 || !reflect.DeepEqual(rows[0], h) {
		t.Fatalf("rows %+v %v", rows, err)
	}
	if err := port.SetFamilyHeroIdleInTx(ctx, tx, actor, h.HeroID, StatusComing, 81); err != nil {
		t.Fatal(err)
	}
	if err := port.DeleteFamilyHeroInTx(ctx, tx, actor, h.HeroID, StatusComing); !errors.Is(err, ErrHeroNotComing) {
		t.Fatal(err)
	}
	if err := port.SetFamilyHeroIdleInTx(ctx, tx, actor, h.HeroID, StatusComing, 7); !errors.Is(err, ErrHeroNotComing) {
		t.Fatal(err)
	}
	var optional int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='player_hero' AND column_name='force_add'`).Scan(&optional); err != nil || optional != 0 {
		t.Fatalf("DDL issued %d %v", optional, err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	rows, err = port.LockPlayerHeroesInTx(ctx, tx, 1, 42)
	if err != nil || len(rows) != 1 || !reflect.DeepEqual(rows[0], h) {
		t.Fatalf("rollback %+v %v", rows, err)
	}
	if _, err := tx.Exec(ctx, heroPointAddColumnsDDL); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE player_hero SET force_add=3,intel_add=4,politics_add=5`); err != nil {
		t.Fatal(err)
	}
	if err := port.SetFamilyHeroIdleInTx(ctx, tx, actor, h.HeroID, StatusComing, 81); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	rows, err = port.LockPlayerHeroesInTx(ctx, tx, 1, 42)
	want := *h
	want.Status, want.Loyalty, want.ForceAdd, want.IntelAdd, want.PoliticsAdd = StatusIdle, 81, 3, 4, 5
	if err != nil || len(rows) != 1 || !reflect.DeepEqual(rows[0], &want) {
		t.Fatalf("preservation %+v want %+v %v", rows, want, err)
	}
}

func TestPGFamilyHeroTxDeleteExactScopeAndNoResurrection(t *testing.T) {
	store, ctx := identityStore(t), context.Background()
	actor, port := PlayerRef{ServerID: 1, PlayerID: 42}, &PGStore{}
	h := &Hero{ServerID: 1, PlayerID: 42, Level: 1, Loyalty: 50, Status: StatusCaptive}
	if err := store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool.Exec(ctx, `INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(2,$1,42,0,6)`, h.HeroID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool.Exec(ctx, `INSERT INTO hero_assignment(server_id,hero_id,assign_type,target_id) VALUES(1,$1,1,7),(2,$1,1,8)`, h.HeroID); err != nil {
		t.Fatal(err)
	}
	tx := beginHotelTestTx(t, store.Pool)
	if err := port.DeleteFamilyHeroInTx(ctx, tx, PlayerRef{ServerID: 1, PlayerID: 41}, h.HeroID, StatusCaptive); !errors.Is(err, ErrHeroNotCaptive) {
		t.Fatal(err)
	}
	if err := port.DeleteFamilyHeroInTx(ctx, tx, actor, h.HeroID, StatusComing); !errors.Is(err, ErrHeroNotComing) {
		t.Fatal(err)
	}
	if err := port.DeleteFamilyHeroInTx(ctx, tx, actor, h.HeroID, StatusCaptive); err != nil {
		t.Fatal(err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	if err := port.DeleteFamilyHeroInTx(ctx, tx, actor, h.HeroID, StatusCaptive); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	if err := port.DeleteFamilyHeroInTx(ctx, tx, actor, h.HeroID, StatusCaptive); !errors.Is(err, ErrHeroNotCaptive) {
		t.Fatal(err)
	}
	if err := port.SetFamilyHeroIdleInTx(ctx, tx, actor, h.HeroID, StatusCaptive, 50); !errors.Is(err, ErrHeroNotCaptive) {
		t.Fatal(err)
	}
	var heroes, assignments int
	if err := tx.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_hero),(SELECT count(*) FROM hero_assignment)`).Scan(&heroes, &assignments); err != nil || heroes != 1 || assignments != 1 {
		t.Fatalf("scope %d %d %v", heroes, assignments, err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := port.LockPlayerHeroesInTx(ctx, tx, 1, 42); !errors.Is(err, pgx.ErrTxClosed) {
		t.Fatal(err)
	}
}

func TestFamilyHeroTxRejectsInvalidBeforeSQL(t *testing.T) {
	ctx, port := context.Background(), &PGStore{}
	actor := PlayerRef{ServerID: 1, PlayerID: 2}
	for _, tx := range []pgx.Tx{nil, hotelNoSQL{}} {
		want, p := ErrFamilyTransactionRequired, actor
		if tx != nil {
			want, p = ErrInvalidFamilyState, PlayerRef{}
		}
		_, readErr := port.LockPlayerHeroesInTx(ctx, tx, p.ServerID, p.PlayerID)
		for _, err := range []error{readErr, port.SetFamilyHeroIdleInTx(ctx, tx, p, 3, StatusComing, 70), port.DeleteFamilyHeroInTx(ctx, tx, p, 3, StatusCaptive)} {
			if !errors.Is(err, want) {
				t.Fatalf("error %v want %v", err, want)
			}
		}
	}
	for _, err := range []error{port.SetFamilyHeroIdleInTx(ctx, hotelNoSQL{}, actor, 3, StatusIdle, 70), port.DeleteFamilyHeroInTx(ctx, hotelNoSQL{}, actor, 0, StatusComing)} {
		if !errors.Is(err, ErrInvalidFamilyState) {
			t.Fatal(err)
		}
	}
}
