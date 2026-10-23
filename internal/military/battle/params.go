package battle

// Combat constants copied from spec/rules/params.yml (read-only reference).

const (
	maxRounds           = 8
	roundDamageMult     = 1.0
	damageRandomMin     = 0.95
	damageRandomMax     = 1.05
	counterAdvantage    = 1.25
	counterDisadvantage = 0.80
	counterNeutral      = 1.00
	heroEnabled         = true
	heroAtkPerLevel     = 0.02
	heroDefPerLevel     = 0.02
	heroMaxLevelM1      = 20
	moraleMin           = 0.5
	moraleMax           = 1.2
	defaultMorale       = 1.0
	damageEpsilon       = 1.0
)

type troopStat struct {
	atk   float64
	def   float64
	hp    float64
	speed float64
}

var troopStats = map[TroopType]troopStat{
	TroopInfantry: {atk: 10, def: 15, hp: 100, speed: 50},
	TroopCavalry:  {atk: 18, def: 8, hp: 80, speed: 100},
	TroopArcher:   {atk: 14, def: 6, hp: 70, speed: 60},
	TroopSiege:    {atk: 25, def: 5, hp: 50, speed: 30},
}

// counterEdges: attacker troop type counters defender troop type.
var counterEdges = map[TroopType]TroopType{
	TroopCavalry:  TroopInfantry,
	TroopInfantry: TroopArcher,
	TroopArcher:   TroopCavalry,
}
