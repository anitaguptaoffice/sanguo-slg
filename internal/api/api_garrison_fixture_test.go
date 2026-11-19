package api_test

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

// apiTestGarrisons keeps the legacy (5,5) battle target for unit tests only;
// production resolves garrisons from the persisted world state.
func apiTestGarrisons() *combat.GarrisonTable {
	t := combat.NewGarrisonTable()
	t.Set(5, 5, combat.Garrison{
		Troops: []march.TroopStack{{UnitCfgID: 1, Count: 120}, {UnitCfgID: 3, Count: 40}},
		Morale: 1,
	})
	return t
}
