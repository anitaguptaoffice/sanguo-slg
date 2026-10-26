package hero

import (
	"context"
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestPlanRecruitConcurrentWithOtherServiceDraws(t *testing.T) {
	s := NewService()
	input, before := planState(), planState()
	var wg sync.WaitGroup
	for i := 0; i < 64; i++ {
		p := PlayerRef{ServerID: 1, PlayerID: int64(i + 100)}
		h := &Hero{ServerID: p.ServerID, PlayerID: p.PlayerID, Level: 1, Loyalty: 10, Status: StatusIdle}
		if err := s.Store.CreateHero(context.Background(), h); err != nil {
			t.Fatal(err)
		}
		wg.Add(3)
		go func() {
			defer wg.Done()
			plan, err := s.PlanRecruit(input, RecruitRequest{})
			if err != nil || plan.Hero.HeroID != 0 || plan.Hero.TemplateCfgID == 1002 || plan.ItemsAfter[RecruitScrollID] != 2 {
				t.Errorf("concurrent plan: %+v %v", plan, err)
			}
		}()
		go func() {
			defer wg.Done()
			inv := &memInventory{wallet: Resources{Gold: 10000}, items: map[int32]int32{}}
			if _, err := s.LargessPlayer(context.Background(), p, inv, LargessRequest{HeroID: h.HeroID, Kind: LargessGiftGold}); err != nil {
				t.Error(err)
			}
		}()
		go func() {
			defer wg.Done()
			if _, err := s.ListHotelCandidates(context.Background(), p, CityRef{CityID: p.PlayerID}, &memHotelStore{}, &stubHotelCity{hotelLevel: 2}); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if !reflect.DeepEqual(input, before) {
		t.Fatal("concurrent plans mutated shared snapshot")
	}
}

type blockedHotelStore struct {
	memHotelStore
	entered chan struct{}
	release chan struct{}
}

func (b *blockedHotelStore) NextCandidateID(ctx context.Context, serverID int32, cityID int64) (int64, error) {
	if b.nextID == 1 {
		close(b.entered)
		select {
		case <-b.release:
		case <-ctx.Done():
			return 0, ctx.Err()
		}
	}
	return b.memHotelStore.NextCandidateID(ctx, serverID, cityID)
}

func TestPlanRecruitDoesNotWaitForHotelDatabase(t *testing.T) {
	s := NewService()
	hs := &blockedHotelStore{entered: make(chan struct{}), release: make(chan struct{})}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	done := make(chan error, 1)
	go func() {
		_, err := s.ListHotelCandidates(ctx, PlayerRef{1, 9}, CityRef{1}, hs, &stubHotelCity{hotelLevel: 2})
		done <- err
	}()
	defer func() {
		close(hs.release)
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	select {
	case <-hs.entered:
	case <-ctx.Done():
		t.Fatal("hotel did not reach store wait")
	}
	planned := make(chan error, 1)
	go func() { _, err := s.PlanRecruit(planState(), RecruitRequest{}); planned <- err }()
	select {
	case err := <-planned:
		if err != nil {
			t.Fatal(err)
		}
	case <-ctx.Done():
		t.Fatal("plan blocked on RNG mutex held across store wait")
	}
}
