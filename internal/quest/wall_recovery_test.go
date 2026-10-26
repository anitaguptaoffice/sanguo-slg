package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

func wallService(st Store, g RewardGranter) *Service {
	return NewService(st, NewMemCatalog([]QuestCfg{wallTestConfig()}), g, func(context.Context, int32, int64) (int32, error) { return 5, nil })
}
func wallFacts(context.Context, Actor) (TutorialFacts, error) {
	return TutorialFacts{CompletedBuildingLevels: map[int32]int32{7: 1}}, nil
}

func TestWallRecoveryEligibilityAndNoPassiveLegacy(t *testing.T) {
	ctx, now, actor := context.Background(), time.Now(), Actor{1, 40}
	for _, mode := range []string{"missing", "unaccepted", "accepted", "legacy_claimable", "completed", "completed_null", "paid_missing", "low_level", "no_wall", "no_acceptance"} {
		t.Run(mode, func(t *testing.T) {
			st := NewMemStore()
			g := &receiptGranter{lookup: func(_ context.Context, r GrantRequest) (GrantReceipt, bool, error) {
				return GrantReceipt{GrantID: 1, Rewards: r.Rewards}, mode == "paid_missing", nil
			}}
			svc := wallService(st, g)
			svc.SetTutorialFactsProvider(wallFacts)
			row := PlayerQuestRow{ServerID: 1, PlayerID: 40, QuestCfgID: 1006, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now, Progress: ProgressCounter{Count: 999}}
			if mode == "unaccepted" {
				row.State, row.AcceptedAt = StateUnaccepted, nil
			}
			if mode == "legacy_claimable" {
				row.State = StateClaimable
			}
			if mode == "completed" || mode == "completed_null" {
				row.State = StateCompleted
			}
			if mode == "completed_null" || mode == "no_acceptance" {
				row.AcceptedAt = nil
			}
			if mode != "missing" && mode != "paid_missing" {
				if err := st.UpsertPlayerQuest(ctx, row); err != nil {
					t.Fatal(err)
				}
			}
			if mode == "low_level" {
				svc.level = func(context.Context, int32, int64) (int32, error) { return 4, nil }
			}
			if mode == "no_wall" {
				svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) { return TutorialFacts{}, nil })
			}
			err := svc.RecoverWall(ctx, actor)
			if mode == "no_acceptance" {
				if !errors.Is(err, ErrNotInProgress) {
					t.Fatal(err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			got, has, err := st.GetPlayerQuest(ctx, 1, 40, 1006)
			if err != nil {
				t.Fatal(err)
			}
			wantProof := int32(0)
			if mode == "accepted" || mode == "legacy_claimable" {
				wantProof = 2
			}
			if got.Progress.ServerVerifiedVersion != wantProof || got.Progress.LegacyNoPayoutVerified || g.calls != 0 {
				t.Fatalf("row=%+v grants=%d", got, g.calls)
			}
			if mode == "missing" && has {
				t.Fatal("autoaccepted")
			}
			if mode == "paid_missing" && (got.State != StateCompleted || got.AcceptedAt != nil || got.RewardClaimedAt == nil) {
				t.Fatal(got)
			}
			if floor, err := svc.CompletedWallLevel(ctx, actor); err != nil || floor != 1 {
				t.Fatalf("premature floor %d %v", floor, err)
			}
			if mode == "legacy_claimable" {
				got.Progress = ProgressCounter{Count: 999}
				v := svc.buildProgress(wallTestConfig(), got, true)
				if v.State != PlayerQuestStateInProgress || v.ProgressCurrent != 0 {
					t.Fatal(v)
				}
			}
		})
	}
}

func TestWallEveryNormalProducerIsReceiptFirst(t *testing.T) {
	ctx, actor := context.Background(), Actor{1, 41}
	for _, entry := range []string{"accept", "hook", "chain", "list"} {
		t.Run(entry, func(t *testing.T) {
			st := NewMemStore()
			lookup := false
			g := &receiptGranter{lookup: func(_ context.Context, r GrantRequest) (GrantReceipt, bool, error) {
				lookup = true
				return GrantReceipt{GrantID: 7, Rewards: r.Rewards}, true, nil
			}}
			svc := wallService(st, g)
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				t.Fatal("paid producer read facts")
				return TutorialFacts{}, nil
			})
			if entry != "accept" {
				now := time.Now()
				if err := st.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: 1, PlayerID: 41, QuestCfgID: 1006, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}); err != nil {
					t.Fatal(err)
				}
			}
			var err error
			switch entry {
			case "accept":
				_, _, err = svc.AcceptQuest(ctx, actor, 1006)
			case "hook":
				err = svc.RecoverWall(ctx, actor)
			case "chain":
				_, _, err = svc.GetQuestChainStatus(ctx, actor, 200)
			case "list":
				_, _, err = svc.ListPlayerQuests(ctx, actor, ListQuestsFilter{IncludeCompleted: true})
			}
			r, _, _ := st.GetPlayerQuest(ctx, 1, 41, 1006)
			if entry == "accept" && errors.Is(err, ErrAlreadyCompleted) {
				if r.AcceptedAt != nil {
					t.Fatal("accept manufactured receipt acceptance")
				}
				err = nil
			}
			if err != nil || !lookup || r.State != StateCompleted || r.Progress.ServerVerifiedVersion != 0 || g.calls != 0 {
				t.Fatalf("receipt first err=%v lookup=%v row=%+v calls=%d", err, lookup, r, g.calls)
			}
		})
	}
}
