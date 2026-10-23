package hero

import (
	"context"
	"sync"
)

// Store persists player hero instances (player_hero).
type Store interface {
	SaveHero(ctx context.Context, h *Hero) error
	GetHero(ctx context.Context, serverID int32, heroID int64) (*Hero, error)
	ListPlayerHeroes(ctx context.Context, serverID int32, playerID int64) ([]*Hero, error)
	MaxHeroID(ctx context.Context, serverID int32) (int64, error)
}

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

func (m *MemStore) ListPlayerHeroes(_ context.Context, sid int32, playerID int64) ([]*Hero, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*Hero
	for _, h := range m.heroes {
		if h.ServerID == sid && h.PlayerID == playerID {
			cp := *h
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (m *MemStore) MaxHeroID(_ context.Context, sid int32) (int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var max int64
	for _, h := range m.heroes {
		if h.ServerID == sid && h.HeroID > max {
			max = h.HeroID
		}
	}
	return max, nil
}
