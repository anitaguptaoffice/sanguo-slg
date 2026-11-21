package battle

// Simulate runs the R3-S1 one-dimensional distance engine and returns a
// deterministic battle report.
func Simulate(in BattleInput) BattleReport {
	if len(in.Attacker.Units) > 0 || len(in.Defender.Units) > 0 {
		return simulateLaneUnits(in)
	}
	return simulateLane(in)
}

// heroStatsMults layers the R1-S4 attribute multipliers on the level bonus:
// 1 + force/200 attack and 1 + intel/200 defense.
func heroStatsMults(a Army) (atk, def float64) {
	atk, def = heroMults(a.HeroLevel)
	if a.HeroForce > 0 {
		atk *= 1 + float64(a.HeroForce)/200
	}
	if a.HeroIntel > 0 {
		def *= 1 + float64(a.HeroIntel)/200
	}
	if a.TechAttackPct > 0 {
		atk *= 1 + float64(a.TechAttackPct)/100
	}
	if a.TechDefensePct > 0 {
		def *= 1 + float64(a.TechDefensePct)/100
	}
	return atk, def
}

func counterMult(attacker, defender TroopType) float64 {
	if attacker == TroopSiege || defender == TroopSiege {
		return counterNeutral
	}
	if counterEdges[attacker] == defender {
		return counterAdvantage
	}
	if counterEdges[defender] == attacker {
		return counterDisadvantage
	}
	return counterNeutral
}

func totalHP(t map[TroopType]int) float64 {
	var hp float64
	for _, tt := range AllTroopTypes {
		hp += float64(t[tt]) * troopStats[tt].hp
	}
	return hp
}

func decideResult(att, def map[TroopType]int, in BattleInput) Result {
	na, nd := troopTotal(att), troopTotal(def)
	if na == 0 && nd == 0 {
		return ResultDefenderWin
	}
	if na == 0 {
		return ResultDefenderWin
	}
	if nd == 0 {
		return ResultAttackerWin
	}
	ha, hd := totalHP(att), totalHP(def)
	if ha > hd {
		return ResultAttackerWin
	}
	return ResultDefenderWin
}

func heroMults(level int) (atk, def float64) {
	if !heroEnabled || level <= 0 {
		return 1, 1
	}
	if level > heroMaxLevelM1 {
		level = heroMaxLevelM1
	}
	m := 1 + float64(level)*heroAtkPerLevel
	return m, 1 + float64(level)*heroDefPerLevel
}

func clampMorale(m float64) float64 {
	if m == 0 {
		return defaultMorale
	}
	if m < moraleMin {
		return moraleMin
	}
	if m > moraleMax {
		return moraleMax
	}
	return m
}

func troopTotal(t map[TroopType]int) int {
	var n int
	for _, tt := range AllTroopTypes {
		n += t[tt]
	}
	return n
}

func cloneTroops(t map[TroopType]int) map[TroopType]int {
	out := make(map[TroopType]int, len(AllTroopTypes))
	for _, tt := range AllTroopTypes {
		out[tt] = t[tt]
	}
	return out
}

func emptyCasualties() map[TroopType]int {
	return cloneTroops(nil)
}

func casualties(start, end map[TroopType]int) map[TroopType]int {
	out := make(map[TroopType]int, len(AllTroopTypes))
	for _, tt := range AllTroopTypes {
		diff := start[tt] - end[tt]
		if diff < 0 {
			diff = 0
		}
		out[tt] = diff
	}
	return out
}
