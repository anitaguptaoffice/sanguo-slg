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
	ServerID    int32
	Reports     *report.Service
	Garrisons   GarrisonSource
	UnitCatalog map[int32]march.UnitSpec
	// HeroStats loads the attacker hero's level/force/intel; nil keeps level 0.
	HeroStats func(ctx context.Context, serverID, playerID, heroID int64) (HeroCombatStats, error)
	// TechBonus returns attacker attack/defense percentages from academy research.
	TechBonus     func(order march.MarchOrder) (attackPct, defensePct int32)
	nextReport    int64
	beginArrival  func(context.Context, pgx.TxOptions) (pgx.Tx, error)
	commitArrival func(context.Context, pgx.Tx, march.ArrivalCommit) (march.ArrivalCommitted, error)
}

// NewResolver wires dependencies; catalog defaults to march.DefaultUnitCatalog when nil.
func NewResolver(serverID int32, reports *report.Service, garrisons GarrisonSource, catalog map[int32]march.UnitSpec) *Resolver {
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

// HeroCombatStats is the attacker contribution to one battle.
type HeroCombatStats struct {
	Name  string
	Level int32
	Force int32
	Intel int32
}

// ArrivalResult is the battle outcome and persisted report id (zero if no battle ran).
type ArrivalResult struct {
	ReportID          int64
	Report            battle.BattleReport
	AttackerRemaining []march.TroopStack
	DefenderRemaining []march.TroopStack
	Loot              *march.LootRecord
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
	g := r.Garrisons.Get(ctx, ev.Order.ToX, ev.Order.ToY)
	if (ev.Order.Purpose != PurposeAttack && ev.Order.Purpose != PurposeLoot && ev.Order.Purpose != PurposeOccupy) || g == nil {
		if r.commitArrival != nil {
			return r.persistArrival(ctx, ev, ArrivalResult{AttackerRemaining: append([]march.TroopStack(nil), ev.Troops...)})
		}
		return ArrivalResult{}, nil
	}

	battleID := fmt.Sprintf("march-%d", ev.MarchID)
	attackerID := fmt.Sprintf("player-%d", ev.PlayerID)
	defenderID := fmt.Sprintf("garrison-%d-%d", ev.Order.ToX, ev.Order.ToY)

	var hero HeroCombatStats
	if r.HeroStats != nil && len(ev.HeroIDs) == 1 && ev.HeroIDs[0] > 0 {
		if stats, err := r.HeroStats(ctx, int64(r.ServerID), ev.PlayerID, ev.HeroIDs[0]); err == nil {
			hero = stats
		}
	}
	attacker := ArmyFromStacksWithHero(r.UnitCatalog, ev.Troops, int(hero.Level), hero.Force, hero.Intel, 1)
	if r.TechBonus != nil {
		attacker.TechAttackPct, attacker.TechDefensePct = r.TechBonus(ev.Order)
	}
	bin := battle.BattleInput{
		BattleID:   battleID,
		AttackerID: attackerID,
		DefenderID: defenderID,
		Attacker:   attacker,
		Defender:   ArmyFromStacksWithHero(r.UnitCatalog, g.Troops, g.HeroLevel, g.HeroForce, g.HeroIntel, g.Morale),
	}
	rep := battle.Simulate(bin)
	rep.TargetName = g.Name
	rep.AttackerHero = battle.HeroSummary{Name: hero.Name, Level: hero.Level, Force: hero.Force, Intel: hero.Intel}
	rep.DefenderHero = battle.HeroSummary{Name: g.HeroName, Level: int32(g.HeroLevel), Force: g.HeroForce, Intel: g.HeroIntel}
	var loot *march.LootRecord
	if rep.Result == battle.ResultAttackerWin {
		rep.Loot = g.Loot
		if g.Loot.Food > 0 || g.Loot.Wood > 0 || g.Loot.Stone > 0 || g.Loot.Iron > 0 ||
			g.Loot.Gold > 0 || g.Loot.HeroExp > 0 || len(g.Loot.Items) > 0 {
			loot = &march.LootRecord{Food: g.Loot.Food, Wood: g.Loot.Wood, Stone: g.Loot.Stone,
				Iron: g.Loot.Iron, Gold: g.Loot.Gold, HeroExp: g.Loot.HeroExp}
			for _, item := range g.Loot.Items {
				loot.Items = append(loot.Items, march.LootItem{ItemCfgID: item.ItemCfgID, Count: item.Count})
			}
		}
	}

	attRemain := StacksFromArmy(r.UnitCatalog, rep.FinalAttacker)
	defRemain := StacksFromArmy(r.UnitCatalog, rep.FinalDefender)
	if r.commitArrival != nil {
		return r.persistArrival(ctx, ev, ArrivalResult{Report: rep, AttackerRemaining: attRemain, DefenderRemaining: defRemain, Loot: loot, BattleRan: true})
	}
	r.Garrisons.ApplyRemaining(ctx, ev.Order.ToX, ev.Order.ToY, defRemain)

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
		Loot:              loot,
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
		ToX: int32(order.ToX), ToY: int32(order.ToY), Survivors: result.AttackerRemaining, Loot: result.Loot}
	if order.Purpose == PurposeOccupy && result.BattleRan && result.Report.Result == battle.ResultAttackerWin && ev.OccupyLimit > 0 {
		in.Occupy = &march.OccupyRequest{CityID: order.OriginCityID, Limit: ev.OccupyLimit}
	}
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
		r.Garrisons.ApplyRemaining(ctx, order.ToX, order.ToY, result.DefenderRemaining)
	}
	return result, nil
}
