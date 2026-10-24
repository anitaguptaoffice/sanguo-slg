package hero

import (
	"context"
	"sync"
	"time"
)

// Store persists player hero instances (player_hero).
type Store interface {
	SaveHero(ctx context.Context, h *Hero) error
	GetHero(ctx context.Context, serverID int32, heroID int64) (*Hero, error)
	ListPlayerHeroes(ctx context.Context, serverID int32, playerID int64) ([]*Hero, error)
	MaxHeroID(ctx context.Context, serverID int32) (int64, error)
	SaveAssignment(ctx context.Context, a *Assignment) error
	DeleteAssignmentByHero(ctx context.Context, serverID int32, heroID int64) error
	FindCityChief(ctx context.Context, serverID int32, cityID int64) (*Assignment, error)
	GetAssignmentByHero(ctx context.Context, serverID int32, heroID int64) (*Assignment, error)
	LastLargessAt(ctx context.Context, serverID int32, heroID int64) (time.Time, error)
	SetLastLargessAt(ctx context.Context, serverID int32, heroID int64, at time.Time) error
	GetExprSession(ctx context.Context, serverID int32, heroID int64) (*ExprSession, error)
	SaveExprSession(ctx context.Context, sess ExprSession) error
	DeleteExprSession(ctx context.Context, serverID int32, heroID int64) error
	GetMarchForceState(ctx context.Context, serverID int32, heroID int64) (*MarchForceState, error)
	SaveMarchForceState(ctx context.Context, st MarchForceState) error
	DeleteMarchForceState(ctx context.Context, serverID int32, heroID int64) error
	DeleteHero(ctx context.Context, serverID int32, heroID int64) error
}

type MemStore struct {
	mu            sync.RWMutex
	heroes        map[int64]*Hero
	assignments   map[int64]*Assignment
	lastLargessAt map[int64]time.Time
	exprSessions  map[int64]ExprSession
	marchForce    map[int64]MarchForceState
}

func NewMemStore() *MemStore {
	return &MemStore{
		heroes:        map[int64]*Hero{},
		assignments:   map[int64]*Assignment{},
		lastLargessAt: map[int64]time.Time{},
		exprSessions:  map[int64]ExprSession{},
		marchForce:    map[int64]MarchForceState{},
	}
}

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

func (m *MemStore) SaveAssignment(_ context.Context, a *Assignment) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := *a
	m.assignments[a.HeroID] = &cp
	return nil
}

func (m *MemStore) DeleteAssignmentByHero(_ context.Context, serverID int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, ok := m.assignments[heroID]
	if ok && a.ServerID == serverID {
		delete(m.assignments, heroID)
	}
	return nil
}

func (m *MemStore) FindCityChief(_ context.Context, serverID int32, cityID int64) (*Assignment, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, a := range m.assignments {
		if a.ServerID == serverID && a.AssignType == AssignTypeCity && a.TargetID == cityID {
			cp := *a
			return &cp, nil
		}
	}
	return nil, nil
}

func (m *MemStore) GetAssignmentByHero(_ context.Context, serverID int32, heroID int64) (*Assignment, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	a, ok := m.assignments[heroID]
	if !ok || a.ServerID != serverID {
		return nil, nil
	}
	cp := *a
	return &cp, nil
}

func (m *MemStore) LastLargessAt(_ context.Context, sid int32, heroID int64) (time.Time, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	h, ok := m.heroes[heroID]
	if !ok || h.ServerID != sid {
		return time.Time{}, nil
	}
	return m.lastLargessAt[heroID], nil
}

func (m *MemStore) DeleteHero(_ context.Context, serverID int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	h, ok := m.heroes[heroID]
	if ok && h.ServerID == serverID {
		delete(m.heroes, heroID)
		delete(m.assignments, heroID)
		delete(m.lastLargessAt, heroID)
		delete(m.exprSessions, heroID)
		delete(m.marchForce, heroID)
	}
	return nil
}

func (m *MemStore) GetExprSession(_ context.Context, sid int32, heroID int64) (*ExprSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	sess, ok := m.exprSessions[heroID]
	if !ok || sess.ServerID != sid {
		return nil, nil
	}
	cp := sess
	return &cp, nil
}

func (m *MemStore) SaveExprSession(_ context.Context, sess ExprSession) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.exprSessions[sess.HeroID] = sess
	return nil
}

func (m *MemStore) DeleteExprSession(_ context.Context, sid int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	sess, ok := m.exprSessions[heroID]
	if ok && sess.ServerID == sid {
		delete(m.exprSessions, heroID)
	}
	return nil
}

func (m *MemStore) GetMarchForceState(_ context.Context, sid int32, heroID int64) (*MarchForceState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	st, ok := m.marchForce[heroID]
	if !ok || st.ServerID != sid {
		return nil, nil
	}
	cp := st
	return &cp, nil
}

func (m *MemStore) SaveMarchForceState(_ context.Context, st MarchForceState) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.marchForce[st.HeroID] = st
	return nil
}

func (m *MemStore) DeleteMarchForceState(_ context.Context, serverID int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	st, ok := m.marchForce[heroID]
	if ok && st.ServerID == serverID {
		delete(m.marchForce, heroID)
	}
	return nil
}

func (m *MemStore) SetLastLargessAt(_ context.Context, sid int32, heroID int64, at time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	h, ok := m.heroes[heroID]
	if !ok || h.ServerID != sid {
		return ErrHeroNotFound
	}
	m.lastLargessAt[heroID] = at
	return nil
}
