package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

type mockGranter struct {
	calls int
	last  GrantRequest
}

func (m *mockGranter) GrantQuestReward(_ context.Context, req GrantRequest) (RewardBundle, error) {
	m.calls++
	m.last = req
	return req.Rewards, nil
}

func (m *mockGranter) FindQuestRewardReceipt(context.Context, GrantRequest) (GrantReceipt, bool, error) {
	return GrantReceipt{}, false, nil
}

func tutorialCatalog() *MemCatalog {
	return NewMemCatalog([]QuestCfg{
		{
			QuestCfgID:  1001,
			QuestType:   1,
			Code:        "tutorial_build_hall",
			ChainID:     100,
			SortInChain: 1,
			UnlockLevel: 1,
			Objectives:  []Objective{{Type: "build_level", BuildingCfgID: 1, Level: 2}},
			Rewards: RewardBundle{
				Resources: map[string]int64{"food": 500},
				Items:     []RewardItem{{ItemCfgID: 2001, Quantity: 1}},
			},
		},
		{
			QuestCfgID:     1002,
			QuestType:      1,
			Code:           "tutorial_recruit",
			ChainID:        100,
			PrevQuestCfgID: 1001,
			SortInChain:    2,
			UnlockLevel:    1,
			Objectives:     []Objective{{Type: "recruit_hero", Count: 1}},
			Rewards: RewardBundle{
				Items: []RewardItem{{ItemCfgID: 2004, Quantity: 1}},
			},
		},
	})
}

func TestChainPrerequisiteAndAccept(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := tutorialCatalog()
	svc := NewService(store, cat, &mockGranter{}, nil)
	actor := Actor{ServerID: 1, PlayerID: 42}

	_, _, err := svc.AcceptQuest(ctx, actor, 1002)
	if !errors.Is(err, ErrPrerequisiteNotMet) {
		t.Fatalf("expected prerequisite error, got %v", err)
	}

	_, chain, err := svc.AcceptQuest(ctx, actor, 1001)
	if err != nil {
		t.Fatal(err)
	}
	if chain.ChainState != QuestChainStateInProgress {
		t.Fatalf("chain state %v", chain.ChainState)
	}

	_, _, err = svc.AcceptQuest(ctx, actor, 1001)
	if !errors.Is(err, ErrAlreadyAccepted) {
		t.Fatalf("expected already accepted, got %v", err)
	}

	_, _, err = svc.AcceptQuest(ctx, actor, 1002)
	if !errors.Is(err, ErrPrerequisiteNotMet) {
		t.Fatalf("expected prerequisite before complete, got %v", err)
	}
}

func TestProgressToClaimableAndClaim(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	cat := tutorialCatalog()
	granter := &mockGranter{}
	fixed := time.Unix(1_700_000_000, 0).UTC()
	svc := NewService(store, cat, granter, nil)
	svc.SetClock(func() time.Time { return fixed })
	actor := Actor{ServerID: 1, PlayerID: 7}

	_, _, err := svc.AcceptQuest(ctx, actor, 1001)
	if err != nil {
		t.Fatal(err)
	}
	q, _, err := svc.ReportQuestProgress(ctx, actor, 1001, true, 2)
	if err != nil {
		t.Fatal(err)
	}
	if q.State != PlayerQuestStateClaimable {
		t.Fatalf("state %v", q.State)
	}

	svc.SetTutorialFactsProvider(func(context.Context, Actor) (TutorialFacts, error) {
		return TutorialFacts{CompletedBuildingLevels: map[int32]int32{1: 2}}, nil
	})
	claimed, chain, granted, err := svc.ClaimQuestReward(ctx, actor, 1001)
	if err != nil {
		t.Fatal(err)
	}
	if claimed.State != PlayerQuestStateCompleted {
		t.Fatalf("state %v", claimed.State)
	}
	if granter.calls != 1 {
		t.Fatalf("granter calls %d", granter.calls)
	}
	if granter.last.IdempotencyKey != QuestClaimIdempotencyKey(actor.PlayerID, 1001) {
		t.Fatalf("idempotency %q", granter.last.IdempotencyKey)
	}
	if granted.Resources["food"] != 500 {
		t.Fatalf("granted %+v", granted)
	}

	_, _, _, err = svc.ClaimQuestReward(ctx, actor, 1001)
	if !errors.Is(err, ErrAlreadyCompleted) {
		t.Fatalf("expected already completed, got %v", err)
	}

	_, _, err = svc.AcceptQuest(ctx, actor, 1002)
	if err != nil {
		t.Fatal(err)
	}
	if chain.CompletedQuestCount != 1 {
		t.Fatalf("completed %d", chain.CompletedQuestCount)
	}
}

func TestParseRewardsJSON(t *testing.T) {
	b, err := ParseRewardsJSON([]byte(`{"resources":{"food":100},"items":[{"item_cfg_id":1,"qty":2}]}`))
	if err != nil {
		t.Fatal(err)
	}
	if b.Resources["food"] != 100 || len(b.Items) != 1 || b.Items[0].Quantity != 2 {
		t.Fatalf("%+v", b)
	}
}
