package quest

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func TestContentGranterGrant(t *testing.T) {
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	svc := content.NewService(cat)
	granter := NewContentGranter(svc)
	ctx := context.Background()

	req := GrantRequest{
		ServerID:       1,
		PlayerID:       99,
		QuestCfgID:     1001,
		IdempotencyKey: QuestClaimIdempotencyKey(99, 1001),
		Rewards: RewardBundle{
			Resources: map[string]int64{"food": 100},
			Items:     []RewardItem{{ItemCfgID: 2001, Quantity: 1}},
		},
	}
	granted, err := granter.GrantQuestReward(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	if granted.Resources["food"] != 100 {
		t.Fatalf("granted %+v", granted)
	}
	p := content.PlayerRef{ServerID: 1, PlayerID: 99}
	qty, _ := svc.Get(p, 2001)
	if qty != 1 {
		t.Fatalf("bag qty %d", qty)
	}
	_, err = granter.GrantQuestReward(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	qty2, _ := svc.Get(p, 2001)
	if qty2 != 1 {
		t.Fatalf("idempotent grant should not stack items: %d", qty2)
	}
}

func TestContentGranterHonorsCanceledContext(t *testing.T) {
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	svc := content.NewService(cat)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := GrantRequest{ServerID: 1, PlayerID: 98, IdempotencyKey: "quest:98:1002:claim",
		Rewards: RewardBundle{Items: []RewardItem{{ItemCfgID: 2004, Quantity: 1}}}}
	if _, err := NewContentGranter(svc).GrantQuestReward(ctx, req); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled grant: %v", err)
	}
	if qty, err := svc.Get(content.PlayerRef{ServerID: 1, PlayerID: 98}, 2004); err != nil || qty != 0 {
		t.Fatalf("canceled grant changed bag: %d %v", qty, err)
	}
}
