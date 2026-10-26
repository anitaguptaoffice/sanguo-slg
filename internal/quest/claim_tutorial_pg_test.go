package quest

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5/pgxpool"
)

type observedContentGranter struct {
	*ContentGranter
	calls atomic.Int32
}

func (g *observedContentGranter) GrantQuestReward(ctx context.Context, req GrantRequest) (RewardBundle, error) {
	g.calls.Add(1)
	return g.ContentGranter.GrantQuestReward(ctx, req)
}

type failClaimSave struct{ Store }

var errClaimSave = errors.New("injected failure after grant before quest save")

func (s failClaimSave) UpsertPlayerQuest(ctx context.Context, row PlayerQuestRow) error {
	if row.State == StateCompleted {
		return errClaimSave
	}
	return s.Store.UpsertPlayerQuest(ctx, row)
}

func claimPGFixture(t *testing.T) (*pgxpool.Pool, *MemCatalog, func(Store) (*Service, *observedContentGranter)) {
	t.Helper()
	pool := openQuestTestDB(t)
	t.Cleanup(pool.Close)
	applyQuestSchema(t, pool)
	specDir, err := questTestSpecDir(".")
	if err != nil {
		t.Fatal(err)
	}
	seed, err := os.ReadFile(filepath.Join(filepath.Dir(specDir), "data", "generated", "cfg_quest.sql"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(context.Background(), string(seed)); err != nil {
		t.Fatal(err)
	}
	cat, err := MemCatalogFromPG(context.Background(), pool)
	if err != nil {
		t.Fatal(err)
	}
	items, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	return pool, cat, func(store Store) (*Service, *observedContentGranter) {
		c := content.NewService(items)
		c.UseStore(content.NewPGStore(pool))
		g := &observedContentGranter{ContentGranter: NewContentGranter(c)}
		s := NewService(store, cat, g, func(context.Context, int32, int64) (int32, error) { return 5, nil })
		return s, g
	}
}

func acceptedClaimRow(t *testing.T, store Store, actor Actor, id int32) PlayerQuestRow {
	t.Helper()
	now := time.Now()
	row := PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: id,
		State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}
	if err := store.UpsertPlayerQuest(context.Background(), row); err != nil {
		t.Fatal(err)
	}
	if id > 1001 {
		if err := store.UpsertPlayerQuest(context.Background(), PlayerQuestRow{ServerID: actor.ServerID,
			PlayerID: actor.PlayerID, QuestCfgID: id - 1, State: StateCompleted, UpdatedAt: now}); err != nil {
			t.Fatal(err)
		}
	}
	return row
}

func assertClaimAssets(t *testing.T, pool *pgxpool.Pool, actor Actor, item int32, qty, grants int, food int64) {
	t.Helper()
	var gotQty, gotGrants int
	var gotFood int64
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `SELECT COALESCE(SUM(quantity),0) FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=$3`, actor.ServerID, actor.PlayerID, item).Scan(&gotQty); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$2`, actor.ServerID, QuestClaimIdempotencyKey(actor.PlayerID, 1001)).Scan(&gotGrants); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=$1 AND player_id=$2`, actor.ServerID, actor.PlayerID).Scan(&gotFood); err != nil {
		t.Fatal(err)
	}
	if gotQty != qty || gotGrants != grants || gotFood != food {
		t.Fatalf("assets qty=%d grants=%d food=%d; want %d/%d/%d", gotQty, gotGrants, gotFood, qty, grants, food)
	}
}

func TestPGTutorialClaimGrantThenSaveFailure(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	ctx, actor := context.Background(), Actor{94, time.Now().UnixNano()}
	store := NewPGStore(pool)
	acceptedClaimRow(t, store, actor, 1001)
	svc, g := fresh(failClaimSave{store})
	svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
		return TutorialFacts{CompletedBuildingLevels: map[int32]int32{1: 2}}, nil
	})
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1001); !errors.Is(err, errClaimSave) || g.calls.Load() != 1 {
		t.Fatalf("fault window: %v calls=%d", err, g.calls.Load())
	}
	assertClaimAssets(t, pool, actor, 2001, 1, 1, 500)
	row, _, err := store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1001)
	if err != nil || row.State != StateClaimable || row.Progress.ServerVerifiedVersion != 1 {
		t.Fatalf("pre-save durable proof: %+v %v", row, err)
	}
	// Legacy/fault fixture: successful payment but proof and acceptance absent.
	if _, err := pool.Exec(ctx, `UPDATE player_quest SET progress='{"count":99}',accepted_at=NULL WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=1001`, actor.ServerID, actor.PlayerID); err != nil {
		t.Fatal(err)
	}
	svc, g = fresh(store) // Simulate restart; no content/quest cache survives.
	svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
		t.Fatal("receipt repair consulted disappeared building")
		return TutorialFacts{}, nil
	})
	view, _, rewards, err := svc.ClaimQuestReward(ctx, actor, 1001)
	if err != nil || view.State != PlayerQuestStateCompleted || rewards.Resources["food"] != 500 || g.calls.Load() != 0 {
		t.Fatalf("recovery: %+v rewards=%+v error=%v grants=%d", view, rewards, err, g.calls.Load())
	}
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1001); !errors.Is(err, ErrAlreadyCompleted) || g.calls.Load() != 0 {
		t.Fatalf("duplicate completed: %v grants=%d", err, g.calls.Load())
	}
	assertClaimAssets(t, pool, actor, 2001, 1, 1, 500)
}

func TestPGTutorialClaimWrongReceiptFailsClosed(t *testing.T) {
	pool, cat, fresh := claimPGFixture(t)
	ctx := context.Background()
	for _, mutation := range []string{"player_id=player_id+1", "rewards='{\"resources\":{\"food\":999},\"items\":[]}'", "status=1", "status=3"} {
		actor := Actor{95, time.Now().UnixNano()}
		store := NewPGStore(pool)
		row := acceptedClaimRow(t, store, actor, 1001)
		row.State, row.Progress = StateClaimable, ProgressCounter{Count: 1, ServerVerifiedVersion: 1}
		if err := store.UpsertPlayerQuest(ctx, row); err != nil {
			t.Fatal(err)
		}
		_, writer := fresh(store)
		cfg, _ := cat.Get(1001)
		req := GrantRequest{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1001,
			IdempotencyKey: QuestClaimIdempotencyKey(actor.PlayerID, 1001), Rewards: cfg.Rewards}
		if _, err := writer.GrantQuestReward(ctx, req); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `UPDATE reward_grant_queue SET `+mutation+` WHERE server_id=$1 AND idempotency_key=$2`, actor.ServerID, req.IdempotencyKey); err != nil {
			t.Fatal(err)
		}
		svc, reader := fresh(store)
		if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1001); !errors.Is(err, content.ErrGrantReceiptMismatch) || reader.calls.Load() != 0 {
			t.Fatalf("mismatch %s: %v calls=%d", mutation, err, reader.calls.Load())
		}
		got, _, err := store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1001)
		if err != nil || got.State != StateClaimable {
			t.Fatalf("mismatch changed quest: %+v %v", got, err)
		}
		assertClaimAssets(t, pool, actor, 2001, 1, 1, 500)
	}
}

func TestPGTutorialConcurrentClaimsAndLateWrites(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	ctx, actor := context.Background(), Actor{96, time.Now().UnixNano()}
	store := NewPGStore(pool)
	old := acceptedClaimRow(t, store, actor, 1001)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			svc, _ := fresh(NewPGStore(pool))
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				return TutorialFacts{CompletedBuildingLevels: map[int32]int32{1: 2}}, nil
			})
			<-start
			var err error
			switch i % 3 {
			case 0:
				_, _, _, err = svc.ClaimQuestReward(ctx, actor, 1001)
			case 1:
				err = svc.ReconcileTutorial(ctx, actor)
			case 2:
				err = store.UpsertPlayerQuest(ctx, old)
			}
			if err != nil && !errors.Is(err, ErrAlreadyCompleted) {
				t.Errorf("concurrent operation: %v", err)
			}
		}(i)
	}
	close(start)
	wg.Wait()
	row, has, err := store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1001)
	if err != nil || !has || row.State != StateCompleted || row.Progress != (ProgressCounter{Count: 1, ServerVerifiedVersion: 1}) || row.RewardClaimedAt == nil {
		t.Fatalf("final concurrent state: %+v has=%v err=%v", row, has, err)
	}
	assertClaimAssets(t, pool, actor, 2001, 1, 1, 500)
}

func TestPGTutorialAbsentReceiptRequiresEntitlement(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	ctx := context.Background()
	for _, mode := range []string{"missing", "unaccepted", "unverified", "prerequisite", "unlock", "durable_proof"} {
		t.Run(mode, func(t *testing.T) {
			actor := Actor{97, time.Now().UnixNano()}
			store := NewPGStore(pool)
			now := time.Now()
			row := PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1002,
				State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}
			if mode == "unaccepted" {
				row.State, row.AcceptedAt = StateUnaccepted, nil
			}
			if mode != "missing" {
				if err := store.UpsertPlayerQuest(ctx, row); err != nil {
					t.Fatal(err)
				}
				if mode != "unaccepted" {
					row.State, row.Progress.Count = StateClaimable, 99
					if mode == "durable_proof" || mode == "prerequisite" || mode == "unlock" {
						row.Progress = ProgressCounter{Count: 1, ServerVerifiedVersion: 1}
					}
					if err := store.UpsertPlayerQuest(ctx, row); err != nil {
						t.Fatal(err)
					}
				}
			}
			if mode != "prerequisite" {
				if err := store.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1001, State: StateCompleted, UpdatedAt: now}); err != nil {
					t.Fatal(err)
				}
			}
			svc, g := fresh(store)
			if mode == "durable_proof" {
				svc.store = failClaimSave{store}
			}
			if mode == "unlock" {
				svc.level = func(context.Context, int32, int64) (int32, error) { return 0, nil }
			}
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				if mode != "unverified" {
					t.Fatal("proof/gates consulted disappeared hero")
				}
				return TutorialFacts{}, nil
			})
			_, _, _, err := svc.ClaimQuestReward(ctx, actor, 1002)
			if mode == "durable_proof" {
				if !errors.Is(err, errClaimSave) || g.calls.Load() != 1 {
					t.Fatalf("durable proof: %v calls=%d", err, g.calls.Load())
				}
				facts := svc.tutorialFacts
				svc, g = fresh(store)
				svc.SetTutorialFactsProvider(facts)
				view, _, rewards, err := svc.ClaimQuestReward(ctx, actor, 1002)
				if err != nil || view.State != PlayerQuestStateCompleted || len(rewards.Resources) != 0 || g.calls.Load() != 0 {
					t.Fatalf("item-only receipt canonicalization: %+v %v calls=%d", rewards, err, g.calls.Load())
				}
				var qty int
				if err := pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=2004`, actor.ServerID, actor.PlayerID).Scan(&qty); err != nil || qty != 1 {
					t.Fatalf("original item-only package: %d %v", qty, err)
				}
				return
			}
			want := ErrNotClaimable
			if mode == "prerequisite" {
				want = ErrPrerequisiteNotMet
			} else if mode == "unlock" {
				want = ErrLevelTooLow
			}
			if !errors.Is(err, want) || g.calls.Load() != 0 {
				t.Fatalf("gate: %v want=%v calls=%d", err, want, g.calls.Load())
			}
			var receipts, assets int
			if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2), (SELECT count(*) FROM player_item WHERE server_id=$1 AND player_id=$2)`, actor.ServerID, actor.PlayerID).Scan(&receipts, &assets); err != nil || receipts != 0 || assets != 0 {
				t.Fatalf("gate created receipt/assets: %d/%d %v", receipts, assets, err)
			}
		})
	}
}

func TestPGTrustedDailyClaimAndResetUnchanged(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	store := NewPGStore(pool)
	svc, g := fresh(store)
	svc.catalog = dailyCatalog()
	ctx, actor, now := context.Background(), Actor{98, time.Now().UnixNano()}, time.Now().UTC()
	svc.SetClock(func() time.Time { return now })
	svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
		t.Fatal("daily consulted tutorial facts")
		return TutorialFacts{}, nil
	})
	if _, _, err := svc.AcceptQuest(ctx, actor, 1015); err != nil {
		t.Fatal(err)
	}
	if err := svc.ApplyProgressEvent(ctx, actor, ProgressEvent{Kind: EventRecruitHero}); err != nil {
		t.Fatal(err)
	}
	if view, _, _, err := svc.ClaimQuestReward(ctx, actor, 1015); err != nil || view.State != PlayerQuestStateCompleted || g.calls.Load() != 1 {
		t.Fatalf("trusted daily claim: %+v %v grants=%d", view, err, g.calls.Load())
	}
	now = now.Add(24 * time.Hour)
	if view, _, err := svc.AcceptQuest(ctx, actor, 1015); err != nil || view.State != PlayerQuestStateInProgress {
		t.Fatalf("daily reset: %+v %v", view, err)
	}
	row, _, err := store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1015)
	if err != nil || row.Progress != (ProgressCounter{}) || row.RewardClaimedAt != nil {
		t.Fatalf("daily proof/claim reset: %+v %v", row, err)
	}
}

type pauseReceipt struct {
	*observedContentGranter
	pause func()
}

func (g pauseReceipt) FindQuestRewardReceipt(ctx context.Context, req GrantRequest) (GrantReceipt, bool, error) {
	r, paid, err := g.ContentGranter.FindQuestRewardReceipt(ctx, req)
	if err == nil && !paid {
		g.pause()
	}
	return r, paid, err
}

func TestPGTutorialClaimRereadsConcurrentCompletion(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	ctx := context.Background()
	for _, pauseAt := range []string{"receipt_absent", "facts_met", "facts_unmet"} {
		t.Run(pauseAt, func(t *testing.T) {
			actor, store := Actor{99, time.Now().UnixNano()}, NewPGStore(pool)
			acceptedClaimRow(t, store, actor, 1001)
			started, resume := make(chan struct{}), make(chan struct{})
			pause := func() { close(started); <-resume }
			svc, g := fresh(store)
			met := TutorialFacts{CompletedBuildingLevels: map[int32]int32{1: 2}}
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				if pauseAt == "receipt_absent" {
					t.Error("completed reread reached facts")
					return TutorialFacts{}, nil
				}
				pause()
				if pauseAt == "facts_unmet" {
					return TutorialFacts{}, nil
				}
				return met, nil
			})
			if pauseAt == "receipt_absent" {
				svc.granter = pauseReceipt{g, pause}
			}
			result := make(chan error, 1)
			go func() { _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1001); result <- err }()
			<-started
			other, winner := fresh(NewPGStore(pool))
			other.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) { return met, nil })
			_, _, _, winnerErr := other.ClaimQuestReward(ctx, actor, 1001)
			close(resume)
			if err := <-result; !errors.Is(err, ErrAlreadyCompleted) || g.calls.Load() != 0 || winnerErr != nil || winner.calls.Load() != 1 {
				t.Fatalf("loser=%v grants=%d winner=%v grants=%d", err, g.calls.Load(), winnerErr, winner.calls.Load())
			}
			assertClaimAssets(t, pool, actor, 2001, 1, 1, 500)
		})
	}
}

func TestPGTutorialReceiptReadErrorDoesNotProbeGrant(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	ctx, actor := context.Background(), Actor{100, time.Now().UnixNano()}
	store := NewPGStore(pool)
	acceptedClaimRow(t, store, actor, 1001)
	svc, g := fresh(store)
	closed, err := pgxpool.New(ctx, pool.Config().ConnString())
	if err != nil {
		t.Fatal(err)
	}
	closed.Close()
	g.content.UseStore(content.NewPGStore(closed))
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1001); err == nil || g.calls.Load() != 0 {
		t.Fatalf("receipt DB failure: %v grant calls=%d", err, g.calls.Load())
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2`, actor.ServerID, actor.PlayerID).Scan(&n); err != nil || n != 0 {
		t.Fatalf("lookup error created payment: %d %v", n, err)
	}
}
