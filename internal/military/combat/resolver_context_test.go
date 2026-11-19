package combat

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
)

func TestResolveGarrisonCarriesHeroAndLootContext(t *testing.T) {
	table := NewGarrisonTable()
	table.Set(5, 5, Garrison{
		Troops:    []march.TroopStack{{UnitCfgID: 1, Count: 40}},
		HeroLevel: 3, HeroForce: 50, HeroIntel: 40, Morale: 1,
		Name: "森林 Lv3", HeroName: "野地守将",
		Loot: battle.Loot{Food: 100, Wood: 80, Gold: 5, HeroExp: 20},
	})
	resolver := NewResolver(1, report.NewService(report.NewMemStore()), table, nil)
	resolver.HeroStats = func(context.Context, int64, int64, int64) (HeroCombatStats, error) {
		return HeroCombatStats{Name: "刘备", Level: 5, Force: 120, Intel: 90}, nil
	}
	result, err := resolver.ResolveAttackGarrison(context.Background(), march.MarchArrivalEvent{
		MarchID: 1, PlayerID: 7, HeroIDs: []int64{11},
		Troops: []march.TroopStack{{UnitCfgID: 1, Count: 400}},
		Order:  march.MarchOrder{ToX: 5, ToY: 5, Purpose: 1},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !result.BattleRan || result.Report.Result != battle.ResultAttackerWin {
		t.Fatalf("battle: ran=%t result=%s", result.BattleRan, result.Report.Result)
	}
	if result.Report.TargetName != "森林 Lv3" || result.Report.AttackerHero.Name != "刘备" || result.Report.DefenderHero.Name != "野地守将" {
		t.Fatalf("report context: %+v", result.Report)
	}
	if result.Report.Loot.Food != 100 || result.Report.Loot.HeroExp != 20 {
		t.Fatalf("report loot: %+v", result.Report.Loot)
	}
	if result.Loot == nil || result.Loot.Food != 100 || result.Loot.HeroExp != 20 {
		t.Fatalf("arrival loot: %+v", result.Loot)
	}
}
