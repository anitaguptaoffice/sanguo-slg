package hero

import (
	"context"
	"errors"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const playerHeroComingDDL = `
CREATE TABLE IF NOT EXISTS player_hero_coming (
    server_id   INT    NOT NULL,
    hero_id     BIGINT NOT NULL,
    city_id     BIGINT NOT NULL,
    PRIMARY KEY (server_id, hero_id)
);
COMMENT ON TABLE player_hero_coming IS '来投元数据；对齐 legacy sys_city_hero.state=6 待接受队列';
`

// MemComingStore is an in-memory coming metadata store.
type MemComingStore struct {
	mu   sync.RWMutex
	rows map[heroKey]ComingRecord
}

func NewMemComingStore() *MemComingStore {
	return &MemComingStore{rows: map[heroKey]ComingRecord{}}
}

func (m *MemComingStore) PutComing(_ context.Context, serverID int32, heroID int64, rec ComingRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rows[heroKey{serverID, heroID}] = rec
	return nil
}

func (m *MemComingStore) GetComing(_ context.Context, serverID int32, heroID int64) (*ComingRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rec, ok := m.rows[heroKey{serverID, heroID}]
	if !ok {
		return nil, nil
	}
	cp := rec
	return &cp, nil
}

func (m *MemComingStore) DeleteComing(_ context.Context, serverID int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rows, heroKey{serverID, heroID})
	return nil
}

// PGComingStore persists coming metadata in PostgreSQL.
type PGComingStore struct{ Pool *pgxpool.Pool }

func NewPGComingStore(pool *pgxpool.Pool) *PGComingStore { return &PGComingStore{Pool: pool} }

func (p *PGComingStore) ensure(ctx context.Context) error {
	_, err := p.Pool.Exec(ctx, playerHeroComingDDL)
	return err
}

func (p *PGComingStore) PutComing(ctx context.Context, serverID int32, heroID int64, rec ComingRecord) error {
	if err := p.ensure(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO player_hero_coming (server_id, hero_id, city_id)
		VALUES ($1,$2,$3)
		ON CONFLICT (server_id, hero_id) DO UPDATE SET city_id = EXCLUDED.city_id`,
		serverID, heroID, rec.CityID,
	)
	return err
}

func (p *PGComingStore) GetComing(ctx context.Context, serverID int32, heroID int64) (*ComingRecord, error) {
	if err := p.ensure(ctx); err != nil {
		return nil, err
	}
	var rec ComingRecord
	err := p.Pool.QueryRow(ctx, `
		SELECT city_id FROM player_hero_coming WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	).Scan(&rec.CityID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (p *PGComingStore) DeleteComing(ctx context.Context, serverID int32, heroID int64) error {
	if err := p.ensure(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		DELETE FROM player_hero_coming WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	)
	return err
}
