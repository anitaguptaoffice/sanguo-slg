package battle

import "testing"

// legacyPKDamage mirrors PKFunc::PKDamage without importing legacy code.
func legacyPKDamage(attack, defence int) int {
	if attack <= 0 {
		return 0
	}
	d := float64(attack) * (1 - float64(defence)/(float64(defence)+2000))
	return int(d)
}

func TestLegacyPKDamageSample(t *testing.T) {
	if legacyPKDamage(5000, 1000) != 3333 {
		t.Fatalf("PK sample mismatch")
	}
	if legacyPKDamage(1000, 0) != 1000 {
		t.Fatalf("zero defence")
	}
}

func TestM1CombatStillUsesPoolEngine(t *testing.T) {
	rep := Simulate(BattleInput{
		Attacker: Army{Troops: map[TroopType]int{TroopInfantry: 100}},
		Defender: Army{Troops: map[TroopType]int{TroopInfantry: 100}},
	})
	if rep.Result == "" || len(rep.Rounds) == 0 {
		t.Fatal("pool combat should produce rounds")
	}
}
