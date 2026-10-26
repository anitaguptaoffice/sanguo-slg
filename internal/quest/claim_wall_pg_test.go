package quest

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5/pgxpool"
)

func assertWallAssets(t *testing.T, pool *pgxpool.Pool, a Actor, grants int) {
	t.Helper()
	ctx := context.Background()
	var n, qty int
	var wood int64
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$2`, a.ServerID, QuestClaimIdempotencyKey(a.PlayerID, 1006)).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COALESCE(sum(quantity),0) FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=2018`, a.ServerID, a.PlayerID).Scan(&qty); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COALESCE((SELECT wood FROM player_wallet WHERE server_id=$1 AND player_id=$2),0)`, a.ServerID, a.PlayerID).Scan(&wood); err != nil {
		t.Fatal(err)
	}
	if n != grants || qty != grants || wood != int64(grants)*800 {
		t.Fatalf("receipt=%d item=%d wood=%d expected grants=%d", n, qty, wood, grants)
	}
}

func TestPGWallGrantSaveFailureRestartRecovery(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	ctx, actor := context.Background(), Actor{114, time.Now().UnixNano()}
	st := NewPGStore(pool)
	svc, g := fresh(st)
	svc.SetTutorialFactsProvider(wallFacts)
	if _, _, err := svc.AcceptQuest(ctx, actor, 1006); err != nil {
		t.Fatal(err)
	}
	svc.store = failClaimSave{st}
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, errClaimSave) || g.calls.Load() != 1 {
		t.Fatalf("failed completion %v calls=%d", err, g.calls.Load())
	}
	assertWallAssets(t, pool, actor, 1)
	row, _, err := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
	if err != nil || row.State != StateClaimable || row.Progress.ServerVerifiedVersion != 2 {
		t.Fatalf("durable pregrant proof %+v %v", row, err)
	}
	svc, g = fresh(NewPGStore(pool)) // Fresh quest/content services: no caches survive.
	svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
		t.Fatal("receipt recovery required vanished wall")
		return TutorialFacts{}, nil
	})
	if err := svc.RecoverWall(ctx, actor); err != nil {
		t.Fatal(err)
	}
	if floor, err := svc.CompletedWallLevel(ctx, actor); err != nil || floor != 6 {
		t.Fatalf("floor %d %v", floor, err)
	}
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, ErrAlreadyCompleted) || g.calls.Load() != 0 {
		t.Fatalf("duplicate %v calls=%d", err, g.calls.Load())
	}
	assertWallAssets(t, pool, actor, 1)
}

func TestPGWallReceiptMissingRowExplicitNoPayout(t *testing.T) {
	pool, cat, fresh := claimPGFixture(t)
	ctx := context.Background()
	for _, accepted := range []bool{false, true} {
		t.Run(fmt.Sprint(accepted), func(t *testing.T) {
			actor := Actor{115, time.Now().UnixNano()}
			st := NewPGStore(pool)
			cfg, _ := cat.Get(1006)
			_, writer := fresh(st)
			if _, err := writer.GrantQuestReward(ctx, wallGrantRequest(actor, cfg)); err != nil {
				t.Fatal(err)
			} // Isolated historical-payment fixture.
			if accepted {
				now := time.Now()
				if err := st.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006, State: StateClaimable, AcceptedAt: &now, UpdatedAt: now, Progress: ProgressCounter{Count: 999}}); err != nil {
					t.Fatal(err)
				}
			}
			svc, g := fresh(st)
			svc.SetTutorialFactsProvider(wallFacts)
			if err := svc.RecoverWall(ctx, actor); err != nil {
				t.Fatal(err)
			}
			row, _, _ := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
			if row.Progress.ServerVerifiedVersion != 0 || row.State != StateCompleted || (row.AcceptedAt != nil) != accepted {
				t.Fatal(row)
			}
			if floor, _ := svc.CompletedWallLevel(ctx, actor); floor != 1 {
				t.Fatal("payment manufactured floor")
			}
			if _, _, err := svc.AcceptQuest(ctx, actor, 1006); !errors.Is(err, ErrAlreadyCompleted) {
				t.Fatal(err)
			}
			if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, ErrAlreadyCompleted) {
				t.Fatal(err)
			}
			verified, _, _ := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
			if !verified.Progress.LegacyNoPayoutVerified || verified.Progress.Count != 1 || (verified.AcceptedAt != nil) != accepted || !verified.CompletedAt.Equal(*row.CompletedAt) || !verified.RewardClaimedAt.Equal(*row.RewardClaimedAt) || g.calls.Load() != 0 {
				t.Fatalf("verification changed history %+v calls=%d", verified, g.calls.Load())
			}
			if floor, _ := svc.CompletedWallLevel(ctx, actor); floor != 6 {
				t.Fatal(floor)
			}
			assertWallAssets(t, pool, actor, 1)
		})
	}
}

func TestPGWallWrongReceiptFailsClosed(t *testing.T) {
	pool, cat, fresh := claimPGFixture(t)
	ctx := context.Background()
	for _, mutation := range []string{"player_id=player_id+1", "rewards='{\"resources\":{\"wood\":799},\"items\":[{\"item_cfg_id\":2018,\"qty\":1}]}'", "status=1", "status=3"} {
		t.Run(mutation, func(t *testing.T) {
			actor := Actor{116, time.Now().UnixNano()}
			st := NewPGStore(pool)
			cfg, _ := cat.Get(1006)
			svc, writer := fresh(st)
			svc.SetTutorialFactsProvider(wallFacts)
			if _, _, err := svc.AcceptQuest(ctx, actor, 1006); err != nil {
				t.Fatal(err)
			}
			if _, err := writer.GrantQuestReward(ctx, wallGrantRequest(actor, cfg)); err != nil {
				t.Fatal(err)
			}
			if _, err := pool.Exec(ctx, `UPDATE reward_grant_queue SET `+mutation+` WHERE server_id=$1 AND idempotency_key=$2`, actor.ServerID, QuestClaimIdempotencyKey(actor.PlayerID, 1006)); err != nil {
				t.Fatal(err)
			}
			svc, g := fresh(st)
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				t.Fatal("mismatched receipt read facts")
				return TutorialFacts{}, nil
			})
			for _, run := range []func() error{func() error { return svc.RecoverWall(ctx, actor) }, func() error { _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); return err }} {
				if err := run(); !errors.Is(err, content.ErrGrantReceiptMismatch) {
					t.Fatalf("mismatch %v", err)
				}
			}
			if g.calls.Load() != 0 {
				t.Fatal("mismatch called Grant")
			}
			// A consumed legacy row still cannot mint new no-payout proof over
			// the same mismatched payment evidence (isolated corruption fixture).
			if _, err := pool.Exec(ctx, `UPDATE player_quest SET state=3,progress='{"count":99}',accepted_at=NULL WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=1006`, actor.ServerID, actor.PlayerID); err != nil {
				t.Fatal(err)
			}
			if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1006); !errors.Is(err, content.ErrGrantReceiptMismatch) || g.calls.Load() != 0 {
				t.Fatalf("completed mismatch %v calls=%d", err, g.calls.Load())
			}
			if floor, _ := svc.CompletedWallLevel(ctx, actor); floor != 1 {
				t.Fatal("mismatch raised floor")
			}
			assertWallAssets(t, pool, actor, 1)
		})
	}
}

func TestPGWallConcurrentClaimsAndServerIsolation(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	ctx := context.Background()
	id := time.Now().UnixNano()
	for _, server := range []int32{117, 118} {
		actor := Actor{server, id}
		st := NewPGStore(pool)
		svc, _ := fresh(st)
		svc.SetTutorialFactsProvider(wallFacts)
		if _, _, err := svc.AcceptQuest(ctx, actor, 1006); err != nil {
			t.Fatal(err)
		}
		stale, _, _ := st.GetPlayerQuest(ctx, server, id, 1006)
		stale.State = StateInProgress
		stale.Progress = ProgressCounter{}
		var wg sync.WaitGroup
		start := make(chan struct{})
		for i := 0; i < 12; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				s, _ := fresh(NewPGStore(pool))
				s.SetTutorialFactsProvider(wallFacts)
				<-start
				var err error
				switch i % 3 {
				case 0:
					_, _, _, err = s.ClaimQuestReward(ctx, actor, 1006)
				case 1:
					err = s.RecoverWall(ctx, actor)
				case 2:
					err = st.UpsertPlayerQuest(ctx, stale)
				}
				if err != nil && !errors.Is(err, ErrAlreadyCompleted) {
					t.Errorf("concurrent op %v", err)
				}
			}(i)
		}
		close(start)
		wg.Wait()
		row, _, err := st.GetPlayerQuest(ctx, server, id, 1006)
		if err != nil || row.State != StateCompleted || row.Progress.ServerVerifiedVersion != 2 || row.Progress.LegacyNoPayoutVerified || row.RewardClaimedAt == nil {
			t.Fatalf("completion %+v %v", row, err)
		}
		assertWallAssets(t, pool, actor, 1)
	}
}
