package shop

import (
	"sync"
	"time"
)

type playerCounter struct {
	totalBought, dailyBought int32
	dailyPeriod              time.Time
}

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

func NewMemStore() *MemStore {
	return &MemStore{stock: make(map[stockKey]int32), counters: make(map[counterKey]*playerCounter)}
}

func (s *MemStore) stockRemaining(serverID, offerID, total int32) int32 {
	if total < 0 {
		return -1
	}
	s.mu.Lock()
	k := stockKey{serverID, offerID}
	if _, ok := s.stock[k]; !ok {
		s.stock[k] = total
	}
	rem := s.stock[k]
	s.mu.Unlock()
	return rem
}

func (s *MemStore) takeStock(serverID, offerID, total, qty int32) error {
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

func (s *MemStore) bumpCounter(serverID int32, playerID int64, offerID, qty int32, limit PurchaseLimitType, now time.Time) {
	s.mu.Lock()
	pc := s.counterLocked(serverID, playerID, offerID, now)
	pc.totalBought += qty
	if limit == PurchaseLimitDaily {
		pc.dailyBought += qty
	}
	s.mu.Unlock()
}

func (s *MemStore) purchasedCount(serverID int32, playerID int64, offerID int32, limit PurchaseLimitType, now time.Time) int32 {
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
	return n
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
