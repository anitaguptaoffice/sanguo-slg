package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

var errWallStorage = errors.New("injected wall storage failure")

type wallFaultStore struct {
	Store
	mode    string
	written bool
}

func (s *wallFaultStore) GetPlayerQuest(ctx context.Context, server int32, player int64, id int32) (PlayerQuestRow, bool, error) {
	if id == 1006 && (s.mode == "read" || s.written && (s.mode == "postproof_read" || s.mode == "postcompletion_read")) {
		return PlayerQuestRow{}, false, errWallStorage
	}
	return s.Store.GetPlayerQuest(ctx, server, player, id)
}
func (s *wallFaultStore) UpsertPlayerQuest(ctx context.Context, row PlayerQuestRow) error {
	if row.QuestCfgID == 1006 {
		if s.mode == "proof" && row.Progress.ServerVerifiedVersion == 2 {
			return errWallStorage
		}
		if s.mode == "receipt_history" && row.State == StateCompleted {
			return errWallStorage
		}
	}
	err := s.Store.UpsertPlayerQuest(ctx, row)
	if err == nil && row.QuestCfgID == 1006 && ((s.mode == "postproof_read" && row.State == StateClaimable) || (s.mode == "postcompletion_read" && row.State == StateCompleted)) {
		s.written = true
	}
	return err
}
func (s *wallFaultStore) verifyLegacyWall(ctx context.Context, a Actor, now time.Time) error {
	if s.mode == "legacy" {
		return errWallStorage
	}
	return s.Store.(wallLegacyVerifier).verifyLegacyWall(ctx, a, now)
}

type wallGrantFailure struct{ *receiptGranter }

func (g wallGrantFailure) GrantQuestReward(context.Context, GrantRequest) (RewardBundle, error) {
	g.calls++
	return RewardBundle{}, errWallStorage
}

func TestWallStorageFaultMatrix(t *testing.T) {
	t.Run("mem", func(t *testing.T) { testWallStorageFaults(t, NewMemStore()) })
	t.Run("pg", func(t *testing.T) {
		pool := openQuestTestDB(t)
		t.Cleanup(pool.Close)
		applyQuestSchema(t, pool)
		testWallStorageFaults(t, NewPGStore(pool))
	})
}
func testWallStorageFaults(t *testing.T, store Store) {
	ctx := context.Background()
	for _, mode := range []string{"read", "proof", "receipt_history", "legacy", "postproof_read", "postcompletion_read", "grant"} {
		t.Run(mode, func(t *testing.T) {
			actor := Actor{121, time.Now().UnixNano()}
			now := time.Now()
			row := PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}
			if mode == "legacy" {
				row.State, row.AcceptedAt = StateCompleted, nil
			}
			if mode != "receipt_history" {
				if err := store.UpsertPlayerQuest(ctx, row); err != nil {
					t.Fatal(err)
				}
			}
			faults := &wallFaultStore{Store: store, mode: mode}
			g := &receiptGranter{lookup: func(_ context.Context, r GrantRequest) (GrantReceipt, bool, error) {
				return GrantReceipt{GrantID: 8, Rewards: r.Rewards}, mode == "receipt_history", nil
			}}
			svc := wallService(faults, g)
			svc.SetTutorialFactsProvider(wallFacts)
			if mode == "grant" {
				svc.granter = wallGrantFailure{g}
			}
			_, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006)
			if !errors.Is(err, errWallStorage) {
				t.Fatalf("fault result %v", err)
			}
			durable, has, err := store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
			if err != nil {
				t.Fatal(err)
			}
			expectedCalls := 0
			if mode == "postcompletion_read" || mode == "grant" {
				expectedCalls = 1
			}
			if g.calls != expectedCalls {
				t.Fatalf("unexpected Grant calls %d want %d", g.calls, expectedCalls)
			}
			if mode == "receipt_history" && has {
				t.Fatal("failed receipt write inserted history")
			}
			if mode == "proof" || mode == "legacy" || mode == "read" {
				if durable.Progress.ServerVerifiedVersion != 0 {
					t.Fatalf("failed verification left proof %+v", durable)
				}
			}
			recovery := wallService(store, g)
			floor, err := recovery.CompletedWallLevel(ctx, actor)
			want := int32(1)
			if mode == "postcompletion_read" {
				want = 6
			}
			if err != nil || floor != want {
				t.Fatalf("floor %d want %d error=%v", floor, want, err)
			}
			if mode == "postcompletion_read" {
				if _, _, _, err := recovery.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, ErrAlreadyCompleted) || g.calls != 1 {
					t.Fatalf("response loss regrant %v calls=%d", err, g.calls)
				}
			}
		})
	}
}

func TestWallActionBeforeAndAfterAcceptance(t *testing.T) {
	ctx, actor := context.Background(), Actor{1, 54}
	for _, before := range []bool{false, true} {
		t.Run(map[bool]string{false: "after", true: "before"}[before], func(t *testing.T) {
			st := NewMemStore()
			g := &receiptGranter{lookup: func(context.Context, GrantRequest) (GrantReceipt, bool, error) { return GrantReceipt{}, false, nil }}
			svc := wallService(st, g)
			level := int32(0)
			if before {
				level = 1
			}
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				return TutorialFacts{CompletedBuildingLevels: map[int32]int32{7: level}}, nil
			})
			if err := svc.RecoverWall(ctx, actor); err != nil {
				t.Fatal(err)
			}
			if _, has, _ := st.GetPlayerQuest(ctx, 1, 54, 1006); has {
				t.Fatal("passive action autoaccepted")
			}
			view, _, err := svc.AcceptQuest(ctx, actor, 1006)
			if err != nil {
				t.Fatal(err)
			}
			if !before && (view.State != PlayerQuestStateInProgress || view.ProgressCurrent != 0) {
				t.Fatalf("queued/missing wall credited %+v", view)
			}
			level = 1
			if err := svc.RecoverWall(ctx, actor); err != nil {
				t.Fatal(err)
			}
			row, _, _ := st.GetPlayerQuest(ctx, 1, 54, 1006)
			if row.State != StateClaimable || row.Progress.ServerVerifiedVersion != 2 {
				t.Fatal(row)
			}
			if floor, _ := svc.CompletedWallLevel(ctx, actor); floor != 1 {
				t.Fatal(floor)
			}
		})
	}
}
