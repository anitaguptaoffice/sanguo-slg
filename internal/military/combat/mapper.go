package combat

import (
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

// ArmyFromStacks maps cfg_unit stacks to battle.Army using catalog unit codes.
func ArmyFromStacks(catalog map[int32]march.UnitSpec, stacks []march.TroopStack, heroLevel int, morale float64) battle.Army {
	return ArmyFromStacksWithHero(catalog, stacks, heroLevel, 0, 0, morale)
}

// ArmyFromStacksWithHero additionally carries the hero force/intel multipliers.
func ArmyFromStacksWithHero(catalog map[int32]march.UnitSpec, stacks []march.TroopStack, heroLevel int, force, intel int32, morale float64) battle.Army {
	troops := make(map[battle.TroopType]int)
	for _, st := range stacks {
		if st.Count <= 0 {
			continue
		}
		spec, ok := catalog[st.UnitCfgID]
		if !ok {
			continue
		}
		code := spec.CombatType
		if code == "" {
			code = spec.Code
		}
		tt, err := troopTypeFromCode(code)
		if err != nil {
			continue
		}
		troops[tt] += int(st.Count)
	}
	if morale <= 0 {
		morale = 1
	}
	return battle.Army{Troops: troops, HeroLevel: heroLevel, HeroForce: force, HeroIntel: intel, Morale: morale}
}

func troopTypeFromCode(code string) (battle.TroopType, error) {
	switch code {
	case "infantry":
		return battle.TroopInfantry, nil
	case "cavalry":
		return battle.TroopCavalry, nil
	case "archer":
		return battle.TroopArcher, nil
	case "siege":
		return battle.TroopSiege, nil
	default:
		return "", fmt.Errorf("combat: unknown unit code %q", code)
	}
}

// StacksFromArmy converts battle troop maps back to cfg_unit stacks (catalog order 1–4).
func StacksFromArmy(catalog map[int32]march.UnitSpec, m map[battle.TroopType]int) []march.TroopStack {
	if len(m) == 0 {
		return nil
	}
	codeToID := make(map[string]int32)
	for id, spec := range catalog {
		codeToID[spec.Code] = id
	}
	var out []march.TroopStack
	for _, tt := range battle.AllTroopTypes {
		n := m[tt]
		if n <= 0 {
			continue
		}
		var code string
		switch tt {
		case battle.TroopInfantry:
			code = "infantry"
		case battle.TroopCavalry:
			code = "cavalry"
		case battle.TroopArcher:
			code = "archer"
		case battle.TroopSiege:
			code = "siege"
		}
		id := codeToID[code]
		if id == 0 {
			continue
		}
		out = append(out, march.TroopStack{UnitCfgID: id, Count: int32(n)})
	}
	return out
}
