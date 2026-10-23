package combat

import (
	"context"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
)

// Resolver runs battle simulation and archives reports on march arrival.
type Resolver struct {
	ServerID    int32
	Reports     *report.Service
	Garrisons   *GarrisonTable
	UnitCatalog map[int32]march.UnitSpec
	nextReport  int64
}

// NewResolver wires dependencies; catalog defaults to march.DefaultUnitCatalog when nil.
func NewResolver(serverID int32, reports *report.Service, garrisons *GarrisonTable, catalog map[int32]march.UnitSpec) *Resolver {
	if catalog == nil {
		catalog = march.DefaultUnitCatalog()
	}
	if garrisons == nil {
		garrisons = NewGarrisonTable()
	}
	return &Resolver{
		ServerID:    serverID,
		Reports:     reports,
		Garrisons:   garrisons,
		UnitCatalog: catalog,
	}
}

// ArrivalResult is the battle outcome and persisted report id (zero if no battle ran).
type ArrivalResult struct {
	ReportID          int64
	Report            battle.BattleReport
	AttackerRemaining []march.TroopStack
	DefenderRemaining []march.TroopStack
	BattleRan         bool
}

// HubHandler adapts the resolver to march.MarchArrivalHandler.
func (r *Resolver) HubHandler() march.MarchArrivalHandler {
	return func(ctx context.Context, ev march.MarchArrivalEvent) (march.MarchArrivalOutcome, error) {
		res, err := r.ResolveAttackGarrison(ctx, ev)
		if err != nil {
			return march.MarchArrivalOutcome{}, err
		}
		return march.MarchArrivalOutcome{
			ReportID:        res.ReportID,
			RemainingTroops: res.AttackerRemaining,
			BattleRan:       res.BattleRan,
		}, nil
	}
}

func (r *Resolver) allocReportID() int64 {
	r.nextReport++
	return r.nextReport
}

// ResolveAttackGarrison handles PurposeAttack against a fixed garrison tile.
func (r *Resolver) ResolveAttackGarrison(ctx context.Context, ev march.MarchArrivalEvent) (ArrivalResult, error) {
	if ev.Order.Purpose != PurposeAttack {
		return ArrivalResult{}, nil
	}
	g := r.Garrisons.Get(ev.Order.ToX, ev.Order.ToY)
	if g == nil {
		return ArrivalResult{}, nil
	}

	battleID := fmt.Sprintf("march-%d", ev.MarchID)
	attackerID := fmt.Sprintf("player-%d", ev.PlayerID)
	defenderID := fmt.Sprintf("garrison-%d-%d", ev.Order.ToX, ev.Order.ToY)

	bin := battle.BattleInput{
		BattleID:   battleID,
		AttackerID: attackerID,
		DefenderID: defenderID,
		Attacker:   ArmyFromStacks(r.UnitCatalog, ev.Troops, 0, 1),
		Defender:   ArmyFromStacks(r.UnitCatalog, g.Troops, g.HeroLevel, g.Morale),
	}
	rep := battle.Simulate(bin)

	attRemain := StacksFromArmy(r.UnitCatalog, rep.FinalAttacker)
	defRemain := StacksFromArmy(r.UnitCatalog, rep.FinalDefender)
	r.Garrisons.ApplyRemaining(ev.Order.ToX, ev.Order.ToY, defRemain)

	reportID := r.allocReportID()
	rec, err := r.Reports.Save(ctx, report.SaveParams{
		ServerID:         r.ServerID,
		ReportID:         reportID,
		AttackerPlayerID: ev.PlayerID,
		LocationX:        ev.Order.ToX,
		LocationY:        ev.Order.ToY,
		Report:           rep,
	})
	if err != nil {
		return ArrivalResult{}, err
	}

	return ArrivalResult{
		ReportID:          rec.ReportID,
		Report:            rep,
		AttackerRemaining: attRemain,
		DefenderRemaining: defRemain,
		BattleRan:         true,
	}, nil
}
