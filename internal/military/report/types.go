package report

import (
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
)

// Outcome values match spec/db/004_military.sql battle_report.outcome.
const (
	OutcomeAttackerWin int16 = 1
	OutcomeDefenderWin int16 = 2
	OutcomeDraw        int16 = 3
)

// Record is one persisted battle report row.
type Record struct {
	ServerID           int32
	ReportID           int64
	AttackerPlayerID   int64
	DefenderPlayerID   int64
	HasDefenderPlayer  bool
	DefenderCityID     int64
	HasDefenderCity    bool
	LocationX          int
	LocationY          int
	Outcome            int16
	Detail             battle.BattleReport
	CreatedAt          time.Time
}

// SaveParams describes metadata when archiving a battle.BattleReport.
type SaveParams struct {
	ServerID         int32
	ReportID         int64
	AttackerPlayerID int64
	DefenderPlayerID int64
	DefenderCityID   int64
	LocationX        int
	LocationY        int
	Report           battle.BattleReport
}

// ListParams filters paginated player-visible reports (attacker or defender).
type ListParams struct {
	ServerID int32
	PlayerID int64
	Limit    int
	Offset   int
}

// Page is a paginated list result.
type Page struct {
	Items  []Record
	Total  int
	Limit  int
	Offset int
}

// OutcomeFromResult maps engine result to DB outcome.
func OutcomeFromResult(r battle.Result) int16 {
	switch r {
	case battle.ResultAttackerWin:
		return OutcomeAttackerWin
	case battle.ResultDefenderWin:
		return OutcomeDefenderWin
	default:
		return OutcomeDraw
	}
}
