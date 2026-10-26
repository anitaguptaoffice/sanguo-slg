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
		ServerID: 1, PlayerID: 9, TemplateCfgID: 1001,
		Level: 1, Loyalty: LoyaltyDefault, Status: StatusIdle, CreatedAt: time.Now(),
	}
	if err := svc.Store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if err := svc.ClaimForMarch(ctx, p, h.HeroID); err != nil {
		t.Fatal(err)
	}
	got, _ := svc.Store.GetHero(ctx, 1, h.HeroID)
	if got.Status != StatusMarch {
		t.Fatalf("status %d", got.Status)
	}
	if err := svc.ClaimForMarch(ctx, p, h.HeroID); err != ErrHeroNotIdle {
		t.Fatalf("dup claim: %v", err)
	}
	if err := svc.ReleaseFromMarch(ctx, p, h.HeroID); err != nil {
		t.Fatal(err)
	}
	got, _ = svc.Store.GetHero(ctx, 1, h.HeroID)
	if got.Status != StatusIdle {
		t.Fatalf("after release status %d", got.Status)
	}
}
