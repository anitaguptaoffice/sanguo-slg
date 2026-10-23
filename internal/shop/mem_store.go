package shop

import (
	"context"
	"sync"
	"time"
)

type playerCounter struct {
	totalBought, dailyBought int32
	dailyPeriod              time.Time
}

// MemStore is an in-memory Store for unit tests.
type MemStore struct {
	mu       sync.Mutex
	stock    map[stockKey]int32
	counters map[counterKey]*playerCounter
}

type stockKey struct {
	serverID int32
	offerID  int32
}
type counterKey struct {
	serverID int32
	playerID int64
	offerID  int32
}

// NewMemStore creates an empty shop limit store (tests only).
func NewMemStore() *MemStore {
	return &MemStore{stock: make(map[stockKey]int32), counters: make(map[counterKey]*playerCounter)}
}

func (s *MemStore) StockRemaining(_ context.Context, serverID, offerID, total int32) (int32, error) {
	if total < 0 {
		return -1, nil
	}
	s.mu.Lock()
	k := stockKey{serverID, offerID}
	if _, ok := s.stock[k]; !ok {
		s.stock[k] = total
	}
	rem := s.stock[k]
	s.mu.Unlock()
	return rem, nil
}

func (s *MemStore) TakeStock(_ context.Context, serverID int32, _ int64, offerID, total, qty int32) error {
	if total < 0 {
		return nil
	}
	s.mu.Lock()
	k := stockKey{serverID, offerID}
	if _, ok := s.stock[k]; !ok {
		s.stock[k] = total
	}
	if s.stock[k] < qty {
		s.mu.Unlock()
		return ErrSoldOut
	}
	s.stock[k] -= qty
	s.mu.Unlock()
	return nil
}

func (s *MemStore) BumpCounter(_ context.Context, serverID int32, playerID int64, offerID, qty int32, limit PurchaseLimitType, now time.Time) error {
	s.mu.Lock()
	pc := s.counterLocked(serverID, playerID, offerID, now)
	pc.totalBought += qty
	if limit == PurchaseLimitDaily {
		pc.dailyBought += qty
	}
	s.mu.Unlock()
	return nil
}

func (s *MemStore) PurchasedCount(_ context.Context, serverID int32, playerID int64, offerID int32, limit PurchaseLimitType, now time.Time) (int32, error) {
	s.mu.Lock()
	pc := s.counterLocked(serverID, playerID, offerID, now)
	var n int32
	switch limit {
	case PurchaseLimitDaily:
		n = pc.dailyBought
	case PurchaseLimitLifetime:
		n = pc.totalBought
	}
	s.mu.Unlock()
	return n, nil
}

func (s *MemStore) counterLocked(serverID int32, playerID int64, offerID int32, now time.Time) *playerCounter {
	k := counterKey{serverID, playerID, offerID}
	pc, ok := s.counters[k]
	if !ok {
		pc = &playerCounter{dailyPeriod: startOfDay(now)}
		s.counters[k] = pc
	}
	day := startOfDay(now)
	if !pc.dailyPeriod.Equal(day) {
		pc.dailyPeriod = day
		pc.dailyBought = 0
	}
	return pc
}

func startOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}
