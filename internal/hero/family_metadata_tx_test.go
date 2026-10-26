package hero

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

func TestPGFamilyComingMetadataAtomicExactAndReversedOrder(t *testing.T) {
	ctx, store := context.Background(), identityStore(t) // Actual ApplySpecs provisions metadata.
	actor := PlayerRef{ServerID: 1, PlayerID: 42}
	heroes, meta := &PGStore{}, &PGComingStore{} // Nil pools prohibit legacy fallback.
	h := &Hero{ServerID: 1, PlayerID: 42, Level: 1, Loyalty: 0, Status: StatusComing}
	rec := ComingRecord{CityID: 99}
	tx := beginHotelTestTx(t, store.Pool)
	if err := heroes.CreateHeroInTx(ctx, tx, h); err != nil {
		t.Fatal(err)
	}
	if err := meta.InsertComingInTx(ctx, tx, actor, h.HeroID, rec); err != nil {
		t.Fatal(err)
	}
	if err := meta.InsertComingInTx(ctx, tx, actor, h.HeroID, ComingRecord{CityID: 101}); !errors.Is(err, ErrHeroNotComing) {
		t.Fatal(err)
	}
	got, err := meta.GetComingInTx(ctx, tx, actor, h.HeroID, true)
	if err != nil || *got != rec {
		t.Fatalf("round trip %+v %v", got, err)
	}
	for _, other := range []PlayerRef{{ServerID: 2, PlayerID: 42}, {ServerID: 1, PlayerID: 43}} {
		got, err := meta.GetComingInTx(ctx, tx, other, h.HeroID, false)
		if err != nil || got != nil {
			t.Fatalf("scope %+v %v", got, err)
		}
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := store.Pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_hero)+(SELECT count(*) FROM player_hero_coming)`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("injection rollback %d %v", count, err)
	}
	h.HeroID = 0
	tx = beginHotelTestTx(t, store.Pool)
	if err := heroes.CreateHeroInTx(ctx, tx, h); err != nil {
		t.Fatal(err)
	}
	if err := meta.InsertComingInTx(ctx, tx, actor, h.HeroID, rec); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	if _, err := heroes.LockPlayerHeroesInTx(ctx, tx, 1, 42); err != nil {
		t.Fatal(err)
	}
	if _, err := meta.GetComingInTx(ctx, tx, actor, h.HeroID, true); err != nil {
		t.Fatal(err)
	}
	if err := heroes.SetFamilyHeroIdleInTx(ctx, tx, actor, h.HeroID, StatusComing, 70); err != nil {
		t.Fatal(err)
	}
	if err := meta.ConsumeComingInTx(ctx, tx, actor, h.HeroID, rec); !errors.Is(err, ErrHeroNotComing) {
		t.Fatalf("reversed order %v", err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	owned, err := heroes.LockPlayerHeroesInTx(ctx, tx, 1, 42)
	if err != nil {
		t.Fatal(err)
	}
	got, err = meta.GetComingInTx(ctx, tx, actor, h.HeroID, true)
	if err != nil || got == nil {
		t.Fatalf("rollback lost metadata %+v %v", got, err)
	}
	plan, err := PlanComingAccept(actor, 99, owned[0], got, 1, owned)
	if err != nil {
		t.Fatal(err)
	}
	if err := meta.ConsumeComingInTx(ctx, tx, actor, h.HeroID, ComingRecord{CityID: 100}); !errors.Is(err, ErrHeroNotComing) {
		t.Fatal(err)
	}
	if err := meta.ConsumeComingInTx(ctx, tx, actor, h.HeroID, *got); err != nil {
		t.Fatal(err)
	}
	if err := meta.ConsumeComingInTx(ctx, tx, actor, h.HeroID, *got); !errors.Is(err, ErrHeroNotComing) {
		t.Fatal(err)
	}
	if err := heroes.SetFamilyHeroIdleInTx(ctx, tx, actor, h.HeroID, StatusComing, plan.Hero.Loyalty); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	if err := heroes.DeleteFamilyHeroInTx(ctx, tx, actor, h.HeroID, StatusComing); !errors.Is(err, ErrHeroNotComing) {
		t.Fatal(err)
	}
	if err := meta.InsertComingInTx(ctx, tx, actor, h.HeroID, rec); !errors.Is(err, ErrHeroNotComing) {
		t.Fatalf("terminal resurrection %v", err)
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM player_hero_coming`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("resurrection %d %v", count, err)
	}
}

func TestPGFamilyCaptivePreviewReleaseNoResurrection(t *testing.T) {
	ctx, store := context.Background(), identityStore(t)
	actor := PlayerRef{ServerID: 1, PlayerID: 42}
	heroes, meta := &PGStore{}, &PGCaptiveStore{}
	h := &Hero{ServerID: 1, PlayerID: 42, Level: 60, Loyalty: 3, Status: StatusCaptive}
	rec := CaptiveRecord{CityID: 99}
	tx := beginHotelTestTx(t, store.Pool)
	if err := heroes.CreateHeroInTx(ctx, tx, h); err != nil {
		t.Fatal(err)
	}
	if err := meta.InsertCaptiveInTx(ctx, tx, actor, h.HeroID, rec); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	if _, err := heroes.LockPlayerHeroesInTx(ctx, tx, 1, 42); err != nil {
		t.Fatal(err)
	}
	got, err := meta.GetCaptiveInTx(ctx, tx, actor, h.HeroID, true)
	if err != nil || !reflect.DeepEqual(got, &rec) {
		t.Fatalf("round trip %+v %v", got, err)
	}
	plan, err := PlanCaptivePreview(actor, 99, h, got)
	if err != nil {
		t.Fatal(err)
	}
	if err := meta.UpdateCaptiveInTx(ctx, tx, actor, h.HeroID, *got, plan.Record); err != nil {
		t.Fatal(err)
	}
	if err := meta.UpdateCaptiveInTx(ctx, tx, actor, h.HeroID, *got, plan.Record); !errors.Is(err, ErrHeroNotCaptive) {
		t.Fatal(err)
	}
	if err := meta.ConsumeCaptiveInTx(ctx, tx, actor, h.HeroID, *got); !errors.Is(err, ErrHeroNotCaptive) {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	for _, rollback := range []bool{true, false} {
		tx = beginHotelTestTx(t, store.Pool)
		if _, err := heroes.LockPlayerHeroesInTx(ctx, tx, 1, 42); err != nil {
			t.Fatal(err)
		}
		got, err = meta.GetCaptiveInTx(ctx, tx, actor, h.HeroID, true)
		if err != nil || !reflect.DeepEqual(got, &plan.Record) {
			t.Fatalf("preview persistence %+v %v", got, err)
		}
		if err := meta.ConsumeCaptiveInTx(ctx, tx, actor, h.HeroID, *got); err != nil {
			t.Fatal(err)
		}
		if err := heroes.DeleteFamilyHeroInTx(ctx, tx, actor, h.HeroID, StatusCaptive); err != nil {
			t.Fatal(err)
		}
		if err := meta.UpdateCaptiveInTx(ctx, tx, actor, h.HeroID, *got, plan.Record); !errors.Is(err, ErrHeroNotCaptive) {
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
	if err := meta.UpdateCaptiveInTx(ctx, tx, actor, h.HeroID, plan.Record, plan.Record); !errors.Is(err, ErrHeroNotCaptive) {
		t.Fatal(err)
	}
	if err := meta.InsertCaptiveInTx(ctx, tx, actor, h.HeroID, rec); !errors.Is(err, ErrHeroNotCaptive) {
		t.Fatal(err)
	}
	var count int
	if err := tx.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_hero)+(SELECT count(*) FROM player_hero_captive)`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("resurrection %d %v", count, err)
	}
}

func TestFamilyMetadataRequiresTxBeforeSQL(t *testing.T) {
	ctx, actor := context.Background(), PlayerRef{ServerID: 1, PlayerID: 42}
	c, k := &PGComingStore{}, &PGCaptiveStore{}
	_, coming := c.GetComingInTx(ctx, nil, actor, 1, true)
	_, captive := k.GetCaptiveInTx(ctx, nil, actor, 1, true)
	for _, err := range []error{coming, captive,
		c.InsertComingInTx(ctx, nil, actor, 1, ComingRecord{CityID: 1}), c.ConsumeComingInTx(ctx, nil, actor, 1, ComingRecord{}),
		k.InsertCaptiveInTx(ctx, nil, actor, 1, CaptiveRecord{CityID: 1}), k.UpdateCaptiveInTx(ctx, nil, actor, 1, CaptiveRecord{}, CaptiveRecord{}),
		k.ConsumeCaptiveInTx(ctx, nil, actor, 1, CaptiveRecord{})} {
		if !errors.Is(err, ErrFamilyTransactionRequired) {
			t.Fatal(err)
		}
	}
	if _, err := c.GetComingInTx(ctx, hotelNoSQL{}, actor, 0, true); !errors.Is(err, ErrInvalidFamilyState) {
		t.Fatal(err)
	}
	if err := k.UpdateCaptiveInTx(ctx, hotelNoSQL{}, actor, 1, CaptiveRecord{CityID: 1}, CaptiveRecord{CityID: 2}); !errors.Is(err, ErrInvalidFamilyState) {
		t.Fatal(err)
	}
}
