package hero

import (
	"context"
	"errors"
	"testing"
	"time"
)

type claimCapabilityProbe struct {
	Store
	readErr error
	claim   func(context.Context, PlayerRef, int64, time.Time) error
}

func (p *claimCapabilityProbe) GetHero(ctx context.Context, sid int32, id int64) (*Hero, error) {
	if p.readErr != nil {
		return nil, p.readErr
	}
	return p.Store.GetHero(ctx, sid, id)
}

func (p *claimCapabilityProbe) claimForMarch(ctx context.Context, actor PlayerRef, id int64, now time.Time) error {
	return p.claim(ctx, actor, id, now)
}

func TestMarchClaimStoreDispatch(t *testing.T) {
	ctx := context.Background()
	actor := PlayerRef{ServerID: 1, PlayerID: 55}
	s := NewService()
	h := &Hero{ServerID: 1, PlayerID: 55, Status: StatusIdle, Level: 1}
	if err := s.Store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	base := s.Store
	now := time.Unix(1700000000, 0)
	clocks, calls := 0, 0
	s.SetClock(func() time.Time {
		clocks++
		return now
	})
	sentinel := errors.New("claim transaction failure")
	p := &claimCapabilityProbe{Store: base}
	p.claim = func(gotCtx context.Context, gotActor PlayerRef, id int64, gotNow time.Time) error {
		calls++
		if gotCtx != ctx || gotActor != actor || id != h.HeroID || gotNow != now {
			t.Fatalf("incorrect dispatch: %+v %d %v", gotActor, id, gotNow)
		}
		return sentinel
	}
	s.UseStore(p)
	if err := s.ClaimForMarch(ctx, actor, h.HeroID); err != sentinel || calls != 1 || clocks != 1 {
		t.Fatalf("dispatch: %v calls=%d clocks=%d", err, calls, clocks)
	}
	got, _ := base.GetHero(ctx, 1, h.HeroID)
	force, _ := base.GetMarchForceState(ctx, 1, h.HeroID)
	if got.Status != StatusIdle || force != nil {
		t.Fatal("capability error fell through to legacy writes")
	}
	for _, tc := range []struct {
		name   string
		id     int64
		player int64
		status int16
		want   error
	}{
		{"invalid", 0, 55, StatusIdle, ErrHeroNotFound},
		{"missing", h.HeroID + 1, 55, StatusIdle, ErrHeroNotFound},
		{"foreign", h.HeroID, 56, StatusIdle, ErrHeroNotFound},
		{"chief", h.HeroID, 55, StatusCityChief, ErrHeroBusy},
		{"marching", h.HeroID, 55, StatusMarch, ErrHeroNotIdle},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h.Status = tc.status
			if err := base.SaveHero(ctx, h); err != nil {
				t.Fatal(err)
			}
			if err := s.ClaimForMarch(ctx, PlayerRef{ServerID: 1, PlayerID: tc.player}, tc.id); err != tc.want {
				t.Fatalf("precedence: %v want %v", err, tc.want)
			}
		})
	}
	p.readErr = sentinel
	if err := s.ClaimForMarch(ctx, actor, h.HeroID); err != sentinel || calls != 1 || clocks != 1 {
		t.Fatalf("precheck reached capability: %v calls=%d clocks=%d", err, calls, clocks)
	}
	// Embedding only Store hides even an already-capable adapter.
	p.readErr = nil
	s.UseStore(struct{ Store }{p})
	h.Status = StatusIdle
	if err := base.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if err := s.ClaimForMarch(ctx, actor, h.HeroID); err != nil {
		t.Fatal(err)
	}
	got, _ = base.GetHero(ctx, 1, h.HeroID)
	force, _ = base.GetMarchForceState(ctx, 1, h.HeroID)
	if got.Status != StatusMarch || force == nil || force.Current != 14 || calls != 1 || clocks != 2 {
		t.Fatalf("legacy fallback changed: %+v %+v calls=%d clocks=%d", got, force, calls, clocks)
	}
}
