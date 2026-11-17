package api

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

// Count actual HERO release lookups, including idempotent attempts that do not
// save a status. The underlying store is used directly for test observations.
type registrationHeroStore struct {
	hero.Store
	calls   atomic.Int64
	entered chan struct{}
	resume  chan struct{}
}

func (s *registrationHeroStore) GetHero(ctx context.Context, sid int32, id int64) (*hero.Hero, error) {
	if s.calls.Add(1) == 1 && s.entered != nil {
		close(s.entered)
		<-s.resume
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return s.Store.GetHero(ctx, sid, id)
}

func registrationFixture(t *testing.T, battle bool) (*Server, *march.MarchOrder, int64, *registrationHeroStore) {
	t.Helper()
	s := garrisonServer(t)
	s.heroSvc = hero.NewService()
	ctx := context.Background()
	h := &hero.Hero{ServerID: 1, PlayerID: 55, TemplateCfgID: 1001, Level: 1, Status: hero.StatusIdle}
	if err := s.heroSvc.Store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if err := s.claimMarchHero(ctx, PlayerContext{ServerID: 1, PlayerID: 55}, h.HeroID); err != nil {
		t.Fatal(err)
	}
	store := &registrationHeroStore{Store: s.heroSvc.Store}
	s.heroSvc.Store = store
	s.military.EnsureCity(&march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{1: 4}})
	if battle {
		s.military.SetMarchArrivalHandler(func(context.Context, march.MarchArrivalEvent) (march.MarchArrivalOutcome, error) {
			return march.MarchArrivalOutcome{BattleRan: true, ReportID: 17, RemainingTroops: []march.TroopStack{{UnitCfgID: 1, Count: 1}}}, nil
		})
	}
	order, err := s.military.CreateMarch(march.StartMarchRequest{ArmyID: 1, OriginCityID: 7, PlayerID: 55,
		HeroID: h.HeroID, FromX: 1, FromY: 1, ToX: 2, ToY: 1, Purpose: 1,
		Troops: []march.TroopStack{{UnitCfgID: 1, Count: 2}}})
	if err != nil {
		t.Fatal(err)
	}
	return s, order, h.HeroID, store
}

func registrationStatus(t *testing.T, s *Server, store *registrationHeroStore, id int64, status int16, calls int64) {
	t.Helper()
	h, err := store.Store.GetHero(context.Background(), 1, id)
	if err != nil || h == nil || h.Status != status || store.calls.Load() != calls {
		t.Fatalf("hero=%+v err=%v release attempts=%d want=%d", h, err, store.calls.Load(), calls)
	}
	rows, total := s.listPlayerMarches(55, 7, 100, 0)
	if total != 1 || len(rows) != 1 || rows[0].heroID != id || rows[0].troops[0].Count != 2 {
		t.Fatalf("registration lost ownership/history: %+v total=%d", rows, total)
	}
}

func TestMarchRegistrationFinishOrders(t *testing.T) {
	for _, tc := range []struct {
		name   string
		battle bool
		before int // 0: register while marching; 1: after arrival; 2: after return.
	}{
		{"marching-no-battle", false, 0},
		{"arrived-before-register", false, 1},
		{"marching-battle", true, 0},
		{"returning-before-register", true, 1},
		{"returned-before-register", true, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, order, id, store := registrationFixture(t, tc.battle)
			poll := func(at time.Time) {
				t.Helper()
				if got := s.military.Scheduler().PollDue(at); got != 1 {
					t.Fatalf("actual MIL events=%d", got)
				}
			}
			if tc.before >= 1 {
				poll(order.ArriveAt)
			}
			if tc.before == 2 {
				poll(s.military.March(order.ID).ReturnFinishAt)
			}
			input := []march.TroopStack{{UnitCfgID: 1, Count: 2}}
			s.registerStartedMarch(PlayerContext{ServerID: 1, PlayerID: 55}, 7, order.ID, id, input)
			input[0].Count = -1
			terminal := (!tc.battle && tc.before == 1) || tc.before == 2
			if terminal {
				registrationStatus(t, s, store, id, hero.StatusIdle, 1)
			} else {
				registrationStatus(t, s, store, id, hero.StatusMarch, 0)
				b, ok := s.lookupMarchHero(order.ID)
				if !ok || b.serverID != 1 || b.playerID != 55 || b.heroID != id {
					t.Fatalf("incomplete active binding: %+v found=%v", b, ok)
				}
			}
			if tc.before == 0 {
				poll(order.ArriveAt)
			}
			if tc.battle && tc.before < 2 {
				registrationStatus(t, s, store, id, hero.StatusMarch, 0)
				poll(s.military.March(order.ID).ReturnFinishAt)
			}
			registrationStatus(t, s, store, id, hero.StatusIdle, 1)
			if _, ok := s.lookupMarchHero(order.ID); ok {
				t.Fatal("terminal binding remains")
			}
			s.reconcileFinishedMarch(order.ID)
			s.releaseMarchHeroByMarchID(context.Background(), order.ID)
			registrationStatus(t, s, store, id, hero.StatusIdle, 1)
			want := int32(2)
			if tc.battle {
				want = 3
			}
			if s.military.SnapshotCity(7).Troops[1] != want {
				t.Fatal("registration changed ready troop credits")
			}
		})
	}
}

func TestMarchRegistrationSingleReleaseAndReclaim(t *testing.T) {
	s, order, id, store := registrationFixture(t, false)
	if s.military.Scheduler().PollDue(order.ArriveAt) != 1 {
		t.Fatal("arrival did not finish before registration")
	}
	// Reproduce registration's complete-map / reconciliation boundary. Only the
	// production release and reconciliation methods run concurrently below.
	s.recordPlayerMarch(PlayerContext{ServerID: 1, PlayerID: 55}, 7, order.ID, id, []march.TroopStack{{UnitCfgID: 1, Count: 2}})
	store.entered, store.resume = make(chan struct{}), make(chan struct{})
	released := false
	defer func() {
		if !released {
			close(store.resume)
		}
	}()
	const workers = 32
	start, done := make(chan struct{}), make(chan struct{}, workers)
	for i := 0; i < workers; i++ {
		go func(reconcile bool) {
			<-start
			if reconcile {
				s.reconcileFinishedMarch(order.ID)
			} else {
				s.releaseMarchHeroByMarchID(context.Background(), order.ID)
			}
			done <- struct{}{}
		}(i%2 == 0)
	}
	close(start)
	waitMarchIndexWorkers(t, store.entered)
	// All other consumers must finish while the sole HERO lookup is blocked.
	for i := 0; i < workers-1; i++ {
		waitMarchIndexWorkers(t, done)
	}
	if store.calls.Load() != 1 {
		t.Fatal("multiple consumers reached HERO")
	}
	close(store.resume)
	released = true
	waitMarchIndexWorkers(t, done)
	registrationStatus(t, s, store, id, hero.StatusIdle, 1)
	if err := s.claimMarchHero(context.Background(), PlayerContext{ServerID: 1, PlayerID: 55}, id); err != nil {
		t.Fatal(err)
	}
	calls := store.calls.Load()
	for i := 0; i < 3; i++ {
		s.reconcileFinishedMarch(order.ID)
		s.releaseMarchHeroByMarchID(context.Background(), order.ID)
	}
	registrationStatus(t, s, store, id, hero.StatusMarch, calls)
}

func TestMarchRegistrationIgnoresCanceledRequestLifetime(t *testing.T) {
	s, order, id, store := registrationFixture(t, false)
	request, cancel := context.WithCancel(context.Background())
	cancel()
	if request.Err() == nil || s.military.Scheduler().PollDue(order.ArriveAt) != 1 {
		t.Fatal("canceled request / completed march precondition failed")
	}
	// There is intentionally no request-context parameter on registration: the
	// finished lifecycle must still reach a context-sensitive real HERO store.
	s.registerStartedMarch(PlayerContext{ServerID: 1, PlayerID: 55}, 7, order.ID, id, []march.TroopStack{{UnitCfgID: 1, Count: 2}})
	registrationStatus(t, s, store, id, hero.StatusIdle, 1)
}
