package hero

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

type forceStoreProbe struct {
	Store
	events                      *[]string
	heroErr, forceErr, writeErr error
}

func (p *forceStoreProbe) GetHero(ctx context.Context, sid int32, id int64) (*Hero, error) {
	*p.events = append(*p.events, "hero")
	if p.heroErr != nil {
		return nil, p.heroErr
	}
	return p.Store.GetHero(ctx, sid, id)
}

func (p *forceStoreProbe) GetMarchForceState(ctx context.Context, sid int32, id int64) (*MarchForceState, error) {
	*p.events = append(*p.events, "force")
	if p.forceErr != nil {
		return nil, p.forceErr
	}
	return p.Store.GetMarchForceState(ctx, sid, id)
}

func (p *forceStoreProbe) SaveMarchForceState(ctx context.Context, st MarchForceState) error {
	*p.events = append(*p.events, "save")
	if p.writeErr != nil {
		return p.writeErr
	}
	return p.Store.SaveMarchForceState(ctx, st)
}

type forceCapabilityProbe struct {
	*forceStoreProbe
	call func(context.Context, PlayerRef, int64, time.Time, bool) (MarchForceView, error)
}

func (p *forceCapabilityProbe) marchForceForHero(ctx context.Context, actor PlayerRef, id int64, now time.Time) (MarchForceView, error) {
	return p.call(ctx, actor, id, now, false)
}

func (p *forceCapabilityProbe) restHero(ctx context.Context, actor PlayerRef, id int64, now time.Time) (MarchForceView, error) {
	return p.call(ctx, actor, id, now, true)
}

func TestMarchForceStoreDispatch(t *testing.T) {
	for _, path := range []string{"direct", "detail", "hotel", "rest"} {
		t.Run(path, func(t *testing.T) {
			ctx := context.Background()
			actor := PlayerRef{ServerID: 3, PlayerID: 55}
			s := NewService()
			h := &Hero{ServerID: 3, PlayerID: 55, TemplateCfgID: 1001, Level: 1, Status: StatusMarch}
			if path == "hotel" {
				h.TemplateCfgID = TemplateCfgIDHotelRandom
			} else if path == "rest" {
				h.TemplateCfgID = -999 // Rest never validates the template or stale status.
			}
			base := s.Store
			if err := base.CreateHero(ctx, h); err != nil {
				t.Fatal(err)
			}
			events := []string{}
			now := time.Unix(1700000000, 123000)
			s.SetClock(func() time.Time {
				events = append(events, "clock")
				return now
			})
			p := &forceCapabilityProbe{forceStoreProbe: &forceStoreProbe{Store: base, events: &events}}
			s.UseStore(p)
			want := MarchForceView{Current: 17, Max: 44} // Capability owns the latest level.
			for _, resultErr := range []error{errors.New("transaction failure"), context.Canceled, nil} {
				events = nil
				p.call = func(gotCtx context.Context, gotActor PlayerRef, id int64, gotNow time.Time, rest bool) (MarchForceView, error) {
					events = append(events, "capability")
					if gotCtx != ctx || gotActor != actor || id != h.HeroID || gotNow != now || rest != (path == "rest") {
						t.Fatal("incorrect capability dispatch")
					}
					return want, resultErr
				}
				var got MarchForceView
				var err error
				if path == "direct" {
					got, err = s.MarchForceForHero(ctx, actor, h)
				} else if path == "rest" {
					got, err = s.RestHero(ctx, actor, h.HeroID)
				} else {
					var detail HeroDetail
					detail, err = s.GetHeroDetail(ctx, actor, h.HeroID)
					got = MarchForceView{Current: detail.MarchForce, Max: detail.MarchForceMax}
				}
				order := []string{"hero", "clock", "capability"}
				if path == "direct" {
					order = order[1:]
				}
				if err != resultErr || (err == nil && got != want) || !reflect.DeepEqual(events, order) {
					t.Fatalf("got %+v %v events=%v", got, err, events)
				}
				stored, _ := base.GetHero(ctx, actor.ServerID, h.HeroID)
				force, _ := base.GetMarchForceState(ctx, actor.ServerID, h.HeroID)
				if !reflect.DeepEqual(stored, h) || force != nil {
					t.Fatal("capability dispatch fell through to legacy writes")
				}
			}
		})
	}
}

func TestMarchForceStorePrecedence(t *testing.T) {
	ctx := context.Background()
	for _, path := range []string{"detail", "rest"} {
		for _, failure := range []string{"missing", "foreign", "shard", "read", "template"} {
			if path == "rest" && failure == "template" {
				continue
			}
			t.Run(path+"/"+failure, func(t *testing.T) {
				s := NewService()
				actor := PlayerRef{ServerID: 1, PlayerID: 55}
				h := &Hero{ServerID: 1, PlayerID: 55, TemplateCfgID: -999}
				if err := s.Store.CreateHero(ctx, h); err != nil {
					t.Fatal(err)
				}
				id, want := h.HeroID, ErrHeroNotFound
				events := []string{}
				p := &forceCapabilityProbe{forceStoreProbe: &forceStoreProbe{Store: s.Store, events: &events}}
				p.call = func(context.Context, PlayerRef, int64, time.Time, bool) (MarchForceView, error) {
					t.Fatal("precheck reached capability")
					return MarchForceView{}, nil
				}
				s.UseStore(p)
				s.SetClock(func() time.Time {
					t.Fatal("precheck sampled clock")
					return time.Time{}
				})
				switch failure {
				case "missing":
					id++
				case "foreign":
					actor.PlayerID++
				case "shard":
					actor.ServerID++
				case "read":
					want = errors.New("hero read failed")
					p.heroErr = want
				case "template":
					want = ErrUnknownTemplate
				}
				var err error
				if path == "rest" {
					_, err = s.RestHero(ctx, actor, id)
				} else {
					_, err = s.GetHeroDetail(ctx, actor, id)
				}
				if err != want || !reflect.DeepEqual(events, []string{"hero"}) {
					t.Fatalf("precedence: %v events=%v", err, events)
				}
				if _, err := s.MarchForceForHero(ctx, actor, nil); err != ErrHeroNotFound {
					t.Fatalf("nil hero: %v", err)
				}
			})
		}
	}
}

func TestMarchForceStoreFallback(t *testing.T) {
	for _, kind := range []string{"memory", "custom", "store-only"} {
		t.Run(kind, func(t *testing.T) {
			ctx := context.Background()
			s := NewService()
			base := s.Store
			actor := PlayerRef{ServerID: 1, PlayerID: 55}
			h := &Hero{ServerID: 1, PlayerID: 55, Level: 1, Status: StatusIdle}
			if err := base.CreateHero(ctx, h); err != nil {
				t.Fatal(err)
			}
			events := []string{}
			p := &forceStoreProbe{Store: base, events: &events}
			if kind == "custom" {
				s.UseStore(p)
			} else if kind == "store-only" {
				s.UseStore(struct{ Store }{&forceCapabilityProbe{forceStoreProbe: p}}) // Hidden nil callback must never run.
			}
			now := time.Unix(1700000000, 0)
			s.SetClock(func() time.Time {
				events = append(events, "clock")
				return now
			})
			for _, rest := range []bool{false, true} {
				events = nil
				var got MarchForceView
				var err error
				if rest {
					if err = base.SaveMarchForceState(ctx, MarchForceState{ServerID: 1, HeroID: h.HeroID, Current: 2}); err != nil {
						t.Fatal(err)
					}
					got, err = s.RestHero(ctx, actor, h.HeroID)
				} else {
					got, err = s.MarchForceForHero(ctx, actor, h)
				}
				force, _ := base.GetMarchForceState(ctx, 1, h.HeroID)
				if err != nil || got != (MarchForceView{Current: 24, Max: 24}) || force == nil || force.Current != 24 || force.LastRegenAt != now {
					t.Fatalf("legacy force: %+v %+v %v", got, force, err)
				}
				order := []string{"clock"}
				if kind != "memory" {
					order = []string{"clock", "force", "save"}
					if rest {
						order = append([]string{"hero"}, order...)
					}
				}
				if !reflect.DeepEqual(events, order) {
					t.Fatalf("legacy order: %v", events)
				}
			}
			h.Status = StatusMarch
			if err := base.SaveHero(ctx, h); err != nil {
				t.Fatal(err)
			}
			want := ErrHeroNotInCity
			if kind != "memory" {
				want = errors.New("force read precedes idle validation")
				p.forceErr = want
			}
			events = nil
			if _, err := s.RestHero(ctx, actor, h.HeroID); err != want {
				t.Fatalf("legacy rest precedence: %v want %v", err, want)
			}
			if kind != "memory" && !reflect.DeepEqual(events, []string{"hero", "clock", "force"}) {
				t.Fatalf("read error wrote force: %v", events)
			}
			if kind != "memory" {
				if _, err := s.MarchForceForHero(ctx, actor, h); err != want {
					t.Fatalf("legacy detail read error: %v", err)
				}
				p.forceErr = nil
				p.writeErr = errors.New("force write failed")
				h.Status = StatusIdle
				if err := base.SaveHero(ctx, h); err != nil {
					t.Fatal(err)
				}
				if _, err := s.MarchForceForHero(ctx, actor, h); err != p.writeErr {
					t.Fatalf("legacy detail write error: %v", err)
				}
				if _, err := s.RestHero(ctx, actor, h.HeroID); err != p.writeErr {
					t.Fatalf("legacy rest write error: %v", err)
				}
			}
		})
	}
}
