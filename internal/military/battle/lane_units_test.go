package battle

import "testing"

func unitsInput(att, def map[int32]int) BattleInput {
	return BattleInput{
		BattleID: "units", AttackerID: "a", DefenderID: "d",
		Attacker: Army{Units: att, Morale: 1},
		Defender: Army{Units: def, Morale: 1},
	}
}

func TestLaneUnitsKeepTwelveUnitIdentity(t *testing.T) {
	in := unitsInput(
		map[int32]int{5: 100, 10: 100},
		map[int32]int{8: 100, 2: 50},
	)
	in.Attacker.UnitTactics = map[int32]Tactic{10: {Target: TroopCavalry}}
	rep := Simulate(in)
	if rep.StartDistance != 12 {
		t.Fatalf("start distance = %d", rep.StartDistance)
	}
	if len(rep.Rounds) == 0 || len(rep.Rounds[0].AttackerUnits) != 2 || len(rep.Rounds[0].DefenderUnits) != 2 {
		t.Fatalf("unit snapshots missing: %+v", rep.Rounds)
	}
	var targeted bool
	for _, rr := range rep.Rounds {
		for _, action := range rr.Actions {
			if action.Side == "attacker" && action.UnitCfgID == 10 && action.Kind == "attack" {
				if action.Target != TroopCavalry {
					t.Fatalf("first longbow target %s", action.Target)
				}
				targeted = true
				break
			}
		}
		if targeted {
			break
		}
	}
	if !targeted {
		t.Fatal("longbow never attacked")
	}
	if rep.FinalAttackerUnits == nil || rep.FinalDefenderUnits == nil || rep.AttackerCasualtiesUnits == nil {
		t.Fatal("final unit state missing")
	}
}

func TestLaneUnitsHoldAndWallDefense(t *testing.T) {
	tower, _ := WallDefense("tower", 4, 2)
	in := unitsInput(
		map[int32]int{7: 50},
		map[int32]int{9: 20},
	)
	in.Defender.Defenses = []WallGroup{tower}
	in.Attacker.UnitTactics = map[int32]Tactic{7: {Hold: true}}
	rep := Simulate(in)
	for _, action := range rep.Rounds[0].Actions {
		if action.Side == "attacker" && action.UnitCfgID == 7 && action.Kind == "move" {
			t.Fatal("held scout moved")
		}
	}
}

func TestLaneUnitsWallsDecide(t *testing.T) {
	tower, _ := WallDefense("tower", 30, 5)
	in := unitsInput(
		map[int32]int{5: 2},
		map[int32]int{1: 1},
	)
	in.Defender.Defenses = []WallGroup{tower}
	rep := Simulate(in)
	if rep.Result != ResultDefenderWin || len(rep.FinalDefenses) == 0 {
		t.Fatalf("result=%s defenses=%+v", rep.Result, rep.FinalDefenses)
	}
}
