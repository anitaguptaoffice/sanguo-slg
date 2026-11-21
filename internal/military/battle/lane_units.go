package battle

import (
	"math"
	"sort"
	"strconv"
)

type unitRole struct {
	side  int
	id    int32
	speed float64
	reach int
}

func unitTurnOrder(att, def map[int32]int) []unitRole {
	var order []unitRole
	seen := make(map[int32]bool)
	for _, side := range []struct {
		n    int
		unit map[int32]int
	}{{0, att}, {1, def}} {
		for id, n := range side.unit {
			if n <= 0 || seen[id] {
				continue
			}
			seen[id] = true
			if stat, ok := unitStats[id]; ok {
				order = append(order, unitRole{side: side.n, id: id, speed: stat.Speed, reach: unitRange(id)})
			}
		}
	}
	sort.SliceStable(order, func(i, j int) bool {
		if order[i].speed != order[j].speed {
			return order[i].speed > order[j].speed
		}
		if order[i].side != order[j].side {
			return order[i].side < order[j].side
		}
		return order[i].id < order[j].id
	})
	return order
}

func unitInitial(att, def map[int32]int) int {
	distance := laneInitialDistance
	for _, units := range []map[int32]int{att, def} {
		for id, n := range units {
			if n > 0 && unitRange(id) > distance {
				distance = unitRange(id)
			}
		}
	}
	return distance
}

func unitTarget(actor int32, enemy map[int32]int, tactic Tactic) (int32, bool) {
	role := unitStats[actor].Role
	if tactic.Target != "" && tactic.Target != role {
		if id, ok := unitInRole(enemy, tactic.Target); ok {
			return id, true
		}
	}
	for _, wanted := range []TroopType{TroopInfantry, TroopCavalry, TroopArcher, TroopSiege} {
		if id, ok := unitInRole(enemy, wanted); ok {
			return id, true
		}
	}
	return 0, false
}

func unitInRole(enemy map[int32]int, role TroopType) (int32, bool) {
	var best int32
	for id, n := range enemy {
		if n <= 0 {
			continue
		}
		stat, ok := unitStats[id]
		if !ok || stat.Role != role {
			continue
		}
		if best == 0 || id < best {
			best = id
		}
	}
	return best, best != 0
}

func unitDamage(actor int32, actorCount int, actorArmy Army, target int32, targetCount int, targetArmy Army, battleID string, round, phase int) int {
	as, ok := unitStats[actor]
	if !ok {
		return 0
	}
	ts, ok := unitStats[target]
	if !ok {
		return 0
	}
	atkHero, _ := heroStatsMults(actorArmy)
	_, defHero := heroStatsMults(targetArmy)
	atkPool := float64(actorCount) * as.Atk * atkHero * clampMorale(actorArmy.Morale) * counterMult(as.Role, ts.Role)
	defPool := float64(targetCount) * ts.Def * defHero * clampMorale(targetArmy.Morale)
	raw := atkPool * atkPool / (atkPool + defPool + damageEpsilon) * laneDamageScale * damageUniform(battleID, round, phase, strconv.Itoa(int(actor)))
	return int(math.Floor(raw))
}

func unitApplyDamage(units map[int32]int, target int32, damageHP int) int {
	count, stat := units[target], unitStats[target]
	if count <= 0 || damageHP <= 0 || stat.HP <= 0 {
		return 0
	}
	loss := int(math.Ceil(float64(damageHP) / stat.HP))
	if loss > count {
		loss = count
	}
	units[target] = count - loss
	return int(float64(loss) * stat.HP)
}

func unitWallDamage(actor int32, count int, army Army, wall WallGroup, battleID string, round, phase int) float64 {
	stat, ok := unitStats[actor]
	if !ok {
		return 0
	}
	atkHero, _ := heroStatsMults(army)
	atkPool := float64(count) * stat.Atk * atkHero * clampMorale(army.Morale)
	defPool := float64(wall.Count) * wall.Def
	return atkPool * atkPool / (atkPool + defPool + damageEpsilon) * laneDamageScale * damageUniform(battleID, round, phase, strconv.Itoa(int(actor))+"-wall")
}

func laneWallActionsUnits(walls map[string]WallGroup, att map[int32]int, army Army, distance int, battleID string, round int) []RoundAction {
	var out []RoundAction
	for _, code := range []string{"trap", "stakes", "tower", "log", "rock"} {
		wall, ok := walls[code]
		if !ok || wall.Count <= 0 || float64(distance) > wall.Range {
			continue
		}
		target, ok := unitInRole(att, TroopInfantry)
		if !ok {
			target, ok = unitInRole(att, TroopCavalry)
		}
		if !ok {
			target, ok = unitInRole(att, TroopArcher)
		}
		if !ok {
			target, ok = unitInRole(att, TroopSiege)
		}
		if !ok {
			continue
		}
		atkHero, _ := heroStatsMults(army)
		atk := float64(wall.Count) * wall.Atk
		stat := unitStats[target]
		def := float64(att[target]) * stat.Def * atkHero
		damage := int(atk * atk / (atk + def + damageEpsilon) * laneDamageScale * damageUniform(battleID, round, 50+len(out), code))
		applied := unitApplyDamage(att, target, damage)
		out = append(out, RoundAction{Side: "defender", Defense: code, Kind: "attack", UnitCfgID: target, DamageHP: applied})
		if len(att) == 0 {
			break
		}
	}
	return out
}

func simulateLaneUnits(in BattleInput) BattleReport {
	att, def := cloneUnits(in.Attacker.Units), cloneUnits(in.Defender.Units)
	startAtt, startDef := cloneUnits(att), cloneUnits(def)
	report := BattleReport{
		AttackerCasualties: emptyCasualties(),
		DefenderCasualties: emptyCasualties(),
	}
	if unitTotal(att) == 0 || unitTotal(def) == 0 {
		return finalizeUnits(report, att, def, startAtt, startDef, nil)
	}
	distance := unitInitial(att, def)
	report.StartDistance = distance
	walls := wallCopies(in.Defender.Defenses)
	order := unitTurnOrder(att, def)
	for round := 1; round <= laneMaxRounds; round++ {
		if unitTotal(att) == 0 {
			break
		}
		if unitTotal(def) == 0 && len(wallCounts(walls)) == 0 {
			break
		}
		rr := RoundReport{Round: round}
		for phase, role := range order {
			var actor, enemy map[int32]int
			var actorArmy, enemyArmy Army
			if role.side == 0 {
				actor, enemy, actorArmy, enemyArmy = att, def, in.Attacker, in.Defender
			} else {
				actor, enemy, actorArmy, enemyArmy = def, att, in.Defender, in.Attacker
			}
			if actor[role.id] <= 0 {
				continue
			}
			tactic := actorArmy.UnitTactics[role.id]
			if distance > role.reach {
				if tactic.Hold {
					continue
				}
				move := role.speed / 10
				if move < 1 {
					move = 1
				}
				distance -= int(math.Ceil(move))
				if distance < 0 {
					distance = 0
				}
				rr.Actions = append(rr.Actions, RoundAction{
					Side: laneSide(role.side), UnitCfgID: role.id, Kind: "move",
				})
				continue
			}
			target, ok := unitTarget(role.id, enemy, tactic)
			if !ok {
				if role.side != 0 {
					continue
				}
				code, wall, found := laneFirstWall(walls)
				if !found {
					continue
				}
				damage := unitWallDamage(role.id, actor[role.id], actorArmy, wall, in.BattleID, round, phase)
				loss := laneWallLoss(wall, damage)
				wall.Count -= loss
				walls[code] = wall
				rr.Actions = append(rr.Actions, RoundAction{
					Side: "attacker", UnitCfgID: role.id, Defense: code, Kind: "attack", DamageHP: int(damage),
				})
				if loss > 0 {
					rr.AttackerToDefHP += int(damage)
				}
				continue
			}
			damage := unitDamage(role.id, actor[role.id], actorArmy, target, enemy[target], enemyArmy, in.BattleID, round, phase)
			applied := unitApplyDamage(enemy, target, damage)
			rr.Actions = append(rr.Actions, RoundAction{
				Side: laneSide(role.side), UnitCfgID: role.id, Kind: "attack", Target: unitStats[target].Role, DamageHP: applied,
			})
			if role.side == 0 {
				rr.AttackerToDefHP += applied
			} else {
				rr.DefenderToAttHP += applied
			}
			if unitTotal(att) == 0 || (unitTotal(def) == 0 && len(wallCounts(walls)) == 0) {
				break
			}
		}
		if unitTotal(att) > 0 && len(wallCounts(walls)) > 0 {
			rr.Actions = append(rr.Actions, laneWallActionsUnits(walls, att, in.Attacker, distance, in.BattleID, round)...)
		}
		rr.Distance = distance
		rr.Defenses = wallCounts(walls)
		rr.AttackerUnits = cloneUnits(att)
		rr.DefenderUnits = cloneUnits(def)
		rr.AttackerTroops = roleTotals(att)
		rr.DefenderTroops = roleTotals(def)
		report.Rounds = append(report.Rounds, rr)
		if unitTotal(att) == 0 || (unitTotal(def) == 0 && len(wallCounts(walls)) == 0) {
			break
		}
	}
	return finalizeUnits(report, att, def, startAtt, startDef, walls)
}

func finalizeUnits(report BattleReport, att, def, startAtt, startDef map[int32]int, walls map[string]WallGroup) BattleReport {
	report.FinalAttackerUnits = cloneUnits(att)
	report.FinalDefenderUnits = cloneUnits(def)
	report.FinalAttacker = roleTotals(att)
	report.FinalDefender = roleTotals(def)
	report.FinalDefenses = wallCounts(walls)
	report.AttackerCasualtiesUnits = unitCasualties(startAtt, att)
	report.DefenderCasualtiesUnits = unitCasualties(startDef, def)
	report.AttackerCasualties = roleTotals(report.AttackerCasualtiesUnits)
	report.DefenderCasualties = roleTotals(report.DefenderCasualtiesUnits)
	if unitTotal(att) == 0 {
		report.Result = ResultDefenderWin
	} else if unitTotal(def) == 0 && len(wallCounts(walls)) == 0 {
		report.Result = ResultAttackerWin
	} else if unitTotal(def) == 0 {
		report.Result = ResultDefenderWin
	} else if unitTotalHP(att) > unitTotalHP(def) {
		report.Result = ResultAttackerWin
	} else {
		report.Result = ResultDefenderWin
	}
	return report
}

func unitTotal(units map[int32]int) int {
	total := 0
	for _, n := range units {
		total += n
	}
	return total
}
