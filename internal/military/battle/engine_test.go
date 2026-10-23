package battle

import "testing"

func TestCounterMult(t *testing.T) {
	if counterMult(TroopCavalry, TroopInfantry) != counterAdvantage {
		t.Fatal("cavalry should counter infantry")
	}
	if counterMult(TroopInfantry, TroopCavalry) != counterDisadvantage {
		t.Fatal("infantry vs cavalry disadvantage")
	}
	if counterMult(TroopSiege, TroopCavalry) != counterNeutral {
		t.Fatal("siege neutral")
	}
}

func TestSimulateEmptyAttacker(t *testing.T) {
	rep := Simulate(BattleInput{
		BattleID:   "t-empty",
		AttackerID: "a",
		DefenderID: "b",
		Attacker:   Army{Troops: map[TroopType]int{}},
		Defender:   Army{Troops: map[TroopType]int{TroopInfantry: 10}},
	})
	if rep.Result != ResultDefenderWin {
		t.Fatalf("got %s", rep.Result)
	}
}

func TestSimulateReproducible(t *testing.T) {
	in := BaselineInputs()[42]
	a := Simulate(in)
	b := Simulate(in)
	if a.Result != b.Result || !mapsEqual(a.FinalAttacker, b.FinalAttacker) {
		t.Fatal("simulate not reproducible")
	}
}

func mapsEqual(a, b map[TroopType]int) bool {
	for _, tt := range AllTroopTypes {
		if a[tt] != b[tt] {
			return false
		}
	}
	return true
}
