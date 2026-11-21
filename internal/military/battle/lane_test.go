package battle

import "testing"

func laneTestInput(att, def map[TroopType]int) BattleInput {
	return BattleInput{
		BattleID: "lane", AttackerID: "a", DefenderID: "d",
		Attacker: Army{Troops: att, Morale: 1},
		Defender: Army{Troops: def, Morale: 1},
	}
}

func TestLaneStartsAtMaxRangeAndAdvances(t *testing.T) {
	rep := Simulate(laneTestInput(
		map[TroopType]int{TroopInfantry: 100},
		map[TroopType]int{TroopArcher: 100},
	))
	if len(rep.Rounds) == 0 || rep.StartDistance != 12 || rep.Rounds[0].Distance >= 12 {
		t.Fatalf("opening round = %+v", rep.Rounds)
	}
	var moved bool
	for _, a := range rep.Rounds[0].Actions {
		if a.Side == "attacker" && a.Troop == TroopInfantry && a.Kind == "move" {
			moved = true
		}
	}
	if !moved {
		t.Fatal("melee infantry did not advance")
	}
}

func TestLaneArcherAttacksFromRange(t *testing.T) {
	rep := Simulate(laneTestInput(
		map[TroopType]int{TroopArcher: 100},
		map[TroopType]int{TroopInfantry: 100},
	))
	if len(rep.Rounds) == 0 {
		t.Fatal("no rounds")
	}
	var fire bool
	for _, a := range rep.Rounds[0].Actions {
		if a.Side == "attacker" && a.Troop == TroopArcher && a.Kind == "attack" {
			fire = true
		}
	}
	if !fire {
		t.Fatalf("archer did not fire at range: %+v", rep.Rounds[0].Actions)
	}
}

func TestLaneTacticHoldPreventsAdvance(t *testing.T) {
	in := laneTestInput(
		map[TroopType]int{TroopArcher: 100},
		map[TroopType]int{TroopSiege: 100},
	)
	in.Attacker.Tactics = map[TroopType]Tactic{TroopArcher: {Hold: true}}
	rep := Simulate(in)
	for _, a := range rep.Rounds[0].Actions {
		if a.Side == "attacker" && a.Troop == TroopArcher {
			t.Fatalf("held archer acted: %+v", a)
		}
	}
	if rep.Rounds[0].Distance != 16 {
		t.Fatalf("distance changed despite hold: %d", rep.Rounds[0].Distance)
	}
}

func TestLaneTacticTargetsPreferredRole(t *testing.T) {
	in := laneTestInput(
		map[TroopType]int{TroopCavalry: 100, TroopInfantry: 100},
		map[TroopType]int{TroopArcher: 100, TroopInfantry: 100},
	)
	in.Attacker.Tactics = map[TroopType]Tactic{TroopCavalry: {Target: TroopArcher}}
	rep := Simulate(in)
	for _, rr := range rep.Rounds {
		for _, a := range rr.Actions {
			if a.Side == "attacker" && a.Troop == TroopCavalry && a.Kind == "attack" {
				if a.Target != TroopArcher {
					t.Fatalf("cavalry targeted %s", a.Target)
				}
				return
			}
		}
	}
	t.Fatal("cavalry never attacked")
}

func TestLaneMaxRoundsAndSnapshots(t *testing.T) {
	rep := Simulate(laneTestInput(
		map[TroopType]int{TroopInfantry: 100000, TroopArcher: 100000},
		map[TroopType]int{TroopInfantry: 100000, TroopArcher: 100000},
	))
	if len(rep.Rounds) == 0 || len(rep.Rounds) > laneMaxRounds {
		t.Fatalf("rounds = %d", len(rep.Rounds))
	}
	last := rep.Rounds[len(rep.Rounds)-1]
	if last.AttackerTroops == nil || last.DefenderTroops == nil || last.Distance < 0 {
		t.Fatalf("last round = %+v", last)
	}
	if rep.Result == "" {
		t.Fatal("missing result")
	}
}
