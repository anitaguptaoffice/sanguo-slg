package battle

import (
	"math"
	"sort"
)

// Lane mechanics turn the four troop roles into a one-dimensional battlefield.
// Groups advance until their range covers the enemy, then attack. All groups
// act once per round in descending speed order; the battle is capped at 40
// rounds. This is the R3-S1 replacement for pooled simultaneous strikes.
const (
	laneMaxRounds       = 40
	laneDamageScale     = 1.0
	laneInitialDistance = 1
)

type laneRole struct {
	side  int // 0 attacker, 1 defender
	troop TroopType
	speed float64
	reach int
}

// Tactic is the drill-ground preset for one troop role.
type Tactic struct {
	// Target is the preferred enemy role. Empty chooses the default order.
	Target TroopType
	// Hold prevents this role from advancing.
	Hold bool
}

// RoundAction is one group action inside a round.
type RoundAction struct {
	Side     string
	Troop    TroopType
	Kind     string // "move" or "attack"
	Target   TroopType
	DamageHP int
}

func laneRange(tt TroopType) int {
	switch tt {
	case TroopArcher:
		return 12
	case TroopSiege:
		return 16
	default:
		return 2
	}
}

func laneInitial(troops ...map[TroopType]int) int {
	distance := laneInitialDistance
	for _, side := range troops {
		for _, tt := range AllTroopTypes {
			if side[tt] > 0 && laneRange(tt) > distance {
				distance = laneRange(tt)
			}
		}
	}
	return distance
}

func laneSpeed(tt TroopType) float64 {
	return troopStats[tt].speed
}

func laneTurnOrder() []laneRole {
	var order []laneRole
	for _, tt := range AllTroopTypes {
		order = append(order, laneRole{side: 0, troop: tt, speed: laneSpeed(tt), reach: laneRange(tt)})
	}
	for _, tt := range AllTroopTypes {
		order = append(order, laneRole{side: 1, troop: tt, speed: laneSpeed(tt), reach: laneRange(tt)})
	}
	sort.SliceStable(order, func(i, j int) bool {
		if order[i].speed != order[j].speed {
			return order[i].speed > order[j].speed
		}
		if order[i].side != order[j].side {
			return order[i].side < order[j].side
		}
		return order[i].troop < order[j].troop
	})
	return order
}

func laneTarget(actor TroopType, enemy map[TroopType]int, tactic Tactic) (TroopType, bool) {
	if tactic.Target != "" && enemy[tactic.Target] > 0 {
		return tactic.Target, true
	}
	for _, tt := range []TroopType{TroopInfantry, TroopCavalry, TroopArcher, TroopSiege} {
		if enemy[tt] > 0 {
			return tt, true
		}
	}
	return "", false
}

func laneDamage(actor TroopType, actorCount int, actorArmy Army, target TroopType, targetCount int, targetArmy Army, battleID string, round, phase int) int {
	atk := troopStats[actor]
	def := troopStats[target]
	atkHero, _ := heroStatsMults(actorArmy)
	_, defHero := heroStatsMults(targetArmy)
	atkPool := float64(actorCount) * atk.atk * atkHero * clampMorale(actorArmy.Morale) * counterMult(actor, target)
	defPool := float64(targetCount) * def.def * defHero * clampMorale(targetArmy.Morale)
	raw := atkPool * atkPool / (atkPool + defPool + damageEpsilon) * laneDamageScale * damageUniform(battleID, round, phase, string(actor))
	return int(math.Floor(raw))
}

func laneApplyDamage(troops map[TroopType]int, target TroopType, damageHP int) int {
	count := troops[target]
	if count <= 0 || damageHP <= 0 {
		return 0
	}
	hp := troopStats[target].hp
	loss := int(math.Ceil(float64(damageHP) / hp))
	if loss > count {
		loss = count
	}
	troops[target] = count - loss
	return loss * int(hp)
}

func simulateLane(in BattleInput) BattleReport {
	att := cloneTroops(in.Attacker.Troops)
	def := cloneTroops(in.Defender.Troops)
	startAtt := cloneTroops(att)
	startDef := cloneTroops(def)

	report := BattleReport{
		Rounds:             nil,
		AttackerCasualties: emptyCasualties(),
		DefenderCasualties: emptyCasualties(),
	}
	if troopTotal(att) == 0 || troopTotal(def) == 0 {
		report.FinalAttacker = cloneTroops(att)
		report.FinalDefender = cloneTroops(def)
		report.Result = decideResult(att, def, in)
		report.AttackerCasualties = casualties(startAtt, att)
		report.DefenderCasualties = casualties(startDef, def)
		return report
	}

	distance := laneInitial(att, def)
	report.StartDistance = distance
	order := laneTurnOrder()
	for round := 1; round <= laneMaxRounds; round++ {
		if troopTotal(att) == 0 || troopTotal(def) == 0 {
			break
		}
		rr := RoundReport{Round: round, Actions: nil}
		for phase, role := range order {
			var actor map[TroopType]int
			var enemy map[TroopType]int
			var actorArmy, enemyArmy Army
			if role.side == 0 {
				actor, enemy = att, def
				actorArmy, enemyArmy = in.Attacker, in.Defender
			} else {
				actor, enemy = def, att
				actorArmy, enemyArmy = in.Defender, in.Attacker
			}
			if actor[role.troop] <= 0 {
				continue
			}
			tactic := actorArmy.Tactics[role.troop]
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
					Side: laneSide(role.side), Troop: role.troop, Kind: "move",
				})
				continue
			}
			target, ok := laneTarget(role.troop, enemy, tactic)
			if !ok {
				continue
			}
			damage := laneDamage(role.troop, actor[role.troop], actorArmy, target, enemy[target], enemyArmy,
				in.BattleID, round, phase)
			applied := laneApplyDamage(enemy, target, damage)
			rr.Actions = append(rr.Actions, RoundAction{
				Side: laneSide(role.side), Troop: role.troop, Kind: "attack", Target: target, DamageHP: applied,
			})
			if role.side == 0 {
				rr.AttackerToDefHP += applied
			} else {
				rr.DefenderToAttHP += applied
			}
			if troopTotal(att) == 0 || troopTotal(def) == 0 {
				break
			}
		}
		rr.Distance = distance
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

func laneSide(side int) string {
	if side == 0 {
		return "attacker"
	}
	return "defender"
}
