package march

import (
	"fmt"
	"math"
)

// NormalizeMarchTroops validates and copies requested troops, combining duplicate
// unit counts in first-appearance order. It never changes the input or catalog.
func NormalizeMarchTroops(catalog map[int32]UnitSpec, troops []TroopStack) ([]TroopStack, error) {
	if len(troops) == 0 {
		return nil, ErrNoTroopsToMarch
	}
	out := make([]TroopStack, 0, len(troops))
	positions := make(map[int32]int, len(troops))
	for _, st := range troops {
		if st.Count <= 0 {
			return nil, fmt.Errorf("%w: troop count must be positive", ErrInvalidMarch)
		}
		if _, ok := catalog[st.UnitCfgID]; !ok {
			return nil, ErrUnknownUnit
		}
		if i, ok := positions[st.UnitCfgID]; ok {
			if out[i].Count > math.MaxInt32-st.Count {
				return nil, fmt.Errorf("%w: troop count overflow", ErrInvalidMarch)
			}
			out[i].Count += st.Count
		} else {
			positions[st.UnitCfgID] = len(out)
			out = append(out, st)
		}
	}
	return out, nil
}
