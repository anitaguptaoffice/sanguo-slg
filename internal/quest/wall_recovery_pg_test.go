package quest

import (
	"context"
	"sync"
	"testing"
	"time"
)

type wallReceiptBarrier struct {
	RewardGranter
	RewardReceiptReader
	reached, release chan struct{}
	once             sync.Once
}

func (g *wallReceiptBarrier) FindQuestRewardReceipt(ctx context.Context, r GrantRequest) (GrantReceipt, bool, error) {
	receipt, paid, err := g.RewardReceiptReader.FindQuestRewardReceipt(ctx, r)
	g.once.Do(func() { close(g.reached); <-g.release })
	return receipt, paid, err
}
func waitWallBarrier(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		t.Fatal("wall race did not reach barrier")
	}
}

func TestPGWallReceiptAndFactCoordinatorRaces(t *testing.T) {
	pool, cat, fresh := claimPGFixture(t)
	ctx := context.Background()
	for _, mode := range []string{"new_claim_after_absent_lookup", "paid_history_during_fact_read"} {
		t.Run(mode, func(t *testing.T) {
			actor := Actor{119, time.Now().UnixNano()}
			st := NewPGStore(pool)
			now := time.Now()
			if err := st.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}); err != nil {
				t.Fatal(err)
			}
			svc, g := fresh(st)
			peer, peerGranter := fresh(NewPGStore(pool))
			peer.SetTutorialFactsProvider(wallFacts)
			reached, release := make(chan struct{}), make(chan struct{})
			if mode == "new_claim_after_absent_lookup" {
				svc.granter = &wallReceiptBarrier{RewardGranter: g, RewardReceiptReader: g, reached: reached, release: release}
				svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
					t.Fatal("stale receipt snapshot reached facts")
					return TutorialFacts{}, nil
				})
			} else {
				svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
					close(reached)
					<-release
					return wallFacts(ctx, actor)
				})
			}
			done := make(chan error, 1)
			go func() { done <- svc.RecoverWall(ctx, actor) }()
			waitWallBarrier(t, reached)
			if mode == "new_claim_after_absent_lookup" {
				if _, _, _, err := peer.ClaimQuestReward(ctx, actor, 1006); err != nil {
					close(release)
					t.Fatal(err)
				}
			} else {
				// Inject an old payment during the pause; this is a fault fixture, not
				// permission to run concurrent old writers in the activated deployment.
				cfg, _ := cat.Get(1006)
				if _, err := peerGranter.GrantQuestReward(ctx, wallGrantRequest(actor, cfg)); err != nil {
					close(release)
					t.Fatal(err)
				}
				if err := peer.RecoverWall(ctx, actor); err != nil {
					close(release)
					t.Fatal(err)
				}
				row, _, err := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
				if err != nil || row.State != StateCompleted || row.Progress.ServerVerifiedVersion != 0 {
					close(release)
					t.Fatalf("recovery first %+v %v", row, err)
				}
			}
			close(release)
			if err := <-done; err != nil {
				t.Fatal(err)
			}
			row, _, err := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
			version, floor := int32(2), int32(6)
			if mode == "paid_history_during_fact_read" {
				version, floor = 0, 1
			}
			if err != nil || row.State != StateCompleted || row.Progress.ServerVerifiedVersion != version || row.Progress.LegacyNoPayoutVerified || g.calls.Load() != 0 {
				t.Fatalf("row=%+v error=%v grant=%d", row, err, g.calls.Load())
			}
			if got, err := svc.CompletedWallLevel(ctx, actor); err != nil || got != floor {
				t.Fatalf("floor %d want %d err=%v", got, floor, err)
			}
			assertWallAssets(t, pool, actor, 1)
		})
	}
}
