package march

// UnitSpec is static recruit/march data for one cfg_unit row (aligned with SPEC-004 seeds).
type UnitSpec struct {
	UnitCfgID   int32
	Code        string
	Speed       int // tiles/hour scale from stats.speed
	RecruitCost Resources
	SecPerUnit  int64 // train time per soldier
	// CombatType maps the recruit unit onto one of the four battle roles.
	CombatType string
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
			CombatType:  "siege",
		},
		5:  {UnitCfgID: 5, Code: "militia", Speed: 40, RecruitCost: Resources{Food: 30, Wood: 10}, SecPerUnit: 20, CombatType: "infantry"},
		6:  {UnitCfgID: 6, Code: "levy", Speed: 45, RecruitCost: Resources{Food: 45, Wood: 20}, SecPerUnit: 25, CombatType: "infantry"},
		7:  {UnitCfgID: 7, Code: "scout", Speed: 120, RecruitCost: Resources{Food: 60, Wood: 30, Iron: 10}, SecPerUnit: 30, CombatType: "cavalry"},
		8:  {UnitCfgID: 8, Code: "spearman", Speed: 50, RecruitCost: Resources{Food: 70, Wood: 50, Iron: 20}, SecPerUnit: 40, CombatType: "infantry"},
		9:  {UnitCfgID: 9, Code: "shield", Speed: 40, RecruitCost: Resources{Food: 80, Wood: 60, Iron: 40}, SecPerUnit: 45, CombatType: "infantry"},
		10: {UnitCfgID: 10, Code: "longbow", Speed: 65, RecruitCost: Resources{Food: 80, Wood: 90, Iron: 20}, SecPerUnit: 45, CombatType: "archer"},
		11: {UnitCfgID: 11, Code: "light_cavalry", Speed: 110, RecruitCost: Resources{Food: 100, Wood: 40, Iron: 40}, SecPerUnit: 50, CombatType: "cavalry"},
		12: {UnitCfgID: 12, Code: "heavy_cavalry", Speed: 85, RecruitCost: Resources{Food: 140, Wood: 60, Iron: 90}, SecPerUnit: 70, CombatType: "cavalry"},
		13: {UnitCfgID: 13, Code: "xiliang_iron", Speed: 95, RecruitCost: Resources{Food: 300, Wood: 120, Iron: 100}, SecPerUnit: 90, CombatType: "cavalry"},
		14: {UnitCfgID: 14, Code: "hubao", Speed: 105, RecruitCost: Resources{Food: 360, Wood: 150, Iron: 140}, SecPerUnit: 110, CombatType: "cavalry"},
		15: {UnitCfgID: 15, Code: "qingzhou", Speed: 55, RecruitCost: Resources{Food: 240, Wood: 100, Iron: 60}, SecPerUnit: 80, CombatType: "infantry"},
		16: {UnitCfgID: 16, Code: "nanman_elephant", Speed: 45, RecruitCost: Resources{Food: 400, Wood: 180, Iron: 80}, SecPerUnit: 130, CombatType: "infantry"},
		17: {UnitCfgID: 17, Code: "rattan", Speed: 50, RecruitCost: Resources{Food: 220, Wood: 200, Iron: 50}, SecPerUnit: 75, CombatType: "infantry"},
		18: {UnitCfgID: 18, Code: "tuji", Speed: 120, RecruitCost: Resources{Food: 280, Wood: 130, Iron: 90}, SecPerUnit: 85, CombatType: "cavalry"},
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
