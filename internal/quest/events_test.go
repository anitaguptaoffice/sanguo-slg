package quest

import (
	"context"
	"testing"
	"time"
)

func quest003DailyCatalog() *MemCatalog {
	return NewMemCatalog([]QuestCfg{
		{
			QuestCfgID:  1012,
			Code:        "daily_food_1",
			QuestType:   QuestTypeDaily,
			ChainID:     DailyChainID,
			Repeatable:  true,
			UnlockLevel: 1,
			Objectives:  []Objective{{Type: "collect_resource", Resource: "food", Count: 100}},
		},
		{
			QuestCfgID:  1014,
			Code:        "daily_train_1",
			QuestType:   QuestTypeDaily,
			ChainID:     DailyChainID,
			Repeatable:  true,
			UnlockLevel: 1,
			Objectives:  []Objective{{Type: "train_troops", UnitCode: "any", Count: 50}},
		},
		{
			QuestCfgID:  1015,
			Code:        "daily_recruit_1",
			QuestType:   QuestTypeDaily,
			ChainID:     DailyChainID,
			Repeatable:  true,
			UnlockLevel: 1,
			Objectives:  []Objective{{Type: "recruit_hero", Count: 1}},
		},
		{
			QuestCfgID:  1032,
			Code:        "daily_build_1",
			QuestType:   QuestTypeDaily,
			ChainID:     DailyChainID,
			Repeatable:  true,
			UnlockLevel: 1,
			Objectives:  []Objective{{Type: "build_level", BuildingCfgID: 2, Level: 2}},
		},
		{
			QuestCfgID:  1033,
			Code:        "daily_march_1",
			QuestType:   QuestTypeDaily,
			ChainID:     DailyChainID,
			Repeatable:  true,
			UnlockLevel: 1,
			Objectives:  []Objective{{Type: "use_item", ItemCode: "march_ration", Count: 1}},
		},
	})
}

// MIL Recruit applies troops on queue complete (CompleteRecruit). Quest hooks on
// RecruitTroop RPC success count enqueued soldiers so dailies advance without
// waiting for the military scheduler.
func TestTrainTroopsEventAdvancesDaily(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := quest003DailyCatalog()
	svc := NewService(store, cat, nil, nil)
	actor := Actor{ServerID: 1, PlayerID: 7}
	svc.SetClock(func() time.Time { return time.Unix(1_800_000_000, 0).UTC() })

	_, _, err := svc.AcceptQuest(ctx, actor, 1014)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.ApplyProgressEvent(ctx, actor, ProgressEvent{
		Kind: EventTrainTroops, UnitCode: "infantry", Delta: 20,
	}); err != nil {
		t.Fatal(err)
	}
	row, has, err := store.GetPlayerQuest(ctx, 1, 7, 1014)
	if err != nil || !has {
		t.Fatal(err)
	}
	if row.Progress.Count != 20 {
		t.Fatalf("progress %d", row.Progress.Count)
	}
	if err := svc.ApplyProgressEvent(ctx, actor, ProgressEvent{
		Kind: EventTrainTroops, UnitCode: "cavalry", Delta: 30,
	}); err != nil {
		t.Fatal(err)
	}
	row, _, _ = store.GetPlayerQuest(ctx, 1, 7, 1014)
	if row.State != StateClaimable || row.Progress.Count != 50 {
		t.Fatalf("state %d progress %d", row.State, row.Progress.Count)
	}
}

func TestBuildLevelEventAdvancesDaily(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := quest003DailyCatalog()
	svc := NewService(store, cat, nil, nil)
	actor := Actor{ServerID: 1, PlayerID: 8}

	_, _, err := svc.AcceptQuest(ctx, actor, 1032)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.ApplyProgressEvent(ctx, actor, ProgressEvent{
		Kind: EventBuildLevel, BuildingCfgID: 2, BuildLevel: 2, Delta: 1,
	}); err != nil {
		t.Fatal(err)
	}
	row, has, err := store.GetPlayerQuest(ctx, 1, 8, 1032)
	if err != nil || !has {
		t.Fatal(err)
	}
	if row.State != StateClaimable {
		t.Fatalf("state %d progress %d", row.State, row.Progress.Count)
	}
}

func TestUseItemEventAdvancesDaily(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := quest003DailyCatalog()
	svc := NewService(store, cat, nil, nil)
	actor := Actor{ServerID: 1, PlayerID: 9}

	_, _, err := svc.AcceptQuest(ctx, actor, 1033)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.ApplyProgressEvent(ctx, actor, ProgressEvent{
		Kind: EventUseItem, ItemCode: "march_ration", Delta: 1,
	}); err != nil {
		t.Fatal(err)
	}
	row, has, err := store.GetPlayerQuest(ctx, 1, 9, 1033)
	if err != nil || !has {
		t.Fatal(err)
	}
	if row.State != StateClaimable {
		t.Fatalf("state %d", row.State)
	}
}

func TestCollectResourceEventStillAdvancesDaily(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := quest003DailyCatalog()
	svc := NewService(store, cat, nil, nil)
	actor := Actor{ServerID: 1, PlayerID: 10}

	_, _, err := svc.AcceptQuest(ctx, actor, 1012)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.ApplyProgressEvent(ctx, actor, ProgressEvent{
		Kind: EventCollectResource, Resource: "food", Delta: 100,
	}); err != nil {
		t.Fatal(err)
	}
	row, has, err := store.GetPlayerQuest(ctx, 1, 10, 1012)
	if err != nil || !has || row.State != StateClaimable {
		t.Fatalf("row %+v err %v", row, err)
	}
}
