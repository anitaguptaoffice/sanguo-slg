package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

func wallTestConfig() QuestCfg {
	return QuestCfg{QuestCfgID: 1006, Code: "chain200_wall", QuestType: 1, ChainID: 200, SortInChain: 1, UnlockLevel: 5,
		Objectives: []Objective{{Type: "build_level", BuildingCfgID: 7, Level: 1}},
		Rewards:    RewardBundle{Resources: map[string]int64{"wood": 800}, Items: []RewardItem{{ItemCfgID: 2018, Quantity: 1}}}}
}

func TestWallExactIdentity(t *testing.T) {
	for _, mutate := range []func(*QuestCfg){
		func(q *QuestCfg) { q.QuestCfgID = 1007 }, func(q *QuestCfg) { q.Code = "wall" }, func(q *QuestCfg) { q.QuestType = 2 },
		func(q *QuestCfg) { q.ChainID = 100 }, func(q *QuestCfg) { q.SortInChain = 2 }, func(q *QuestCfg) { q.PrevQuestCfgID = 1005 },
		func(q *QuestCfg) { q.UnlockLevel = 4 }, func(q *QuestCfg) { q.Repeatable = true }, func(q *QuestCfg) { q.Objectives = nil },
		func(q *QuestCfg) { q.Objectives = append(q.Objectives, q.Objectives[0]) }, func(q *QuestCfg) { q.Objectives[0].Count = 1 },
		func(q *QuestCfg) { q.Objectives[0].BuildingCfgID = 6 }, func(q *QuestCfg) { q.Objectives[0].Level = 2 },
		func(q *QuestCfg) { q.Objectives[0].Type = "build" }, func(q *QuestCfg) { q.Objectives[0].Resource = "wood" },
		func(q *QuestCfg) { q.Objectives[0].UnitCode = "unit" }, func(q *QuestCfg) { q.Objectives[0].ItemCode = "item" },
		func(q *QuestCfg) { q.Rewards.Resources["wood"] = 799 }, func(q *QuestCfg) { q.Rewards.Resources["food"] = 1 },
		func(q *QuestCfg) { q.Rewards.Items[0].ItemCfgID = 2017 }, func(q *QuestCfg) { q.Rewards.Items[0].Quantity = 2 },
		func(q *QuestCfg) { q.Rewards.Items = append(q.Rewards.Items, q.Rewards.Items[0]) },
	} {
		q := wallTestConfig()
		mutate(&q)
		if !errors.Is(wallConfig(q), ErrProgressInvalid) {
			t.Fatalf("accepted %+v", q)
		}
	}
	cfg := wallTestConfig()
	cfg.Rewards.RewardPackID = "display-only"
	if err := wallConfig(cfg); err != nil {
		t.Fatal(err)
	}
}

func TestCompletedWallFloorPure(t *testing.T) {
	ctx, actor, now := context.Background(), Actor{1, 10}, time.Now()
	for _, mode := range []string{"missing", "legacy_accepted", "legacy_null", "claimable", "completed", "no_payout"} {
		t.Run(mode, func(t *testing.T) {
			st := NewMemStore()
			svc := NewService(st, NewMemCatalog([]QuestCfg{wallTestConfig()}), nil, func(context.Context, int32, int64) (int32, error) {
				t.Fatal("floor called level provider")
				return 0, nil
			})
			svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
				t.Fatal("floor called facts provider")
				return TutorialFacts{}, nil
			})
			r := PlayerQuestRow{ServerID: 1, PlayerID: 10, QuestCfgID: 1006, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}
			if mode != "missing" {
				if mode == "legacy_null" || mode == "no_payout" {
					r.AcceptedAt = nil
				}
				if mode == "legacy_null" || mode == "legacy_accepted" || mode == "no_payout" {
					r.State = StateCompleted
				}
				if err := st.UpsertPlayerQuest(ctx, r); err != nil {
					t.Fatal(err)
				}
				if mode == "claimable" || mode == "completed" {
					r.State, r.Progress = StateClaimable, ProgressCounter{Count: 1, ServerVerifiedVersion: 2}
					if err := st.UpsertPlayerQuest(ctx, r); err != nil {
						t.Fatal(err)
					}
					if mode == "completed" {
						r.State = StateCompleted
						if err := st.UpsertPlayerQuest(ctx, r); err != nil {
							t.Fatal(err)
						}
					}
				}
				if mode == "no_payout" {
					if err := st.verifyLegacyWall(ctx, actor, now); err != nil {
						t.Fatal(err)
					}
				}
			}
			want := int32(1)
			if mode == "completed" || mode == "no_payout" {
				want = 6
			}
			if got, err := svc.CompletedWallLevel(ctx, actor); err != nil || got != want {
				t.Fatalf("floor=%d want=%d err=%v", got, want, err)
			}
		})
	}
	svc := NewService(NewMemStore(), NewMemCatalog(nil), nil, nil)
	if floor, err := svc.CompletedWallLevel(ctx, actor); err != nil || floor != 1 {
		t.Fatalf("partial catalog %d %v", floor, err)
	}
	bad := wallTestConfig()
	bad.UnlockLevel = 1
	svc.catalog = NewMemCatalog([]QuestCfg{bad})
	if _, err := svc.CompletedWallLevel(ctx, actor); !errors.Is(err, ErrProgressInvalid) {
		t.Fatalf("bad config %v", err)
	}
}

func TestWallRawObjectiveIdentity(t *testing.T) {
	for _, raw := range []string{
		`[{"type":"build_level","building_cfg_id":7,"level":1,"unknown":0}]`,
		`[{"type":"build_level","building_cfg_id":7,"level":1}] []`,
		`[{"type":"build_level","building_cfg_id":7,"level":1}] trailing`,
	} {
		if _, err := parseWallObjectivesJSON([]byte(raw)); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
	objectives, err := parseWallObjectivesJSON([]byte(`[{"type":"build_level","building_cfg_id":7,"level":1,"count":0,"resource":"","unit_code":"","item_code":""}]`))
	if err != nil {
		t.Fatal(err)
	}
	cfg := wallTestConfig()
	cfg.Objectives = objectives
	if err := wallConfig(cfg); err != nil {
		t.Fatal(err)
	}
}
