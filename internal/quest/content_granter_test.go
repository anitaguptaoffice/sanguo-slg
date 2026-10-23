package quest

import (
	"context"
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
