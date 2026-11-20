package march

import (
	"context"
)

// MarchArrivalEvent is passed to combat orchestration when a march reaches its target.
type MarchArrivalEvent struct {
	MarchID  int64
	PlayerID int64
	HeroIDs  []int64
	Troops   []TroopStack
	Order    MarchOrder
	// OccupyLimit is the origin city's free field slots (hall level). The API
	// layer fills it; zero disables occupation.
	OccupyLimit int
}

// MarchArrivalOutcome carries battle results back into the hub state machine.
type MarchArrivalOutcome struct {
	Durable         bool // true also on failure; Hub quarantines rather than finishing
	ReportID        int64
	RemainingTroops []TroopStack
	BattleRan       bool
}

// MarchArrivalHandler resolves combat and report persistence (wired from combat package).
type MarchArrivalHandler func(ctx context.Context, ev MarchArrivalEvent) (MarchArrivalOutcome, error)
