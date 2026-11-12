package combat

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
)

type arrivalTx struct {
	pgx.Tx
	commitErr          error
	commits, rollbacks int
}

func (tx *arrivalTx) Commit(context.Context) error {
	tx.commits++
	return tx.commitErr
}
func (tx *arrivalTx) Rollback(context.Context) error {
	tx.rollbacks++
	return nil
}

func TestDurableResolverTransactionBoundary(t *testing.T) {
	failure := errors.New("injected storage failure")
	for _, stage := range []string{"begin", "transition", "commit", "success", "no-battle"} {
		t.Run(stage, func(t *testing.T) {
			r := NewResolver(1, nil, M2FixtureGarrisons(), nil)
			before := r.Garrisons.Get(5, 5)
			ev := march.MarchArrivalEvent{MarchID: 9, PlayerID: 1001,
				Troops: []march.TroopStack{{UnitCfgID: 1, Count: 200}},
				Order: march.MarchOrder{ArmyID: 7, ToX: 5, ToY: 5, Purpose: PurposeAttack,
					Phase: march.PhaseArrived, Speed: 100, ArriveAt: time.Unix(100, 0)}}
			if stage == "no-battle" {
				ev.Order.Purpose = 0
			}
			tx := &arrivalTx{}
			if stage == "commit" {
				tx.commitErr = failure
			}
			r.beginArrival = func(context.Context, pgx.TxOptions) (pgx.Tx, error) {
				if stage == "begin" {
					return nil, failure
				}
				return tx, nil
			}
			r.commitArrival = func(_ context.Context, got pgx.Tx, in march.ArrivalCommit) (march.ArrivalCommitted, error) {
				if got != tx || in.ArmyID != 7 || in.MarchID != 9 || in.ServerID != 1 {
					t.Fatalf("incorrect transaction input: %+v", in)
				}
				if !reflect.DeepEqual(r.Garrisons.Get(5, 5), before) {
					t.Fatal("defenders mutated before commit")
				}
				if stage == "no-battle" {
					want := ev.Order
					if err := march.BeginReturn(&want, ev.Order.ArriveAt); err != nil {
						t.Fatal(err)
					}
					if in.Report != nil || !reflect.DeepEqual(in.Survivors, ev.Troops) || !in.ReturnAt.Equal(want.ReturnFinishAt) {
						t.Fatalf("no-battle input: %+v", in)
					}
				} else if in.Report == nil || in.Report.ReportID != 0 {
					t.Fatal("durable report must use transaction allocator")
				}
				if stage == "transition" {
					return march.ArrivalCommitted{}, failure
				}
				return march.ArrivalCommitted{ReportID: 77}, nil
			}
			out, err := r.HubHandler()(context.Background(), ev)
			if !out.Durable {
				t.Fatal("durable marker lost")
			}
			failed := stage == "begin" || stage == "transition" || stage == "commit"
			if failed {
				if !errors.Is(err, failure) || !reflect.DeepEqual(r.Garrisons.Get(5, 5), before) {
					t.Fatalf("failure published state: err=%v", err)
				}
			} else if err != nil || out.ReportID != 77 || tx.commits != 1 {
				t.Fatalf("success: %+v err=%v commits=%d", out, err, tx.commits)
			}
			if stage != "begin" && tx.rollbacks != 1 {
				t.Fatal("missing transaction cleanup")
			}
			if stage == "transition" && tx.commits != 0 {
				t.Fatal("committed failed transition")
			}
			if stage == "success" && reflect.DeepEqual(r.Garrisons.Get(5, 5), before) {
				t.Fatal("defenders not published")
			}
		})
	}
}

func TestDurableResolverValidationKeepsMarker(t *testing.T) {
	r := NewResolver(1, nil, nil, nil)
	if r.EnableDurableArrival(nil, nil) == nil {
		t.Fatal("accepted missing dependencies")
	}
	r.commitArrival = func(context.Context, pgx.Tx, march.ArrivalCommit) (march.ArrivalCommitted, error) {
		t.Fatal("invalid phase reached persistence")
		return march.ArrivalCommitted{}, nil
	}
	out, err := r.HubHandler()(context.Background(), march.MarchArrivalEvent{Troops: []march.TroopStack{{UnitCfgID: 1, Count: 1}}})
	if err == nil || !out.Durable {
		t.Fatalf("validation: %+v %v", out, err)
	}
}

func TestResolverDefaultOffAndDurableAnnihilation(t *testing.T) {
	r := NewResolver(1, nil, nil, nil)
	ev := march.MarchArrivalEvent{MarchID: 9, PlayerID: 1,
		Order: march.MarchOrder{ArmyID: 7, Phase: march.PhaseArrived, ArriveAt: time.Unix(100, 0)}}
	out, err := r.HubHandler()(context.Background(), ev)
	if err != nil || out.Durable || out.BattleRan || out.ReportID != 0 || out.RemainingTroops != nil {
		t.Fatalf("legacy no-battle changed: %+v %v", out, err)
	}
	tx := &arrivalTx{}
	r.beginArrival = func(context.Context, pgx.TxOptions) (pgx.Tx, error) { return tx, nil }
	r.commitArrival = func(_ context.Context, _ pgx.Tx, in march.ArrivalCommit) (march.ArrivalCommitted, error) {
		if len(in.Survivors) != 0 || !in.ReturnAt.IsZero() || in.Report == nil {
			t.Fatalf("annihilation input: %+v", in)
		}
		return march.ArrivalCommitted{Status: 4, ReportID: 8}, nil
	}
	result, err := r.persistArrival(context.Background(), ev, ArrivalResult{BattleRan: true})
	if err != nil || result.ReportID != 8 || tx.commits != 1 {
		t.Fatalf("annihilation commit: %+v %v", result, err)
	}
}
