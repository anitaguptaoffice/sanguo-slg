package battle

import (
	"math"
)

// Simulate runs the combat rules (spec/rules/combat.md) and returns a battle report.
func Simulate(in BattleInput) BattleReport {
	att := cloneTroops(in.Attacker.Troops)
	def := cloneTroops(in.Defender.Troops)
	startAtt := cloneTroops(att)
	startDef := cloneTroops(def)

	report := BattleReport{
		Rounds:             nil,
		AttackerCasualties: emptyCasualties(),
		DefenderCasualties: emptyCasualties(),
	}

	attMorale := clampMorale(in.Attacker.Morale)
	defMorale := clampMorale(in.Defender.Morale)
	attHeroAtk, attHeroDef := heroMults(in.Attacker.HeroLevel)
	defHeroAtk, defHeroDef := heroMults(in.Defender.HeroLevel)

	round := 0
	for round < maxRounds {
		if troopTotal(att) == 0 || troopTotal(def) == 0 {
			break
		}
		round++
		rr := RoundReport{
			Round:          round,
			AttackerTroops: nil,
			DefenderTroops: nil,
		}

		firstAttacker := strikeOrder(in, att, def)
		if firstAttacker {
			rr.AttackerToDefHP = strike(in.BattleID, round, 0, in.AttackerID, att, attMorale, attHeroAtk, def, defMorale, defHeroDef)
			if troopTotal(def) == 0 {
				rr.AttackerTroops = cloneTroops(att)
				rr.DefenderTroops = cloneTroops(def)
				report.Rounds = append(report.Rounds, rr)
				break
			}
			rr.DefenderToAttHP = strike(in.BattleID, round, 1, in.DefenderID, def, defMorale, defHeroAtk, att, attMorale, attHeroDef)
		} else {
			rr.DefenderToAttHP = strike(in.BattleID, round, 0, in.DefenderID, def, defMorale, defHeroAtk, att, attMorale, attHeroDef)
			if troopTotal(att) == 0 {
				rr.AttackerTroops = cloneTroops(att)
				rr.DefenderTroops = cloneTroops(def)
				report.Rounds = append(report.Rounds, rr)
				break
			}
			rr.AttackerToDefHP = strike(in.BattleID, round, 1, in.AttackerID, att, attMorale, attHeroAtk, def, defMorale, defHeroDef)
		}

		rr.AttackerTroops = cloneTroops(att)
		rr.DefenderTroops = cloneTroops(def)
		report.Rounds = append(report.Rounds, rr)
		if troopTotal(att) == 0 || troopTotal(def) == 0 {
			break
		}
	}

	report.FinalAttacker = cloneTroops(att)
	report.FinalDefender = cloneTroops(def)
	report.Result = decideResult(att, def, in)
	report.AttackerCasualties = casualties(startAtt, att)
	report.DefenderCasualties = casualties(startDef, def)
	return report
}

func strikeOrder(in BattleInput, att, def map[TroopType]int) bool {
	sa := avgSpeed(att)
	sd := avgSpeed(def)
	if sa > sd {
		return true
	}
	if sa < sd {
		return false
	}
	return in.AttackerID < in.DefenderID
}

func avgSpeed(troops map[TroopType]int) float64 {
	n := troopTotal(troops)
	if n == 0 {
		return 0
	}
	var sum float64
	for _, tt := range AllTroopTypes {
		c := troops[tt]
		if c > 0 {
			sum += float64(c) * troopStats[tt].speed
		}
	}
	return sum / float64(n)
}

func strike(battleID string, round, phase int, strikerID string,
	atkTroops map[TroopType]int, atkMorale, atkHeroAtk float64,
	defTroops map[TroopType]int, defMorale, defHeroDef float64) int {

	nAtk := troopTotal(atkTroops)
	nDef := troopTotal(defTroops)
	if nAtk == 0 || nDef == 0 {
		return 0
	}

	defWeights := troopWeights(defTroops, nDef)
	atkPool := 0.0
	for _, tt := range AllTroopTypes {
		nt := atkTroops[tt]
		if nt <= 0 {
			continue
		}
		defMix := 0.0
		for _, st := range AllTroopTypes {
			if defTroops[st] <= 0 {
				continue
			}
			defMix += defWeights[st] * counterMult(tt, st)
		}
		st := troopStats[tt]
		atkPool += float64(nt) * st.atk * atkHeroAtk * atkMorale * defMix
	}

	defPool := 0.0
	for _, tt := range AllTroopTypes {
		ns := defTroops[tt]
		if ns <= 0 {
			continue
		}
		st := troopStats[tt]
		defPool += float64(ns) * st.def * defHeroDef * defMorale
	}

	u := damageUniform(battleID, round, phase, strikerID)
	raw := atkPool * atkPool / (atkPool + defPool + damageEpsilon) * roundDamageMult * u
	damageHP := int(math.Floor(raw))
	applyDamage(defTroops, damageHP)
	return damageHP
}

func applyDamage(troops map[TroopType]int, damageHP int) {
	hpPool := totalHP(troops)
	if damageHP <= 0 || hpPool <= 0 {
		return
	}
	if float64(damageHP) >= hpPool {
		for _, tt := range AllTroopTypes {
			troops[tt] = 0
		}
		return
	}
	for _, tt := range AllTroopTypes {
		ns := troops[tt]
		if ns <= 0 {
			continue
		}
		st := troopStats[tt]
		lossHP := math.Floor(float64(damageHP) * (float64(ns) * st.hp) / hpPool)
		lossCount := int(math.Min(float64(ns), math.Ceil(lossHP/st.hp)))
		troops[tt] = ns - lossCount
	}
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

func totalHP(t map[TroopType]int) float64 {
	var hp float64
	for _, tt := range AllTroopTypes {
		c := t[tt]
		if c > 0 {
			hp += float64(c) * troopStats[tt].hp
		}
	}
	return hp
}

func troopWeights(t map[TroopType]int, n int) map[TroopType]float64 {
	w := make(map[TroopType]float64, len(AllTroopTypes))
	if n == 0 {
		return w
	}
	for _, tt := range AllTroopTypes {
		w[tt] = float64(t[tt]) / float64(n)
	}
	return w
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
