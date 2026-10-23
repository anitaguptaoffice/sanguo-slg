package battle

import "testing"

func TestBaselineGolden(t *testing.T) {
	inputs := BaselineInputs()
	if len(baselineGolden) != 100 {
		t.Fatalf("expected 100 golden rows, got %d", len(baselineGolden))
	}
	if len(inputs) != 100 {
		t.Fatalf("expected 100 inputs, got %d", len(inputs))
	}
	for i, want := range baselineGolden {
		rep := Simulate(inputs[i])
		if rep.Result != want.Result {
			t.Fatalf("case %d result %s != %s", i, rep.Result, want.Result)
		}
		gotAtt := troopsArray(rep.FinalAttacker)
		gotDef := troopsArray(rep.FinalDefender)
		if gotAtt != want.Attacker {
			t.Fatalf("case %d attacker final %v != %v", i, gotAtt, want.Attacker)
		}
		if gotDef != want.Defender {
			t.Fatalf("case %d defender final %v != %v", i, gotDef, want.Defender)
		}
	}
}

func troopsArray(m map[TroopType]int) [4]int {
	var a [4]int
	for i, tt := range AllTroopTypes {
		a[i] = m[tt]
	}
	return a
}
