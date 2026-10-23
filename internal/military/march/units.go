package march

// UnitSpec is static recruit/march data for one cfg_unit row (aligned with SPEC-004 seeds).
type UnitSpec struct {
	UnitCfgID   int32
	Code        string
	Speed       int // tiles/hour scale from stats.speed
	RecruitCost Resources
	SecPerUnit  int64 // train time per soldier
}

// DefaultUnitCatalog matches cfg_unit IDs 1–4 from spec/data/generated/cfg_unit.sql.
func DefaultUnitCatalog() map[int32]UnitSpec {
	return map[int32]UnitSpec{
		1: {
			UnitCfgID:   1,
			Code:        "infantry",
			Speed:       50,
			RecruitCost: Resources{Food: 40, Wood: 20},
			SecPerUnit:  30,
		},
		2: {
			UnitCfgID:   2,
			Code:        "cavalry",
			Speed:       100,
			RecruitCost: Resources{Food: 80, Wood: 40, Iron: 20},
			SecPerUnit:  45,
		},
		3: {
			UnitCfgID:   3,
			Code:        "archer",
			Speed:       60,
			RecruitCost: Resources{Food: 50, Wood: 60},
			SecPerUnit:  35,
		},
		4: {
			UnitCfgID:   4,
			Code:        "siege",
			Speed:       30,
			RecruitCost: Resources{Food: 100, Wood: 80, Stone: 40, Iron: 30},
			SecPerUnit:  60,
		},
	}
}

// EffectiveMarchSpeed returns the slowest unit speed in the stack (bottleneck).
func EffectiveMarchSpeed(catalog map[int32]UnitSpec, stacks []TroopStack) int {
	speed := 0
	for _, st := range stacks {
		if st.Count <= 0 {
			continue
		}
		spec, ok := catalog[st.UnitCfgID]
		if !ok || spec.Speed <= 0 {
			continue
		}
		if speed == 0 || spec.Speed < speed {
			speed = spec.Speed
		}
	}
	if speed == 0 {
		return 50
	}
	return speed
}
