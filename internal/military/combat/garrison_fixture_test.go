package combat

import "github.com/anitaguptaoffice/sanguo-slg/internal/military/march"

// garrisonFixture is the test-only (5,5) defender table; production resolves
// garrisons from the persisted world state.
func garrisonFixture() *GarrisonTable {
	t := NewGarrisonTable()
	t.Set(5, 5, Garrison{
		Troops: []march.TroopStack{{UnitCfgID: 1, Count: 120}, {UnitCfgID: 3, Count: 40}},
		Morale: 1,
	})
	return t
}
