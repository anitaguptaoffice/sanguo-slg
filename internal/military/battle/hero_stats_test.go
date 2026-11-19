package battle

import "testing"

func TestHeroForceAndIntelShiftTheBattle(t *testing.T) {
	base := BattleInput{
		BattleID: "b", AttackerID: "a", DefenderID: "d",
		Attacker: Army{Troops: map[TroopType]int{TroopInfantry: 400}, HeroLevel: 5, Morale: 1},
		Defender: Army{Troops: map[TroopType]int{TroopInfantry: 300}, HeroLevel: 5, Morale: 1},
	}
	strong := base
	strong.Attacker.HeroForce = 160
	strong.Attacker.HeroIntel = 160

	plain := Simulate(base)
	buffed := Simulate(strong)
	plainLoss := total(plain.AttackerCasualties)
	buffedLoss := total(buffed.AttackerCasualties)
	if buffedLoss > plainLoss {
		t.Fatalf("hero stats increased attacker losses: plain=%d buffed=%d", plainLoss, buffedLoss)
	}
	if buffedLoss == plainLoss && total(plain.DefenderCasualties) == total(buffed.DefenderCasualties) {
		t.Fatal("hero stats changed nothing")
	}
}

func total(m map[TroopType]int) int {
	sum := 0
	for _, v := range m {
		sum += v
	}
	return sum
}
