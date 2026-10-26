package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestWallClaimLegacyNoPayout(t *testing.T) {
	ctx, actor, now := context.Background(), Actor{1, 51}, time.Now()
	for _, mode := range []string{"accepted", "null", "paid_missing", "no_wall", "low_level", "facts_error", "level_error"} {
		t.Run(mode, func(t *testing.T) {
			st := NewMemStore()
			g := &receiptGranter{lookup: func(_ context.Context, r GrantRequest) (GrantReceipt, bool, error) {
				return GrantReceipt{GrantID: 77, Rewards: r.Rewards}, mode == "paid_missing", nil
			}}
			svc := wallService(st, g)
			svc.SetTutorialFactsProvider(wallFacts)
			row := PlayerQuestRow{ServerID: 1, PlayerID: 51, QuestCfgID: 1006, State: StateCompleted, AcceptedAt: &now, CompletedAt: &now, UpdatedAt: now, Progress: ProgressCounter{Count: 88}}
			if mode == "null" {
				row.AcceptedAt = nil
			}
			if mode != "paid_missing" {
				if err := st.UpsertPlayerQuest(ctx, row); err != nil {
					t.Fatal(err)
				}
			}
			injected := errors.New("read failed")
			if mode == "no_wall" {
				svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) { return TutorialFacts{}, nil })
			}
			if mode == "facts_error" {
				svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) { return TutorialFacts{}, injected })
			}
			if mode == "low_level" {
				svc.level = func(context.Context, int32, int64) (int32, error) { return 4, nil }
			}
			if mode == "level_error" {
				svc.level = func(context.Context, int32, int64) (int32, error) { return 0, injected }
			}
			_, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006)
			want := ErrAlreadyCompleted
			if mode == "facts_error" || mode == "level_error" {
				want = injected
			}
			if !errors.Is(err, want) || g.calls != 0 {
				t.Fatalf("err=%v calls=%d", err, g.calls)
			}
			got, _, _ := st.GetPlayerQuest(ctx, 1, 51, 1006)
			verified := mode == "accepted" || mode == "null" || mode == "paid_missing"
			if got.Progress.LegacyNoPayoutVerified != verified || (got.AcceptedAt == nil) != (mode == "null" || mode == "paid_missing") {
				t.Fatal(got)
			}
			if mode != "paid_missing" && (got.RewardClaimedAt != nil || !got.CompletedAt.Equal(now)) {
				t.Fatalf("changed payment history %+v", got)
			}
			floor, e := svc.CompletedWallLevel(ctx, actor)
			expected := int32(1)
			if verified {
				expected = 6
			}
			if e != nil || floor != expected {
				t.Fatalf("floor %d %v", floor, e)
			}
			if verified {
				svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
					t.Fatal("verified completion rechecked lost wall")
					return TutorialFacts{}, nil
				})
				if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, ErrAlreadyCompleted) || g.calls != 0 {
					t.Fatal(err)
				}
			}
		})
	}
}

func TestWallClaimFixedKeyAndDurableProof(t *testing.T) {
	ctx, actor, now := context.Background(), Actor{1, 52}, time.Now()
	st := NewMemStore()
	paid := false
	g := &receiptGranter{lookup: func(_ context.Context, r GrantRequest) (GrantReceipt, bool, error) {
		if r.ServerID != 1 || r.PlayerID != 52 || r.QuestCfgID != 1006 || r.IdempotencyKey != "quest:52:1006:claim" || !wallRewards(r.Rewards) {
			t.Fatal(r)
		}
		return GrantReceipt{GrantID: 8, Rewards: r.Rewards}, paid, nil
	}}
	svc := wallService(st, g)
	svc.SetTutorialFactsProvider(wallFacts)
	if _, _, err := svc.AcceptQuest(ctx, actor, 1006); err != nil {
		t.Fatal(err)
	}
	if floor, _ := svc.CompletedWallLevel(ctx, actor); floor != 1 {
		t.Fatal("claimable raised floor")
	}
	svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
		t.Fatal("durable proof rechecked wall")
		return TutorialFacts{}, nil
	})
	svc.store = failClaimSave{st}
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, errClaimSave) || g.calls != 1 {
		t.Fatalf("save failure %v calls=%d", err, g.calls)
	}
	paid = true
	svc.store = st
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, ErrAlreadyCompleted) || g.calls != 1 {
		t.Fatalf("recovery %v calls=%d", err, g.calls)
	}
	if floor, _ := svc.CompletedWallLevel(ctx, actor); floor != 6 {
		t.Fatal(floor)
	}
	stale := PlayerQuestRow{ServerID: 1, PlayerID: 52, QuestCfgID: 1006, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}
	if err := st.UpsertPlayerQuest(ctx, stale); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, ErrAlreadyCompleted) || g.calls != 1 {
		t.Fatalf("duplicate %v calls=%d", err, g.calls)
	}
}
