package hero

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"reflect"
	"sync"
	"testing"
	"time"
)

type hotelPlanOracle struct {
	memHotelStore
	replaced, ticked bool
}

func (m *hotelPlanOracle) ReplaceCandidates(ctx context.Context, server int32, city int64, rows []*HotelCandidate) error {
	m.replaced = true
	return m.memHotelStore.ReplaceCandidates(ctx, server, city, rows)
}

func (m *hotelPlanOracle) SetLastPoolTick(ctx context.Context, server int32, city int64, at time.Time) error {
	m.ticked = true
	return m.memHotelStore.SetLastPoolTick(ctx, server, city, at)
}

func hotelPlanningService(seed int64, now time.Time) (*Service, *int) {
	s, calls := NewService(), new(int)
	s.RNG = rand.New(rand.NewSource(seed))
	s.SetClock(func() time.Time { *calls++; return now })
	// Any accidental store access must fail rather than making parity pass.
	s.Store, s.HotelStore = nil, nil
	return s, calls
}

func TestHotelPlanSyncLegacyParityAndBoundaries(t *testing.T) {
	for _, level := range []int32{1, 2, 7, 11, 20} {
		block := poolBlockSeconds(level)
		// Boundary respects the +8h offset, including non-divisors such as level 7.
		boundary := time.Unix(500_000*block-8*3600, 0).UTC()
		for _, count := range []int{0, 1, int(level), int(level) + 2} {
			for _, last := range []time.Time{time.Time{}, boundary.Add(-time.Second), boundary, boundary.Add(time.Second), boundary.Add(time.Duration(block) * time.Second)} {
				t.Run(fmt.Sprintf("level%d/count%d/last%d", level, count, last.Unix()), func(t *testing.T) {
					var input []*HotelCandidate
					for i := 0; i < count; i++ {
						input = append(input, txHotelCandidate(int64(i+1), boundary.Add(-time.Hour)))
					}
					before, _ := copyHotelSnapshot(1, 77, input)
					oracleRows, _ := copyHotelSnapshot(1, 77, input)
					oracle := &hotelPlanOracle{memHotelStore: memHotelStore{rows: oracleRows, lastTick: last, nextID: 100}}
					if err := SyncHotelPool(context.Background(), oracle, rand.New(rand.NewSource(17)), 1, 77, level, boundary); err != nil {
						t.Fatal(err)
					}
					s, calls := hotelPlanningService(17, boundary)
					plan, err := s.PlanHotelSync(1, CityRef{CityID: 77}, level, input, last)
					if err != nil || *calls != 1 || plan.Replace != oracle.replaced || plan.SaveTick != oracle.ticked {
						t.Fatalf("plan flags/clock: %+v calls=%d err=%v", plan, *calls, err)
					}
					if plan.SaveTick && !plan.Tick.Equal(oracle.lastTick) || plan.ItemDebit != (ItemCost{}) {
						t.Fatalf("tick/item: %+v", plan)
					}
					// Only tests assign synthetic IDs; production must use the tx sequence.
					nextID := int64(100)
					for _, c := range plan.Candidates {
						if c.CandidateID == 0 {
							nextID++
							c.CandidateID = nextID
						}
					}
					for _, c := range oracle.rows {
						c.ServerID = 1 // Legacy generation has no internal provenance field.
					}
					if !reflect.DeepEqual(plan.Candidates, oracle.rows) || !reflect.DeepEqual(before, input) && len(input) != 0 {
						t.Fatalf("legacy rule/input mismatch\nplan=%+v\noracle=%+v", plan.Candidates, oracle.rows)
					}
					if len(plan.Candidates) > 0 && len(input) > 0 {
						plan.Candidates[0].DisplayName = "disposable"
						if !reflect.DeepEqual(before, input) {
							t.Fatal("plan aliases snapshot")
						}
					}
				})
			}
		}
	}
}

func TestHotelPlanRefreshGeneratorParity(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	for level := int32(1); level <= 20; level++ {
		for seed := int64(1); seed <= 10; seed++ {
			s, calls := hotelPlanningService(seed, now)
			plan, err := s.PlanHotelRefresh(1, CityRef{CityID: 77}, level)
			if err != nil || *calls != 1 || !plan.Replace || !plan.SaveTick || !plan.Tick.Equal(now) || plan.ItemDebit != (ItemCost{HotelRefreshItemCfgID, 1}) {
				t.Fatalf("refresh: %+v calls=%d err=%v", plan, *calls, err)
			}
			rng := rand.New(rand.NewSource(seed))
			if len(plan.Candidates) != int(level) {
				t.Fatal("refresh size")
			}
			for _, got := range plan.Candidates {
				want := GenerateHotelCandidate(rng, 77, level, 0, now)
				want.ServerID = 1
				if !reflect.DeepEqual(got, want) {
					t.Fatalf("generator drift level=%d seed=%d: %+v want %+v", level, seed, got, want)
				}
			}
		}
	}
}

func TestHotelPlanRecruitPreservesPersistedCandidate(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	s, calls := hotelPlanningService(1, now)
	candidate := txHotelCandidate(42, now.Add(-100*24*time.Hour))
	p, city := PlayerRef{ServerID: 1, PlayerID: 9}, CityRef{CityID: 77}
	owned := []*Hero{{ServerID: 1, PlayerID: 9, Status: StatusComing}, {ServerID: 1, PlayerID: 9, Status: StatusCaptive}}
	for _, price := range []int64{0, 12345, 1<<63 - 1} {
		candidate.GoldCost = price
		before := *candidate
		plan, err := s.PlanHotelRecruit(p, city, 1, 1, owned, 42, candidate)
		if err != nil || plan.CandidateID != 42 || plan.GoldDebit != price || plan.Hero.HeroID != 0 || *candidate != before {
			t.Fatalf("plan: %+v %v", plan, err)
		}
		want := &Hero{ServerID: 1, PlayerID: 9, TemplateCfgID: 0, DisplayName: candidate.DisplayName,
			Level: candidate.Level, Loyalty: candidate.Loyalty, Force: candidate.Force, Intel: candidate.Intel,
			Politics: candidate.Politics, Command: candidate.Command, Status: StatusIdle, CreatedAt: now}
		if !reflect.DeepEqual(plan.Hero, want) {
			t.Fatalf("hero attributes drifted: %+v want %+v", plan.Hero, want)
		}
		plan.Hero.DisplayName = "disposable"
		if candidate.DisplayName != before.DisplayName {
			t.Fatal("draft mutated candidate")
		}
	}
	if *calls != 3 {
		t.Fatalf("clock calls=%d", *calls)
	}
	owned = append(owned, &Hero{ServerID: 1, PlayerID: 9, Status: StatusMarch})
	if _, err := s.PlanHotelRecruit(p, city, 1, 1, owned, 42, candidate); !errors.Is(err, ErrHotelCapacityFull) {
		t.Fatalf("cross-city owned capacity: %v", err)
	}
	if _, err := s.PlanHotelRecruit(p, city, 1, 2, owned, 42, nil); !errors.Is(err, ErrHotelCandidateMissing) {
		t.Fatalf("missing: %v", err)
	}
}

func TestHotelPlansRejectUntrustedScopeAndState(t *testing.T) {
	s, _ := hotelPlanningService(1, time.Unix(1_700_000_000, 0))
	for _, mutate := range []func(*HotelCandidate){
		func(c *HotelCandidate) { c.ServerID = 0 }, func(c *HotelCandidate) { c.ServerID++ },
		func(c *HotelCandidate) { c.CityID++ }, func(c *HotelCandidate) { c.CandidateID = 0 },
		func(c *HotelCandidate) { c.GoldCost = -1 },
	} {
		c := txHotelCandidate(42, time.Now())
		mutate(c)
		if _, err := s.PlanHotelSync(1, CityRef{CityID: 77}, 1, []*HotelCandidate{c}, time.Time{}); !errors.Is(err, ErrInvalidHotelState) {
			t.Fatalf("sync scope: %v", err)
		}
		if _, err := s.PlanHotelRecruit(PlayerRef{1, 9}, CityRef{77}, 1, 1, nil, 42, c); !errors.Is(err, ErrInvalidHotelState) {
			t.Fatalf("recruit scope/cost: %v", err)
		}
	}
	for _, level := range []int32{0, -1, 10801} {
		if _, err := s.PlanHotelRefresh(1, CityRef{77}, level); err == nil {
			t.Fatalf("invalid level %d accepted", level)
		}
	}
	for _, server := range []int32{0, -1} {
		if _, err := s.PlanHotelSync(server, CityRef{77}, 1, nil, time.Time{}); !errors.Is(err, ErrInvalidHotelState) {
			t.Fatalf("invalid server: %v", err)
		}
	}
	if _, err := s.PlanHotelRefresh(1, CityRef{}, 1); !errors.Is(err, ErrInvalidHotelState) {
		t.Fatalf("invalid city: %v", err)
	}
	if _, err := (*Service)(nil).PlanHotelRefresh(1, CityRef{77}, 1); !errors.Is(err, ErrInvalidHotelState) {
		t.Fatalf("nil planner: %v", err)
	}
	c := txHotelCandidate(42, time.Now())
	for _, rows := range [][]*HotelCandidate{{nil}, {c, c}} {
		if _, err := s.PlanHotelSync(1, CityRef{77}, 1, rows, time.Time{}); !errors.Is(err, ErrInvalidHotelState) {
			t.Fatalf("invalid snapshot: %v", err)
		}
	}
	for _, owned := range [][]*Hero{{nil}, {{ServerID: 2, PlayerID: 9}}, {{ServerID: 1, PlayerID: 8}}} {
		if _, err := s.PlanHotelRecruit(PlayerRef{1, 9}, CityRef{77}, 1, 2, owned, 42, c); !errors.Is(err, ErrInvalidHotelState) {
			t.Fatalf("invalid owned snapshot: %v", err)
		}
	}
}

func TestHotelPlansConcurrentSharedRandom(t *testing.T) {
	s := NewService()
	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 20; j++ {
				if _, err := s.PlanHotelRefresh(1, CityRef{77}, 11); err != nil {
					t.Error(err)
				}
			}
		}()
	}
	wg.Wait()
}
