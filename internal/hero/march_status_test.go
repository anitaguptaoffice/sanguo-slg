package hero

import (
	"context"
	"testing"
	"time"
)

func TestClaimAndReleaseMarchHero(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	p := PlayerRef{ServerID: 1, PlayerID: 9}
	h := &Hero{
		ServerID: 1, HeroID: 7, PlayerID: 9, TemplateCfgID: 1001,
		Level: 1, Loyalty: LoyaltyDefault, Status: StatusIdle, CreatedAt: time.Now(),
	}
	if err := svc.Store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if err := svc.ClaimForMarch(ctx, p, 7); err != nil {
		t.Fatal(err)
	}
	got, _ := svc.Store.GetHero(ctx, 1, 7)
	if got.Status != StatusMarch {
		t.Fatalf("status %d", got.Status)
	}
	if err := svc.ClaimForMarch(ctx, p, 7); err != ErrHeroNotIdle {
		t.Fatalf("dup claim: %v", err)
	}
	if err := svc.ReleaseFromMarch(ctx, p, 7); err != nil {
		t.Fatal(err)
	}
	got, _ = svc.Store.GetHero(ctx, 1, 7)
	if got.Status != StatusIdle {
		t.Fatalf("after release status %d", got.Status)
	}
}
