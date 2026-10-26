package hero

import (
	"context"
	"errors"
	"testing"
)

// This proves only hero transaction participation, not a wallet/content commit.
// Natural recruitment acceptance must exercise the real API coordinator.
func TestPGRecruitPlanReadsOwnDraftAndRollback(t *testing.T) {
	ctx := context.Background()
	store := identityStore(t)
	s := NewService()
	s.Store = nil
	input := planState()
	tx, err := store.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	port := &PGStore{}
	input.Heroes, err = port.ListPlayerHeroesInTx(ctx, tx, input.ServerID, input.PlayerID)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := s.PlanRecruit(input, RecruitRequest{TemplateCfgID: 1001})
	if err != nil || plan.Hero.HeroID != 0 {
		t.Fatalf("plan: %+v %v", plan, err)
	}
	if err := port.CreateHeroInTx(ctx, tx, plan.Hero); err != nil || plan.Hero.HeroID <= 0 {
		t.Fatalf("provisional identity: %+v %v", plan.Hero, err)
	}
	input.Heroes, err = port.ListPlayerHeroesInTx(ctx, tx, input.ServerID, input.PlayerID)
	if err != nil || len(input.Heroes) != 1 || input.Heroes[0].HeroID != plan.Hero.HeroID {
		t.Fatalf("read own write: %+v %v", input.Heroes, err)
	}
	if _, err := s.PlanRecruit(input, RecruitRequest{TemplateCfgID: 1001}); !errors.Is(err, ErrAlreadyOwned) {
		t.Fatalf("same-tx duplicate: %v", err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	next, err := store.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = next.Rollback(ctx) }()
	input.Heroes, err = port.ListPlayerHeroesInTx(ctx, next, input.ServerID, input.PlayerID)
	if err != nil || len(input.Heroes) != 0 {
		t.Fatalf("rolled back row survived: %+v %v", input.Heroes, err)
	}
	fresh, err := s.PlanRecruit(input, RecruitRequest{TemplateCfgID: 1001})
	if err != nil || fresh.Hero.HeroID != 0 || fresh.Hero == plan.Hero {
		t.Fatalf("fresh plan: %+v %v", fresh, err)
	}
}
