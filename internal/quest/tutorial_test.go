package quest

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"testing"
	"time"
)

// Consume the unchanged canonical DATA-002 artifact, not the partial dev data.
func authoritativeCatalog(t *testing.T) *MemCatalog {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	raw, err := os.ReadFile(filepath.Join(filepath.Dir(file), "../../spec/data/generated/cfg_quest.sql"))
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`VALUES \((100[1-5]), '[^']+', (\d+), '[^']*', (\d+), (NULL|\d+), (\d+), '([^']*)', (\d+), (false|true)\)`)
	num := func(s string) int32 { n, _ := strconv.Atoi(s); return int32(n) }
	var cfgs []QuestCfg
	for _, m := range re.FindAllStringSubmatch(string(raw), -1) {
		objs, err := ParseObjectivesJSON([]byte(m[6]))
		if err != nil {
			t.Fatal(err)
		}
		cfgs = append(cfgs, QuestCfg{QuestCfgID: num(m[1]), QuestType: int16(num(m[2])), ChainID: num(m[3]), PrevQuestCfgID: num(m[4]), SortInChain: int16(num(m[5])), Objectives: objs, UnlockLevel: num(m[7]), Repeatable: m[8] == "true"})
	}
	if len(cfgs) != 5 {
		t.Fatalf("canonical tutorial configs: %d", len(cfgs))
	}
	return NewMemCatalog(cfgs)
}

func TestTutorialReconciliationStores(t *testing.T) {
	t.Run("mem", func(t *testing.T) { testTutorialReconciliation(t, NewMemStore()) })
	t.Run("pg", func(t *testing.T) {
		pool := openQuestTestDB(t)
		t.Cleanup(pool.Close)
		applyQuestSchema(t, pool)
		if _, err := pool.Exec(context.Background(), `DELETE FROM player_quest WHERE server_id=93`); err != nil {
			t.Fatal(err)
		}
		testTutorialReconciliation(t, NewPGStore(pool))
	})
}

func testTutorialReconciliation(t *testing.T, store Store) {
	ctx, now := context.Background(), time.Now().UTC()
	cat, grant := authoritativeCatalog(t), &mockGranter{}
	level, facts, providerErr, calls := int32(5), TutorialFacts{}, error(nil), 0
	actor := Actor{ServerID: 93, PlayerID: 1}
	svc := NewService(store, cat, grant, func(context.Context, int32, int64) (int32, error) { return level, nil })
	svc.SetTutorialFactsProvider(func(_ context.Context, got Actor) (TutorialFacts, error) {
		if got != actor {
			t.Fatalf("provider actor: %+v", got)
		}
		calls++
		return facts, providerErr
	})
	put := func(row PlayerQuestRow) {
		t.Helper()
		if err := store.UpsertPlayerQuest(ctx, row); err != nil {
			t.Fatal(err)
		}
	}
	get := func(id int32) PlayerQuestRow {
		t.Helper()
		row, _, err := store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, id)
		if err != nil {
			t.Fatal(err)
		}
		return row
	}
	allFacts := TutorialFacts{CompletedBuildingLevels: map[int32]int32{1: 2, 2: 3, 3: 2, 6: 2}, HasOwnedHero: true}
	for id := int32(1001); id <= 1005; id++ {
		actor.PlayerID, facts = int64(id), TutorialFacts{CompletedBuildingLevels: map[int32]int32{999: 99}, HasOwnedHero: id != 1002}
		if err := svc.ReconcileTutorial(ctx, actor); err != nil {
			t.Fatal(err)
		}
		if _, has, _ := store.GetPlayerQuest(ctx, 93, actor.PlayerID, id); has {
			t.Fatal("autoaccepted missing quest")
		}
		put(PlayerQuestRow{ServerID: 93, PlayerID: actor.PlayerID, QuestCfgID: id, State: StateUnaccepted, UpdatedAt: now})
		before := calls
		if err := svc.ReconcileTutorial(ctx, actor); err != nil || calls != before {
			t.Fatalf("unaccepted: %v calls %d/%d", err, calls, before)
		}
		if id > 1001 {
			put(PlayerQuestRow{ServerID: 93, PlayerID: actor.PlayerID, QuestCfgID: id - 1, State: StateCompleted, UpdatedAt: now})
		}
		v, _, err := svc.AcceptQuest(ctx, actor, id)
		if err != nil || v.State != PlayerQuestStateInProgress {
			t.Fatalf("unmet accept %d: %+v %v", id, v, err)
		}
		old := get(id)
		old.State, old.Progress.Count = StateClaimable, 999 // Legacy reports are not proof.
		put(old)
		if err := svc.ReconcileTutorial(ctx, actor); err != nil || get(id).Progress.ServerVerifiedVersion != 0 {
			t.Fatalf("legacy count became proof: %v", err)
		}
		providerErr = errors.New("facts unavailable")
		if _, _, err := svc.GetQuestChainStatus(ctx, actor, 100); !errors.Is(err, providerErr) || get(id).Progress.ServerVerifiedVersion != 0 {
			t.Fatalf("provider failure: %v", err)
		}
		providerErr, facts = nil, allFacts
		if _, _, err := svc.ListPlayerQuests(ctx, actor, ListQuestsFilter{}); err != nil {
			t.Fatal(err)
		}
		if row := get(id); row.Progress != (ProgressCounter{Count: 1, ServerVerifiedVersion: 1}) || row.State != StateClaimable {
			t.Fatalf("fixed target %d: %+v", id, row)
		}
		facts, providerErr = TutorialFacts{}, errors.New("must not revalidate durable proof")
		put(old) // Late unverified writer cannot erase proof.
		if err := svc.ReconcileTutorial(ctx, actor); err != nil || get(id).Progress.ServerVerifiedVersion != 1 {
			t.Fatalf("proof regressed: %v", err)
		}
		providerErr = nil
	}
	actor.PlayerID, facts = 2000, allFacts // Action happened before accept.
	v, _, err := svc.AcceptQuest(ctx, actor, 1001)
	if err != nil || v.State != PlayerQuestStateClaimable || get(1001).Progress.ServerVerifiedVersion != 1 {
		t.Fatalf("pre-accept facts: %+v %v", v, err)
	}
	if grant.calls != 0 {
		t.Fatal("reconciliation granted reward")
	}
	// Deterministically interleave an independent completed write during facts IO.
	for _, met := range []bool{false, true} {
		actor.PlayerID++
		base := PlayerQuestRow{ServerID: 93, PlayerID: actor.PlayerID, QuestCfgID: 1001, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}
		put(base)
		started, resume, result := make(chan struct{}), make(chan struct{}), make(chan PlayerQuestProgress)
		svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
			close(started)
			<-resume
			if met {
				return allFacts, nil
			}
			return TutorialFacts{}, nil
		})
		go func() {
			_, views, err := svc.GetQuestChainStatus(ctx, actor, 100)
			if err != nil {
				t.Error(err)
			}
			for _, view := range views {
				if view.QuestCfgID == 1001 {
					result <- view
					return
				}
			}
			result <- PlayerQuestProgress{}
		}()
		<-started
		base.State, base.Progress, base.RewardClaimedAt = StateCompleted, ProgressCounter{Count: 1, ServerVerifiedVersion: 1}, &now
		put(base)
		close(resume)
		if view := <-result; view.State != PlayerQuestStateCompleted || view.ProgressCurrent != 1 || get(1001).RewardClaimedAt == nil {
			t.Fatalf("stale response: %+v", view)
		}
	}
}

func TestTutorialReconciliationGates(t *testing.T) {
	ctx, now := context.Background(), time.Now()
	for _, gate := range []string{"prerequisite", "unlock", "accepted", "config", "chain", "objective", "repeatable", "sort", "prev", "type"} {
		t.Run(gate, func(t *testing.T) {
			store, cat := NewMemStore(), authoritativeCatalog(t)
			id, level, want := int32(1002), int32(5), ErrProgressInvalid
			cfg := cat.byID[id]
			switch gate {
			case "prerequisite":
				want = ErrPrerequisiteNotMet
			case "unlock":
				level, want = 0, ErrLevelTooLow
			case "accepted":
				want = ErrNotInProgress
			case "config":
				cfg.UnlockLevel++
			case "chain":
				cfg.ChainID = 999
			case "objective":
				cfg.Objectives = []Objective{{Type: "recruit_hero", Count: 2}}
			case "repeatable":
				cfg.Repeatable = true
			case "sort":
				cfg.SortInChain++
			case "prev":
				cfg.PrevQuestCfgID = 0
			case "type":
				cfg.QuestType = 0
			}
			cat.byID[id] = cfg
			row := PlayerQuestRow{ServerID: 1, PlayerID: 1, QuestCfgID: id, State: StateClaimable, AcceptedAt: &now}
			if gate == "accepted" {
				row.AcceptedAt = nil
			}
			if err := store.UpsertPlayerQuest(ctx, row); err != nil {
				t.Fatal(err)
			}
			if gate != "prerequisite" {
				if err := store.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: 1, PlayerID: 1, QuestCfgID: 1001, State: StateCompleted}); err != nil {
					t.Fatal(err)
				}
			}
			svc := NewService(store, cat, nil, func(context.Context, int32, int64) (int32, error) { return level, nil })
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				t.Fatal("gate reached facts")
				return TutorialFacts{}, nil
			})
			if err := svc.ReconcileTutorial(ctx, Actor{1, 1}); !errors.Is(err, want) {
				t.Fatalf("got %v want %v", err, want)
			}
			got, _, _ := store.GetPlayerQuest(ctx, 1, 1, id)
			if got.Progress.ServerVerifiedVersion != 0 {
				t.Fatal("gate wrote proof")
			}
		})
	}
}

func TestTutorialProviderDoesNotAffectDaily(t *testing.T) {
	ctx, now := context.Background(), time.Now().UTC()
	svc := NewService(NewMemStore(), dailyCatalog(), nil, nil)
	svc.SetClock(func() time.Time { return now })
	svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
		t.Fatal("daily called tutorial provider")
		return TutorialFacts{}, nil
	})
	actor := Actor{1, 7}
	if _, _, err := svc.AcceptQuest(ctx, actor, 1015); err != nil {
		t.Fatal(err)
	}
	if err := svc.ApplyProgressEvent(ctx, actor, ProgressEvent{Kind: EventRecruitHero}); err != nil {
		t.Fatal(err)
	}
	_, views, err := svc.GetQuestChainStatus(ctx, actor, DailyChainID)
	if err != nil {
		t.Fatal(err)
	}
	for _, view := range views {
		if view.QuestCfgID == 1015 && view.State != PlayerQuestStateClaimable {
			t.Fatal(view)
		}
	}
	now = now.Add(24 * time.Hour)
	if _, _, err := svc.AcceptQuest(ctx, actor, 1015); err != nil {
		t.Fatal(err)
	}
}
