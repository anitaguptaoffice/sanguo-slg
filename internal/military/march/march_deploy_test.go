package march

import (
	"errors"
	"math"
	"testing"
)

func TestMarchDeploymentCounts(t *testing.T) {
	for _, invalid := range [][]TroopStack{
		nil, {{0, 1}}, {{5, 1}}, {{1, 0}}, {{2, -1}}, {{1, 1}, {1, 1}},
		{{1, 1}, {2, 1}, {3, 1}, {4, 1}, {1, 1}},
	} {
		got, err := marchDeploymentCounts(invalid)
		if got != ([4]int32{}) || !errors.Is(err, ErrInvalidMarch) {
			t.Fatalf("accepted invalid stacks %v: %v %v", invalid, got, err)
		}
	}
	stacks := []TroopStack{{4, math.MaxInt32}, {1, 7}}
	got, err := marchDeploymentCounts(stacks)
	if err != nil || got != ([4]int32{7, 0, 0, math.MaxInt32}) || stacks[0].UnitCfgID != 4 {
		t.Fatalf("wrong normalized debit: %v %v", got, err)
	}
}
