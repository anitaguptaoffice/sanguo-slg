package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

func dailyCatalog() *MemCatalog {
	return NewMemCatalog([]QuestCfg{
		{
			QuestCfgID:  1012,
			Code:        "daily_food_1",
			QuestType:   QuestTypeDaily,
			ChainID:     DailyChainID,
			Repeatable:  true,
			UnlockLevel: 1,
			Objectives:  []Objective{{Type: "collect_resource", Resource: "food", Count: 100}},
			Rewards:     RewardBundle{Resources: map[string]int64{"silver": 10}},
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
	})
}

func TestDailyResetAtDayBoundary(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := dailyCatalog()
	svc := NewService(store, cat, &mockGranter{}, nil)
	actor := Actor{ServerID: 1, PlayerID: 9}

	day1 := time.Date(2026, 10, 22, 23, 50, 0, 0, time.UTC)
	day2 := time.Date(2026, 10, 23, 0, 10, 0, 0, time.UTC)
	svc.SetClock(func() time.Time { return day1 })

	_, _, err := svc.AcceptQuest(ctx, actor, 1012)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = svc.ReportQuestProgress(ctx, actor, 1012, true, 100)
	if err != nil {
		t.Fatal(err)
	}
	claimed, _, _, err := svc.ClaimQuestReward(ctx, actor, 1012)
	if err != nil {
		t.Fatal(err)
	}
	if claimed.State != PlayerQuestStateCompleted {
		t.Fatalf("state %v", claimed.State)
	}

	svc.SetClock(func() time.Time { return day2 })
	_, _, err = svc.AcceptQuest(ctx, actor, 1012)
	if err != nil {
		t.Fatalf("expected re-accept after day roll, got %v", err)
	}

	quests, _, err := svc.ListPlayerQuests(ctx, actor, ListQuestsFilter{
		ChainIDs: []int32{DailyChainID},
		QuestType: QuestTypeDaily,
	})
	if err != nil {
		t.Fatal(err)
	}
	var found *PlayerQuestProgress
	for _, q := range quests {
		if q.QuestCfgID == 1012 {
			found = &q
			break
		}
	}
	if found == nil || found.State != PlayerQuestStateInProgress {
		t.Fatalf("list after reset: %+v", found)
	}
}

func TestDailyStillBlockedSameDay(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := dailyCatalog()
	svc := NewService(store, cat, &mockGranter{}, nil)
	actor := Actor{ServerID: 1, PlayerID: 3}
	mid := time.Date(2026, 10, 23, 15, 0, 0, 0, time.UTC)
	svc.SetClock(func() time.Time { return mid })

	_, _, _ = svc.AcceptQuest(ctx, actor, 1012)
	_, _, _ = svc.ReportQuestProgress(ctx, actor, 1012, true, 100)
	_, _, _, _ = svc.ClaimQuestReward(ctx, actor, 1012)

	_, _, err := svc.AcceptQuest(ctx, actor, 1012)
	if !errors.Is(err, ErrAlreadyCompleted) {
		t.Fatalf("same day re-accept: %v", err)
	}
}

func TestRecruitHeroEventAdvancesDaily(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := dailyCatalog()
	svc := NewService(store, cat, nil, nil)
	actor := Actor{ServerID: 1, PlayerID: 5}
	svc.SetClock(func() time.Time { return time.Unix(1_800_000_000, 0).UTC() })

	_, _, err := svc.AcceptQuest(ctx, actor, 1015)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.ApplyProgressEvent(ctx, actor, ProgressEvent{Kind: EventRecruitHero}); err != nil {
		t.Fatal(err)
	}
	row, has, err := store.GetPlayerQuest(ctx, 1, 5, 1015)
	if err != nil || !has {
		t.Fatal(err)
	}
	if row.State != StateClaimable {
		t.Fatalf("state %d progress %d", row.State, row.Progress.Count)
	}
}
