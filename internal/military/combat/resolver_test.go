package combat

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
)

func TestResolveAttackGarrisonStableOutcome(t *testing.T) {
	ctx := context.Background()
	store := report.NewMemStore()
	svc := report.NewService(store)

	r := NewResolver(1, svc, M2FixtureGarrisons(), nil)
	ev := march.MarchArrivalEvent{
		MarchID:  9,
		PlayerID: 1001,
		Troops: []march.TroopStack{
			{UnitCfgID: 1, Count: 200},
			{UnitCfgID: 2, Count: 50},
		},
		Order: march.MarchOrder{
			ToX: 5, ToY: 5,
			Purpose: PurposeAttack,
		},
	}

	fix := M2FixtureGarrisons()
	want := battle.Simulate(battle.BattleInput{
		BattleID:   "march-9",
		AttackerID: "player-1001",
		DefenderID: "garrison-5-5",
		Attacker:   ArmyFromStacks(march.DefaultUnitCatalog(), ev.Troops, 0, 1),
		Defender:   ArmyFromStacks(march.DefaultUnitCatalog(), fix.Get(5, 5).Troops, 0, 1),
	})

	res1, err := r.ResolveAttackGarrison(ctx, ev)
	if err != nil || !res1.BattleRan {
		t.Fatalf("battle: %+v err=%v", res1, err)
	}
	if res1.Report.Result != want.Result {
		t.Fatalf("result %s want %s", res1.Report.Result, want.Result)
	}
	if res1.Report.FinalAttacker[battle.TroopInfantry] != want.FinalAttacker[battle.TroopInfantry] {
		t.Fatalf("final attacker mismatch")
	}

	got, err := svc.Get(ctx, 1, res1.ReportID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Detail.Result != res1.Report.Result {
		t.Fatal("stored detail mismatch")
	}
}
