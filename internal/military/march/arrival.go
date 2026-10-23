package march

import (
	"context"
)

// MarchArrivalEvent is passed to combat orchestration when a march reaches its target.
type MarchArrivalEvent struct {
	MarchID  int64
	PlayerID int64
	Troops   []TroopStack
	Order    MarchOrder
}

// MarchArrivalOutcome carries battle results back into the hub state machine.
type MarchArrivalOutcome struct {
	ReportID        int64
	RemainingTroops []TroopStack
	BattleRan       bool
}

// MarchArrivalHandler resolves combat and report persistence (wired from combat package).
type MarchArrivalHandler func(ctx context.Context, ev MarchArrivalEvent) (MarchArrivalOutcome, error)
