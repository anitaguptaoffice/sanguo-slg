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
	// HeroForce and HeroIntel feed the R1-S4 attack/defense multipliers.
	HeroForce int32
	HeroIntel int32
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

// HeroSummary is the player-facing hero card stored in a battle report.
type HeroSummary struct {
	Name  string
	Level int32
	Force int32
	Intel int32
}

// LootItem is one awarded item stack.
type LootItem struct {
	ItemCfgID int32
	Count     int32
}

// Loot is the reward of a won wild/Yellow-Turban battle.
type Loot struct {
	Food, Wood, Stone, Iron, Gold int64
	Items                         []LootItem
	HeroExp                       int64
}

// BattleReport is the full deterministic output.
type BattleReport struct {
	Result             Result
	Rounds             []RoundReport
	AttackerCasualties map[TroopType]int
	DefenderCasualties map[TroopType]int
	FinalAttacker      map[TroopType]int
	FinalDefender      map[TroopType]int
	// R1-S4 report metadata.
	TargetName   string
	AttackerHero HeroSummary
	DefenderHero HeroSummary
	Loot         Loot
	// OccupyResult is "occupied", "cap_reached" or empty when the march did
	// not carry an occupation intent (R1-S5).
	OccupyResult string
}
