package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestWallCompletedLegacyRejectsBadReceipt(t *testing.T) {
	ctx, actor, now := context.Background(), Actor{1, 53}, time.Now()
	for _, mode := range []string{"lookup_error", "zero_grant", "wrong_rewards", "unsupported"} {
		t.Run(mode, func(t *testing.T) {
			st := NewMemStore()
			injected := errors.New("receipt read failed")
			g := &receiptGranter{lookup: func(_ context.Context, r GrantRequest) (GrantReceipt, bool, error) {
				if mode == "lookup_error" {
					return GrantReceipt{}, false, injected
				}
				receipt := GrantReceipt{GrantID: 2, Rewards: r.Rewards}
				if mode == "zero_grant" {
					receipt.GrantID = 0
				}
				if mode == "wrong_rewards" {
					receipt.Rewards = RewardBundle{}
				}
				return receipt, true, nil
			}}
			svc := wallService(st, g)
			if mode == "unsupported" {
				svc.granter = nil
			}
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				t.Fatal("bad payment evidence reached facts")
				return TutorialFacts{}, nil
			})
			if err := st.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: 1, PlayerID: 53, QuestCfgID: 1006, State: StateCompleted, UpdatedAt: now}); err != nil {
				t.Fatal(err)
			}
			_, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006)
			want := ErrGrantFailed
			if mode == "lookup_error" {
				want = injected
			}
			if !errors.Is(err, want) || g.calls != 0 {
				t.Fatalf("err=%v calls=%d", err, g.calls)
			}
			row, _, _ := st.GetPlayerQuest(ctx, 1, 53, 1006)
			if row.Progress.ServerVerifiedVersion != 0 || row.AcceptedAt != nil {
				t.Fatal(row)
			}
			if floor, _ := svc.CompletedWallLevel(ctx, actor); floor != 1 {
				t.Fatal("bad receipt raised floor")
			}
		})
	}
}
