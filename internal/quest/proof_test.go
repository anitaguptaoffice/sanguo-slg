package quest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestProgressProofJSON(t *testing.T) {
	for _, raw := range []string{`{}`, `{"count":2}`, `{"server_verified_version":0}`, `{"count":1,"server_verified_version":1}`} {
		var p ProgressCounter
		if err := json.Unmarshal([]byte(raw), &p); err != nil {
			t.Fatalf("%s: %v", raw, err)
		}
	}
	for _, raw := range []string{`null`, `[]`, `{"count":"1"}`, `{"count":null}`, `{"server_verified_version":null}`, `{"server_verified_version":3}`, `{"server_verified_version":-1}`, `{"server_verified_version":"1"}`, `{"server_verified_version":1.5}`, `{"other":1}`} {
		var p ProgressCounter
		if err := json.Unmarshal([]byte(raw), &p); !errors.Is(err, ErrProgressInvalid) {
			t.Fatalf("accepted %s: %v", raw, err)
		}
	}
	if err := json.Unmarshal([]byte(`{"count":`), new(ProgressCounter)); err == nil {
		t.Fatal("malformed JSON accepted")
	}
	b, _ := json.Marshal(ProgressCounter{})
	if strings.Contains(string(b), "server_verified_version") {
		t.Fatal(string(b))
	}
	if !IsAuthoritativeTutorial(QuestCfg{ChainID: 100, QuestCfgID: 1001}) || IsAuthoritativeTutorial(QuestCfg{ChainID: 400, QuestCfgID: 1001}) || IsAuthoritativeTutorial(QuestCfg{ChainID: 100, QuestCfgID: 1006}) {
		t.Fatal("tutorial scope")
	}
}

func TestTutorialProofStores(t *testing.T) {
	t.Run("mem", func(t *testing.T) { testTutorialProofStore(t, NewMemStore()) })
	t.Run("pg", func(t *testing.T) {
		pool := openQuestTestDB(t)
		t.Cleanup(pool.Close)
		applyQuestSchema(t, pool)
		if _, err := pool.Exec(context.Background(), `DELETE FROM player_quest WHERE server_id=91`); err != nil {
			t.Fatal(err)
		}
		testTutorialProofStore(t, NewPGStore(pool))
	})
}

func testTutorialProofStore(t *testing.T, store Store) {
	t.Helper()
	ctx := context.Background()
	accepted := time.Date(2026, 10, 25, 23, 59, 0, 0, time.UTC)
	completed, claimed := accepted.Add(time.Second), accepted.Add(2*time.Second)
	put := func(row PlayerQuestRow) {
		t.Helper()
		if err := store.UpsertPlayerQuest(ctx, row); err != nil {
			t.Fatal(err)
		}
	}
	get := func(row PlayerQuestRow) PlayerQuestRow {
		t.Helper()
		got, ok, err := store.GetPlayerQuest(ctx, row.ServerID, row.PlayerID, row.QuestCfgID)
		if err != nil || !ok {
			t.Fatalf("read: %v %v", ok, err)
		}
		return got
	}
	for id := int32(1001); id <= 1005; id++ {
		base := PlayerQuestRow{ServerID: 91, PlayerID: int64(id), QuestCfgID: id, State: StateInProgress, AcceptedAt: &accepted, UpdatedAt: accepted}
		proof := base
		proof.State, proof.Progress, proof.CompletedAt, proof.UpdatedAt = StateClaimable, ProgressCounter{Count: 1, ServerVerifiedVersion: 1}, &completed, completed
		if err := store.UpsertPlayerQuest(ctx, proof); !errors.Is(err, ErrNotInProgress) {
			t.Fatalf("missing eligibility: %v", err)
		}
		if _, has, err := store.GetPlayerQuest(ctx, 91, int64(id), id); err != nil || has {
			t.Fatalf("failed proof inserted row: %v %v", has, err)
		}
		unaccepted := base
		unaccepted.State, unaccepted.AcceptedAt = StateUnaccepted, nil
		put(unaccepted)
		if err := store.UpsertPlayerQuest(ctx, proof); !errors.Is(err, ErrNotInProgress) {
			t.Fatalf("unaccepted eligibility: %v", err)
		}
		unaccepted.State = StateInProgress
		put(unaccepted)
		if err := store.UpsertPlayerQuest(ctx, proof); !errors.Is(err, ErrNotInProgress) {
			t.Fatalf("missing accepted timestamp: %v", err)
		}
		put(base)
		unaccepted.State = StateUnaccepted
		put(proof)
		put(base)
		got := get(base)
		if got.State != StateClaimable || got.Progress != proof.Progress || !got.CompletedAt.Equal(completed) {
			t.Fatalf("stale proof loss: %+v", got)
		}
		var wg sync.WaitGroup
		for n := 0; n < 12; n++ {
			wg.Add(1)
			go func(n int) {
				defer wg.Done()
				row := proof
				if n%2 == 0 {
					row.State = StateCompleted
					row.RewardClaimedAt = &claimed
					row.UpdatedAt = claimed
				} else {
					row = base
				}
				if err := store.UpsertPlayerQuest(ctx, row); err != nil {
					t.Error(err)
				}
			}(n)
		}
		wg.Wait()
		rewrite := get(base)
		later := claimed.Add(time.Hour)
		rewrite.AcceptedAt, rewrite.CompletedAt, rewrite.RewardClaimedAt = &later, &later, &later
		put(rewrite)
		put(unaccepted)
		got = get(base)
		if got.State != StateCompleted || got.Progress != proof.Progress || got.AcceptedAt == nil || !got.AcceptedAt.Equal(accepted) || got.CompletedAt == nil || !got.CompletedAt.Equal(completed) || got.RewardClaimedAt == nil || !got.RewardClaimedAt.Equal(claimed) || !got.UpdatedAt.Equal(claimed) {
			t.Fatalf("stale completion loss: %+v", got)
		}
		// Store snapshots cannot mutate persisted timestamp pointers.
		*got.CompletedAt = accepted
		if !get(base).CompletedAt.Equal(completed) {
			t.Fatal("aliased timestamp")
		}
	}
	legacy := PlayerQuestRow{ServerID: 91, PlayerID: 99, QuestCfgID: 1001, State: StateCompleted, CompletedAt: &completed, RewardClaimedAt: &claimed, UpdatedAt: claimed}
	put(legacy)
	stale := legacy
	stale.State = StateInProgress
	stale.CompletedAt = nil
	stale.RewardClaimedAt = nil
	put(stale)
	if got := get(legacy); got.State != StateCompleted || got.CompletedAt == nil || got.RewardClaimedAt == nil {
		t.Fatalf("legacy completion regressed: %+v", got)
	}
	for _, row := range []PlayerQuestRow{
		{QuestCfgID: 1001, State: StateClaimable, Progress: ProgressCounter{Count: 1, ServerVerifiedVersion: 2}, AcceptedAt: &accepted},
		{QuestCfgID: 1012, State: StateClaimable, Progress: ProgressCounter{Count: 1, ServerVerifiedVersion: 1}, AcceptedAt: &accepted},
		{QuestCfgID: 1001, State: StateInProgress, Progress: ProgressCounter{Count: 1, ServerVerifiedVersion: 1}, AcceptedAt: &accepted},
		{QuestCfgID: 1001, State: StateClaimable, Progress: ProgressCounter{Count: 2, ServerVerifiedVersion: 1}, AcceptedAt: &accepted},
		{QuestCfgID: 1001, State: StateClaimable, Progress: ProgressCounter{Count: 1, ServerVerifiedVersion: 1}},
	} {
		if err := store.UpsertPlayerQuest(ctx, row); !errors.Is(err, ErrProgressInvalid) {
			t.Fatalf("invalid proof accepted: %+v %v", row, err)
		}
	}
	// Exercise real service UTC rollover, not just the reset helper.
	svc := NewService(store, dailyCatalog(), &mockGranter{}, nil)
	actor := Actor{ServerID: 91, PlayerID: 77}
	svc.SetClock(func() time.Time { return accepted })
	if _, _, err := svc.AcceptQuest(ctx, actor, 1012); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.ReportQuestProgress(ctx, actor, 1012, true, 100); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1012); err != nil {
		t.Fatal(err)
	}
	nextDay := accepted.Add(time.Minute)
	svc.SetClock(func() time.Time { return nextDay })
	if _, _, err := svc.AcceptQuest(ctx, actor, 1012); err != nil {
		t.Fatal(err)
	}
	got := get(PlayerQuestRow{ServerID: 91, PlayerID: 77, QuestCfgID: 1012})
	if got.State != StateInProgress || got.Progress != (ProgressCounter{}) || got.CompletedAt != nil || got.RewardClaimedAt != nil || !got.AcceptedAt.Equal(nextDay) {
		t.Fatalf("daily not reset: %+v", got)
	}
	// The existing report method cannot manufacture v1 proof.
	svc = NewService(store, tutorialCatalog(), nil, nil)
	actor.PlayerID = 88
	if _, _, err := svc.AcceptQuest(ctx, actor, 1001); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.ReportQuestProgress(ctx, actor, 1001, true, 2); err != nil {
		t.Fatal(err)
	}
	if got := get(PlayerQuestRow{ServerID: 91, PlayerID: 88, QuestCfgID: 1001}); got.Progress.ServerVerifiedVersion != 0 {
		t.Fatal("report produced proof")
	}
}

func TestPGRejectInvalidStoredProof(t *testing.T) {
	pool := openQuestTestDB(t)
	t.Cleanup(pool.Close)
	applyQuestSchema(t, pool)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `DELETE FROM player_quest WHERE server_id=92`); err != nil {
		t.Fatal(err)
	}
	store := NewPGStore(pool)
	for n, raw := range []string{`{"count":1,"server_verified_version":2}`, `{"count":1,"server_verified_version":null}`, `{"count":"bad"}`, `null`, `{"count":1,"server_verified_version":1}`} {
		t.Run(fmt.Sprint(n), func(t *testing.T) {
			_, err := pool.Exec(ctx, `INSERT INTO player_quest (server_id,player_id,quest_cfg_id,state,progress) VALUES (92,$1,1001,1,$2)`, int64(n), raw)
			if err != nil {
				t.Fatal(err)
			}
			if _, _, err = store.GetPlayerQuest(ctx, 92, int64(n), 1001); !errors.Is(err, ErrProgressInvalid) {
				t.Fatalf("get: %v", err)
			}
			if _, err = store.ListPlayerQuests(ctx, 92, int64(n)); !errors.Is(err, ErrProgressInvalid) {
				t.Fatalf("list: %v", err)
			}
			if err = store.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: 92, PlayerID: int64(n), QuestCfgID: 1001, State: StateCompleted, UpdatedAt: time.Now()}); !errors.Is(err, ErrProgressInvalid) {
				t.Fatalf("write: %v", err)
			}
		})
	}
}
