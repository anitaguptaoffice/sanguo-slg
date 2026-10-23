package battle

// TroopType matches spec/rules combat troop keys.
type TroopType string

const (
	TroopInfantry TroopType = "infantry"
	TroopCavalry  TroopType = "cavalry"
	TroopArcher   TroopType = "archer"
	TroopSiege    TroopType = "siege"
)

// AllTroopTypes is a stable iteration order for reports and tests.
var AllTroopTypes = []TroopType{
	TroopInfantry, TroopCavalry, TroopArcher, TroopSiege,
}

// Army is one side's snapshot at battle start (spec/rules combat.md §3).
type Army struct {
	Troops    map[TroopType]int
	HeroLevel int
	Morale    float64
}

// BattleInput is the pure-function input; IDs break speed ties (§6).
type BattleInput struct {
	BattleID   string
	AttackerID string
	DefenderID string
	Attacker   Army
	Defender   Army
}

// Result is the battle outcome (§7).
type Result string

const (
	ResultAttackerWin Result = "attacker_win"
	ResultDefenderWin Result = "defender_win"
)

// RoundReport records one round's damage and troop snapshots after the round.
type RoundReport struct {
	Round           int
	AttackerTroops  map[TroopType]int
	DefenderTroops  map[TroopType]int
	AttackerToDefHP int
	DefenderToAttHP int
}

// BattleReport is the full deterministic output.
type BattleReport struct {
	Result             Result
	Rounds             []RoundReport
	AttackerCasualties map[TroopType]int
	DefenderCasualties map[TroopType]int
	FinalAttacker      map[TroopType]int
	FinalDefender      map[TroopType]int
}
