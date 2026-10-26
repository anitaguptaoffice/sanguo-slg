package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

type receiptGranter struct {
	mockGranter
	lookup func(context.Context, GrantRequest) (GrantReceipt, bool, error)
}

func (g *receiptGranter) FindQuestRewardReceipt(ctx context.Context, req GrantRequest) (GrantReceipt, bool, error) {
	return g.lookup(ctx, req)
}

func TestTutorialClaimNewEntitlementGates(t *testing.T) {
	ctx, now, actor := context.Background(), time.Now(), Actor{1, 9}
	for _, gate := range []string{"missing", "unaccepted", "accepted_time", "legacy", "prerequisite", "unlock", "config", "unknown_proof", "proof", "revalidate"} {
		t.Run(gate, func(t *testing.T) {
			store, cat, g := NewMemStore(), authoritativeCatalog(t), &mockGranter{}
			row := PlayerQuestRow{ServerID: 1, PlayerID: 9, QuestCfgID: 1002, State: StateInProgress, AcceptedAt: &now}
			put := func(r PlayerQuestRow) {
				t.Helper()
				if err := store.UpsertPlayerQuest(ctx, r); err != nil {
					t.Fatal(err)
				}
			}
			put(row)
			row.State, row.Progress = StateClaimable, ProgressCounter{Count: 1, ServerVerifiedVersion: 1}
			want, level := error(nil), int32(5)
			switch gate {
			case "missing":
				delete(store.rows, questKey(1, 9, 1002))
				want = ErrNotClaimable
			case "unaccepted":
				row.State, row.AcceptedAt, row.Progress = StateUnaccepted, nil, ProgressCounter{}
				want = ErrNotClaimable
			case "accepted_time":
				row.AcceptedAt, row.Progress = nil, ProgressCounter{Count: 99}
				want = ErrNotClaimable
			case "legacy":
				row.Progress, want = ProgressCounter{Count: 99}, ErrNotClaimable
			case "prerequisite":
				want = ErrPrerequisiteNotMet
			case "unlock":
				level, want = 0, ErrLevelTooLow
			case "config":
				cfg := cat.byID[1002]
				cfg.ChainID = 999
				cat.byID[1002], want = cfg, ErrProgressInvalid
			case "unknown_proof":
				row.Progress.ServerVerifiedVersion, want = 2, ErrProgressInvalid
			case "revalidate":
				row.State, row.Progress = StateInProgress, ProgressCounter{}
			}
			if gate != "missing" {
				// Include malformed legacy rows that normal proof-aware writes reject.
				store.rows[questKey(1, 9, 1002)] = row
			}
			if gate != "prerequisite" {
				put(PlayerQuestRow{ServerID: 1, PlayerID: 9, QuestCfgID: 1001, State: StateCompleted})
			}
			svc := NewService(store, cat, g, func(context.Context, int32, int64) (int32, error) { return level, nil })
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				if gate != "revalidate" && gate != "legacy" {
					t.Fatal("durable proof/gates must not consult vanished facts")
				}
				return TutorialFacts{HasOwnedHero: gate == "revalidate"}, nil
			})
			view, _, _, err := svc.ClaimQuestReward(ctx, actor, 1002)
			if !errors.Is(err, want) || (want != nil && g.calls != 0) || (want == nil && (g.calls != 1 || view.State != PlayerQuestStateCompleted)) {
				t.Fatalf("claim=%+v calls=%d error=%v want=%v", view, g.calls, err, want)
			}
		})
	}
}

func TestTutorialPaidReceiptRecovery(t *testing.T) {
	ctx, actor := context.Background(), Actor{1, 10}
	for _, state := range []int16{-1, StateUnaccepted, StateInProgress, StateClaimable, StateCompleted} {
		store, cat, lookups := NewMemStore(), authoritativeCatalog(t), 0
		if state >= 0 {
			if err := store.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: 1, PlayerID: 10, QuestCfgID: 1002, State: state}); err != nil {
				t.Fatal(err)
			}
		}
		g := &receiptGranter{lookup: func(_ context.Context, req GrantRequest) (GrantReceipt, bool, error) {
			lookups++
			if req.ServerID != 1 || req.PlayerID != 10 || req.IdempotencyKey != "quest:10:1002:claim" {
				t.Fatal(req)
			}
			return GrantReceipt{GrantID: 31, Rewards: req.Rewards}, true, nil
		}}
		svc := NewService(store, cat, g, func(context.Context, int32, int64) (int32, error) {
			t.Fatal("paid recovery checked new entitlement")
			return 0, nil
		})
		svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
			t.Fatal("paid recovery revalidated vanished facts")
			return TutorialFacts{}, nil
		})
		view, _, _, err := svc.ClaimQuestReward(ctx, actor, 1002)
		if state == StateCompleted {
			if !errors.Is(err, ErrAlreadyCompleted) || lookups != 0 {
				t.Fatalf("completed: %v lookups=%d", err, lookups)
			}
		} else if err != nil || view.State != PlayerQuestStateCompleted {
			t.Fatalf("recovery: %+v %v", view, err)
		}
		row, _, _ := store.GetPlayerQuest(ctx, 1, 10, 1002)
		if g.calls != 0 || row.Progress.ServerVerifiedVersion != 0 || (state != StateCompleted && (row.RewardClaimedAt == nil || row.CompletedAt == nil)) {
			t.Fatalf("recovery granted/invented proof or lost timestamps: %+v calls=%d", row, g.calls)
		}
	}
}

func TestTutorialClaimFailsClosedAndRereads(t *testing.T) {
	ctx, actor, now := context.Background(), Actor{1, 11}, time.Now()
	for _, mode := range []string{"receipt_error", "invalid_receipt", "receipt_race", "facts_race_met", "facts_race_unmet", "unsupported"} {
		t.Run(mode, func(t *testing.T) {
			store, cat := NewMemStore(), authoritativeCatalog(t)
			row := PlayerQuestRow{ServerID: 1, PlayerID: 11, QuestCfgID: 1001, State: StateInProgress, AcceptedAt: &now}
			if err := store.UpsertPlayerQuest(ctx, row); err != nil {
				t.Fatal(err)
			}
			complete := func() {
				row.State, row.RewardClaimedAt = StateCompleted, &now
				if err := store.UpsertPlayerQuest(ctx, row); err != nil {
					t.Fatal(err)
				}
			}
			lookupErr := errors.New("receipt lookup failed")
			g := &receiptGranter{lookup: func(context.Context, GrantRequest) (GrantReceipt, bool, error) {
				if mode == "receipt_error" {
					return GrantReceipt{}, false, lookupErr
				}
				if mode == "receipt_race" {
					complete()
				}
				return GrantReceipt{}, mode == "invalid_receipt", nil
			}}
			svc := NewService(store, cat, g, nil)
			if mode == "unsupported" {
				svc.granter = nil
			}
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				complete()
				facts := TutorialFacts{}
				if mode == "facts_race_met" {
					facts.CompletedBuildingLevels = map[int32]int32{1: 2}
				}
				return facts, nil
			})
			_, _, _, err := svc.ClaimQuestReward(ctx, actor, 1001)
			want := ErrAlreadyCompleted
			if mode == "receipt_error" {
				want = lookupErr
			} else if mode == "invalid_receipt" || mode == "unsupported" {
				want = ErrGrantFailed
			}
			if !errors.Is(err, want) || g.calls != 0 {
				t.Fatalf("error=%v want=%v grants=%d", err, want, g.calls)
			}
		})
	}
}
