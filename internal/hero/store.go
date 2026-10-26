package hero

import (
	"context"
	"math"
	"sync"
	"time"
)

// Store persists player hero instances (player_hero).
type Store interface {
	// CreateHero assigns a store-generated identity; h.HeroID must be zero.
	CreateHero(ctx context.Context, h *Hero) error
	SaveHero(ctx context.Context, h *Hero) error
	GetHero(ctx context.Context, serverID int32, heroID int64) (*Hero, error)
	ListPlayerHeroes(ctx context.Context, serverID int32, playerID int64) ([]*Hero, error)
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

type heroKey struct {
	serverID int32
	heroID   int64
}

type MemStore struct {
	nextHeroID    int64
	mu            sync.RWMutex
	heroes        map[heroKey]*Hero
	assignments   map[heroKey]*Assignment
	lastLargessAt map[heroKey]time.Time
	exprSessions  map[heroKey]ExprSession
	marchForce    map[heroKey]MarchForceState
}

func NewMemStore() *MemStore {
	return &MemStore{
		heroes:        map[heroKey]*Hero{},
		assignments:   map[heroKey]*Assignment{},
		lastLargessAt: map[heroKey]time.Time{},
		exprSessions:  map[heroKey]ExprSession{},
		marchForce:    map[heroKey]MarchForceState{},
	}
}

// CreateHero allocates under the same lock as insertion. Deleted IDs are not reused.
func (m *MemStore) CreateHero(_ context.Context, h *Hero) error {
	if err := validateHeroCreation(h); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.nextHeroID == math.MaxInt64 {
		return ErrHeroIdentity
	}
	m.nextHeroID++
	key := heroKey{h.ServerID, m.nextHeroID}
	if _, exists := m.heroes[key]; exists {
		return ErrHeroIdentity
	}
	cp := *h
	cp.HeroID = m.nextHeroID
	if cp.CreatedAt.IsZero() {
		cp.CreatedAt = time.Now()
	}
	m.heroes[key] = &cp
	h.HeroID, h.CreatedAt = cp.HeroID, cp.CreatedAt
	return nil
}

// SaveHero updates an existing shard-scoped identity, including legitimate owner transfers.
func (m *MemStore) SaveHero(_ context.Context, h *Hero) error {
	if h == nil {
		return ErrHeroNotFound
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := heroKey{h.ServerID, h.HeroID}
	existing, ok := m.heroes[key]
	if !ok {
		return ErrHeroNotFound
	}
	cp := *h
	cp.CreatedAt = existing.CreatedAt
	m.heroes[key] = &cp
	return nil
}

func (m *MemStore) GetHero(_ context.Context, sid int32, id int64) (*Hero, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	h, ok := m.heroes[heroKey{sid, id}]
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

func (m *MemStore) SaveAssignment(_ context.Context, a *Assignment) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := *a
	m.assignments[heroKey{a.ServerID, a.HeroID}] = &cp
	return nil
}

func (m *MemStore) DeleteAssignmentByHero(_ context.Context, serverID int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, ok := m.assignments[heroKey{serverID, heroID}]
	if ok && a.ServerID == serverID {
		delete(m.assignments, heroKey{serverID, heroID})
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
	a, ok := m.assignments[heroKey{serverID, heroID}]
	if !ok || a.ServerID != serverID {
		return nil, nil
	}
	cp := *a
	return &cp, nil
}

func (m *MemStore) LastLargessAt(_ context.Context, sid int32, heroID int64) (time.Time, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	h, ok := m.heroes[heroKey{sid, heroID}]
	if !ok || h.ServerID != sid {
		return time.Time{}, nil
	}
	return m.lastLargessAt[heroKey{sid, heroID}], nil
}

func (m *MemStore) DeleteHero(_ context.Context, serverID int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	h, ok := m.heroes[heroKey{serverID, heroID}]
	if ok && h.ServerID == serverID {
		delete(m.heroes, heroKey{serverID, heroID})
		delete(m.assignments, heroKey{serverID, heroID})
		delete(m.lastLargessAt, heroKey{serverID, heroID})
		delete(m.exprSessions, heroKey{serverID, heroID})
		delete(m.marchForce, heroKey{serverID, heroID})
	}
	return nil
}

func (m *MemStore) GetExprSession(_ context.Context, sid int32, heroID int64) (*ExprSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	sess, ok := m.exprSessions[heroKey{sid, heroID}]
	if !ok || sess.ServerID != sid {
		return nil, nil
	}
	cp := sess
	return &cp, nil
}

func (m *MemStore) SaveExprSession(_ context.Context, sess ExprSession) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.exprSessions[heroKey{sess.ServerID, sess.HeroID}] = sess
	return nil
}

func (m *MemStore) DeleteExprSession(_ context.Context, sid int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	sess, ok := m.exprSessions[heroKey{sid, heroID}]
	if ok && sess.ServerID == sid {
		delete(m.exprSessions, heroKey{sid, heroID})
	}
	return nil
}

func (m *MemStore) GetMarchForceState(_ context.Context, sid int32, heroID int64) (*MarchForceState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	st, ok := m.marchForce[heroKey{sid, heroID}]
	if !ok || st.ServerID != sid {
		return nil, nil
	}
	cp := st
	return &cp, nil
}

func (m *MemStore) SaveMarchForceState(_ context.Context, st MarchForceState) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.marchForce[heroKey{st.ServerID, st.HeroID}] = st
	return nil
}

func (m *MemStore) DeleteMarchForceState(_ context.Context, serverID int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	st, ok := m.marchForce[heroKey{serverID, heroID}]
	if ok && st.ServerID == serverID {
		delete(m.marchForce, heroKey{serverID, heroID})
	}
	return nil
}

func (m *MemStore) SetLastLargessAt(_ context.Context, sid int32, heroID int64, at time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	h, ok := m.heroes[heroKey{sid, heroID}]
	if !ok || h.ServerID != sid {
		return ErrHeroNotFound
	}
	m.lastLargessAt[heroKey{sid, heroID}] = at
	return nil
}
