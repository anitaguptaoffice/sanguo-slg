package battle

import "testing"

func wallInput(att, def map[TroopType]int, walls []WallGroup) BattleInput {
	return BattleInput{
		BattleID: "wall", AttackerID: "a", DefenderID: "d",
		Attacker: Army{Troops: att, Morale: 1},
		Defender: Army{Troops: def, Morale: 1, Defenses: walls},
	}
}

func TestLaneWallTowerFiresFromRange(t *testing.T) {
	tower, ok := WallDefense("tower", 2, 3)
	if !ok {
		t.Fatal("tower unavailable")
	}
	rep := Simulate(wallInput(
		map[TroopType]int{TroopInfantry: 100},
		map[TroopType]int{TroopArcher: 10},
		[]WallGroup{tower},
	))
	if len(rep.Rounds) == 0 {
		t.Fatal("no rounds")
	}
	for _, a := range rep.Rounds[0].Actions {
		if a.Side == "defender" && a.Defense == "tower" && a.Kind == "attack" {
			return
		}
	}
	t.Fatalf("tower did not fire: %+v", rep.Rounds[0].Actions)
}

func TestLaneWallsRemainAfterTroops(t *testing.T) {
	trap, _ := WallDefense("trap", 5, 1)
	rep := Simulate(wallInput(
		map[TroopType]int{TroopInfantry: 1000},
		map[TroopType]int{TroopInfantry: 5},
		[]WallGroup{trap},
	))
	if rep.Result != ResultAttackerWin {
		t.Fatalf("result = %s rounds=%+v", rep.Result, rep.Rounds)
	}
	if len(rep.FinalDefenses) != 0 {
		t.Fatalf("traps survived: %+v", rep.FinalDefenses)
	}
}

func TestLaneWallsCanDecideTheBattle(t *testing.T) {
	tower, _ := WallDefense("tower", 30, 5)
	rep := Simulate(wallInput(
		map[TroopType]int{TroopInfantry: 2},
		map[TroopType]int{TroopInfantry: 1},
		[]WallGroup{tower},
	))
	if rep.Result != ResultDefenderWin || len(rep.FinalDefenses) == 0 {
		t.Fatalf("result=%s defenses=%+v", rep.Result, rep.FinalDefenses)
	}
}

func TestWallDefenseScalesWithWallLevel(t *testing.T) {
	low, _ := WallDefense("tower", 1, 1)
	high, _ := WallDefense("tower", 1, 5)
	if high.Atk <= low.Atk || high.HP <= low.HP {
		t.Fatalf("scaling low=%+v high=%+v", low, high)
	}
	if _, ok := WallDefense("unknown", 1, 1); ok {
		t.Fatal("unknown wall accepted")
	}
}
