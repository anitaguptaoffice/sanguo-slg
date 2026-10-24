package hero

import (
	"context"
	"testing"
	"time"
)

func TestMarchForceMaxAndConsume(t *testing.T) {
	level := int32(5)
	max := MarchForceMax(level)
	if max != 40 {
		t.Fatalf("max=%d want 40", max)
	}
	h := &Hero{ServerID: 1, HeroID: 1, Level: level, Status: StatusIdle}
	now := time.Unix(1_700_000_000, 0)
	st := &MarchForceState{ServerID: 1, HeroID: 1, Current: MarchForceMarchCost, LastRegenAt: now}
	_, err := ConsumeMarchForceOnce(h, st, now)
	if err != nil {
		t.Fatal(err)
	}
	if st.Current != 0 {
		t.Fatalf("current=%d want 0", st.Current)
	}
	_, err = ConsumeMarchForceOnce(h, st, now)
	if err != ErrInsufficientMarchForce {
		t.Fatalf("want insufficient force, got %v", err)
	}
}

func TestMarchForceRegenWhenIdle(t *testing.T) {
	h := &Hero{Level: 1, Status: StatusIdle}
	max := MarchForceMax(1)
	st := &MarchForceState{Current: 0, LastRegenAt: time.Unix(0, 0)}
	now := time.Unix(MarchForceRegenPeriodSec*3, 0)
	ApplyMarchForceRegen(st, max, h.Status, now)
	if st.Current != 3 {
		t.Fatalf("regen current=%d want 3", st.Current)
	}
}

func TestClaimForMarchRejectsLowForce(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	svc := NewService()
	svc.SetClock(func() time.Time { return now })
	ctx := context.Background()
	p := PlayerRef{ServerID: 1, PlayerID: 9}
	h := &Hero{
		ServerID: 1, HeroID: 2, PlayerID: 9, TemplateCfgID: 1001,
		Level: 1, Status: StatusIdle, Loyalty: LoyaltyDefault,
	}
	if err := svc.Store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	low := MarchForceState{
		ServerID: 1, HeroID: 2, Current: MarchForceMarchCost - 1,
		LastRegenAt: now,
	}
	if err := svc.Store.SaveMarchForceState(ctx, low); err != nil {
		t.Fatal(err)
	}
	if err := svc.ClaimForMarch(ctx, p, 2); err != ErrInsufficientMarchForce {
		t.Fatalf("want insufficient march force, got %v", err)
	}
	got, _ := svc.Store.GetHero(ctx, 1, 2)
	if got.Status != StatusIdle {
		t.Fatalf("status=%d want idle", got.Status)
	}
}

func TestRestHeroRefillsForce(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	p := PlayerRef{ServerID: 1, PlayerID: 1}
	h := &Hero{ServerID: 1, HeroID: 3, PlayerID: 1, Level: 3, Status: StatusIdle}
	if err := svc.Store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if err := svc.Store.SaveMarchForceState(ctx, MarchForceState{
		ServerID: 1, HeroID: 3, Current: 5, LastRegenAt: time.Now(),
	}); err != nil {
		t.Fatal(err)
	}
	view, err := svc.RestHero(ctx, p, 3)
	if err != nil {
		t.Fatal(err)
	}
	if view.Current != MarchForceMax(3) {
		t.Fatalf("current=%d max=%d", view.Current, view.Max)
	}
}
