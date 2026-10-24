package hero

import (
	"context"
	"math/rand"
	"testing"
	"time"
)

type memHotelStore struct {
	rows      []*HotelCandidate
	lastTick  time.Time
	nextID    int64
}

func (m *memHotelStore) ListCandidates(_ context.Context, _ int32, _ int64) ([]*HotelCandidate, error) {
	return m.rows, nil
}

func (m *memHotelStore) ReplaceCandidates(_ context.Context, _ int32, _ int64, rows []*HotelCandidate) error {
	m.rows = rows
	return nil
}

func (m *memHotelStore) DeleteCandidate(_ context.Context, _ int32, _ int64, candidateID int64) error {
	out := make([]*HotelCandidate, 0, len(m.rows))
	for _, r := range m.rows {
		if r.CandidateID != candidateID {
			out = append(out, r)
		}
	}
	m.rows = out
	return nil
}

func (m *memHotelStore) LastPoolTick(_ context.Context, _ int32, _ int64) (time.Time, error) {
	return m.lastTick, nil
}

func (m *memHotelStore) SetLastPoolTick(_ context.Context, _ int32, _ int64, at time.Time) error {
	m.lastTick = at
	return nil
}

func (m *memHotelStore) NextCandidateID(_ context.Context, _ int32, _ int64) (int64, error) {
	m.nextID++
	return m.nextID, nil
}

type stubHotelCity struct {
	hotelLevel  int32
	officeLevel int32
	gold        int64
	itemQty     int32
}

func (s *stubHotelCity) HotelLevel(context.Context, int32, int64) (int32, error) {
	return s.hotelLevel, nil
}

func (s *stubHotelCity) OfficeLevel(context.Context, int32, int64) (int32, error) {
	return s.officeLevel, nil
}

func (s *stubHotelCity) SpendGold(_ context.Context, _ PlayerRef, amount int64) error {
	if s.gold < amount {
		return ErrInsufficientGold
	}
	s.gold -= amount
	return nil
}

func (s *stubHotelCity) SpendItem(_ context.Context, _ PlayerRef, _ int32, qty int32) error {
	if s.itemQty < qty {
		return ErrInsufficientItem
	}
	s.itemQty -= qty
	return nil
}

func TestHasHeroCapacity(t *testing.T) {
	if !HasHeroCapacity(3, 2) || HasHeroCapacity(2, 2) || !HasHeroCapacity(1, 0) {
		t.Fatal("capacity gate mismatch legacy office>count")
	}
}

func TestRecruitHotelCandidateAndCapacityReject(t *testing.T) {
	ctx := context.Background()
	mem := &memHotelStore{}
	rng := rand.New(rand.NewSource(42))
	now := time.Unix(1_700_000_000, 0)
	cand := GenerateHotelCandidate(rng, 99, 3, 1, now)
	cand.GoldCost = 100
	mem.rows = []*HotelCandidate{cand}

	store := NewMemStore()
	svc := NewService()
	svc.Store = store
	svc.HotelStore = mem
	svc.RNG = rng
	svc.SetClock(func() time.Time { return now })

	city := stubHotelCity{hotelLevel: 3, officeLevel: 1, gold: 50_000}
	p := PlayerRef{ServerID: 1, PlayerID: 7}

	res, err := svc.RecruitHotelCandidate(ctx, p, CityRef{CityID: 99}, mem, &city, 1)
	if err != nil {
		t.Fatal(err)
	}
	if res.Hero.TemplateCfgID != TemplateCfgIDHotelRandom || res.Hero.DisplayName == "" {
		t.Fatalf("hero %+v", res.Hero)
	}
	if len(mem.rows) != 0 {
		t.Fatal("candidate should be removed")
	}

	_, err = svc.RecruitHotelCandidate(ctx, p, CityRef{CityID: 99}, mem, &city, 1)
	if err != ErrHotelCapacityFull {
		t.Fatalf("want capacity full, got %v", err)
	}
}
