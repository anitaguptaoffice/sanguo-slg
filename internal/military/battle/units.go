package battle

// UnitStat is the R3-S1 per-unit combat profile for cfg_unit IDs 1..12.
type UnitStat struct {
	Atk, Def, HP, Speed float64
	Role                TroopType
}

var unitStats = map[int32]UnitStat{
	1:  {Atk: 10, Def: 15, HP: 100, Speed: 50, Role: TroopInfantry},
	2:  {Atk: 18, Def: 8, HP: 80, Speed: 100, Role: TroopCavalry},
	3:  {Atk: 14, Def: 6, HP: 70, Speed: 60, Role: TroopArcher},
	4:  {Atk: 25, Def: 5, HP: 50, Speed: 30, Role: TroopSiege},
	5:  {Atk: 6, Def: 8, HP: 80, Speed: 40, Role: TroopInfantry},
	6:  {Atk: 8, Def: 10, HP: 90, Speed: 45, Role: TroopInfantry},
	7:  {Atk: 9, Def: 5, HP: 60, Speed: 120, Role: TroopCavalry},
	8:  {Atk: 13, Def: 12, HP: 95, Speed: 50, Role: TroopInfantry},
	9:  {Atk: 9, Def: 20, HP: 120, Speed: 40, Role: TroopInfantry},
	10: {Atk: 17, Def: 6, HP: 65, Speed: 65, Role: TroopArcher},
	11: {Atk: 16, Def: 8, HP: 85, Speed: 110, Role: TroopCavalry},
	12: {Atk: 24, Def: 14, HP: 110, Speed: 85, Role: TroopCavalry},
}

func UnitStats(id int32) (UnitStat, bool) {
	s, ok := unitStats[id]
	return s, ok
}

func unitRange(id int32) int {
	s, ok := unitStats[id]
	if !ok {
		return 2
	}
	return laneRange(s.Role)
}

func unitTotalHP(units map[int32]int) float64 {
	var hp float64
	for id, n := range units {
		if s, ok := unitStats[id]; ok {
			hp += float64(n) * s.HP
		}
	}
	return hp
}

func cloneUnits(units map[int32]int) map[int32]int {
	out := make(map[int32]int, len(units))
	for id, n := range units {
		out[id] = n
	}
	return out
}

func unitCasualties(start, end map[int32]int) map[int32]int {
	out := make(map[int32]int)
	for id, n := range start {
		if lost := n - end[id]; lost > 0 {
			out[id] = lost
		}
	}
	return out
}

func roleTotals(units map[int32]int) map[TroopType]int {
	out := make(map[TroopType]int)
	for id, n := range units {
		if n <= 0 {
			continue
		}
		if s, ok := unitStats[id]; ok {
			out[s.Role] += n
		}
	}
	return out
}
