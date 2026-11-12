package combat

import (
	"context"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/jackc/pgx/v5"
)

// Resolver runs battle simulation and archives reports on march arrival.
type Resolver struct {
	ServerID      int32
	Reports       *report.Service
	Garrisons     *GarrisonTable
	UnitCatalog   map[int32]march.UnitSpec
	nextReport    int64
	beginArrival  func(context.Context, pgx.TxOptions) (pgx.Tx, error)
	commitArrival func(context.Context, pgx.Tx, march.ArrivalCommit) (march.ArrivalCommitted, error)
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

// EnableDurableArrival opts into caller-owned arrival transactions. Configure before use.
// Production wiring deliberately does not enable this path.
func (r *Resolver) EnableDurableArrival(begin func(context.Context, pgx.TxOptions) (pgx.Tx, error), transition *march.MarchTransition) error {
	if begin == nil || transition == nil {
		return fmt.Errorf("combat: durable arrival requires transaction provider and transition")
	}
	r.beginArrival, r.commitArrival = begin, transition.Commit
	return nil
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
			return march.MarchArrivalOutcome{Durable: r.commitArrival != nil}, err
		}
		return march.MarchArrivalOutcome{
			Durable:         r.commitArrival != nil,
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
	g := r.Garrisons.Get(ev.Order.ToX, ev.Order.ToY)
	if ev.Order.Purpose != PurposeAttack || g == nil {
		if r.commitArrival != nil {
			return r.persistArrival(ctx, ev, ArrivalResult{AttackerRemaining: append([]march.TroopStack(nil), ev.Troops...)})
		}
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
	if r.commitArrival != nil {
		return r.persistArrival(ctx, ev, ArrivalResult{Report: rep, AttackerRemaining: attRemain, DefenderRemaining: defRemain, BattleRan: true})
	}
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

// persistArrival publishes volatile defenders only after the outer transaction commits.
func (r *Resolver) persistArrival(ctx context.Context, ev march.MarchArrivalEvent, result ArrivalResult) (ArrivalResult, error) {
	order := ev.Order
	if (order.Phase != march.PhaseMarching && order.Phase != march.PhaseArrived) || order.ArriveAt.IsZero() {
		return ArrivalResult{}, march.ErrInvalidMarch
	}
	if order.Phase == march.PhaseMarching {
		if err := march.MarkArrived(&order); err != nil {
			return ArrivalResult{}, err
		}
	}
	in := march.ArrivalCommit{ServerID: r.ServerID, MarchID: ev.MarchID, ArmyID: order.ArmyID,
		ToX: int32(order.ToX), ToY: int32(order.ToY), Survivors: result.AttackerRemaining}
	if len(in.Survivors) > 0 {
		if err := march.BeginReturn(&order, order.ArriveAt); err != nil {
			return ArrivalResult{}, err
		}
		in.ReturnAt = order.ReturnFinishAt
	}
	if result.BattleRan {
		in.Report = &report.SaveParams{ServerID: r.ServerID, AttackerPlayerID: ev.PlayerID,
			LocationX: order.ToX, LocationY: order.ToY, Report: result.Report}
	}
	tx, err := r.beginArrival(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return ArrivalResult{}, err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	committed, err := r.commitArrival(ctx, tx, in)
	if err != nil {
		return ArrivalResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ArrivalResult{}, err
	}
	result.ReportID = committed.ReportID
	if result.BattleRan {
		r.Garrisons.ApplyRemaining(order.ToX, order.ToY, result.DefenderRemaining)
	}
	return result, nil
}
