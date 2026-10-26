package hero

import (
	"context"
	"testing"
)

func TestUpgradeHeroConsumesExpPool(t *testing.T) {
	levels, err := DefaultLevelTable()
	if err != nil {
		t.Fatal(err)
	}
	tpl := DefaultCatalog()[1001]
	h := &Hero{
		ServerID: 1, HeroID: 1, PlayerID: 42, TemplateCfgID: 1001,
		Level: 1, Exp: 150, Status: StatusIdle,
	}
	ApplyStatsForLevel(h, tpl, 1)
	beforeForce := h.Force
	res, err := UpgradeHeroOnce(h, tpl, levels)
	if err != nil {
		t.Fatal(err)
	}
	if res.PreviousLevel != 1 || h.Level != 2 {
		t.Fatalf("level %d prev %d", h.Level, res.PreviousLevel)
	}
	if h.Exp != 150 {
		t.Fatalf("exp should remain cumulative, got %d", h.Exp)
	}
	if h.Force <= beforeForce {
		t.Fatalf("force should grow: before=%d after=%d", beforeForce, h.Force)
	}
	pool := levels.ExpTowardNext(h.Level, h.Exp)
	if pool != 50 {
		t.Fatalf("pool toward next=%d want 50", pool)
	}
}

func TestUpgradeHeroInsufficientExp(t *testing.T) {
	levels, err := DefaultLevelTable()
	if err != nil {
		t.Fatal(err)
	}
	tpl := DefaultCatalog()[1001]
	h := &Hero{Level: 1, Exp: 50, Status: StatusIdle, TemplateCfgID: 1001}
	_, err = UpgradeHeroOnce(h, tpl, levels)
	if err != ErrInsufficientExp {
		t.Fatalf("err=%v", err)
	}
}

func TestUpgradePlayerPersists(t *testing.T) {
	ctx := context.Background()
	svc := NewService()
	h := &Hero{
		ServerID: 1, PlayerID: 7, TemplateCfgID: 1001,
		Level: 1, Exp: 200, Status: StatusIdle, Loyalty: LoyaltyDefault,
	}
	ApplyStatsForLevel(h, DefaultCatalog()[1001], 1)
	if err := svc.Store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	res, err := svc.UpgradePlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 7}, h.HeroID)
	if err != nil {
		t.Fatal(err)
	}
	if res.Hero.Level != 2 {
		t.Fatalf("level %d", res.Hero.Level)
	}
	got, _ := svc.Store.GetHero(ctx, 1, h.HeroID)
	if got.Level != 2 {
		t.Fatalf("persisted level %d", got.Level)
	}
}
