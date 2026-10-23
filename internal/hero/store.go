package hero

import (
	"context"
	"sync"
)

type MemStore struct {
	mu     sync.RWMutex
	heroes map[int64]*Hero
}

func NewMemStore() *MemStore { return &MemStore{heroes: map[int64]*Hero{}} }

func (m *MemStore) SaveHero(_ context.Context, h *Hero) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := *h
	m.heroes[h.HeroID] = &cp
	return nil
}

func (m *MemStore) GetHero(_ context.Context, sid int32, id int64) (*Hero, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	h, ok := m.heroes[id]
	if !ok || h.ServerID != sid {
		return nil, nil
	}
	cp := *h
	return &cp, nil
}
