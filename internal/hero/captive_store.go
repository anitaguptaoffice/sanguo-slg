package hero

import (
	"context"
	"errors"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const playerHeroCaptiveDDL = `
CREATE TABLE IF NOT EXISTS player_hero_captive (
    server_id           INT          NOT NULL,
    hero_id             BIGINT       NOT NULL,
    city_id             BIGINT       NOT NULL,
    summon_item_cfg_id  INT          NOT NULL DEFAULT 0,
    summon_item_qty     INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (server_id, hero_id)
);
COMMENT ON TABLE player_hero_captive IS '俘虏元数据；对齐 legacy sys_hero_captive + mem_hero_summon';
`

// MemCaptiveStore is an in-memory captive metadata store.
type MemCaptiveStore struct {
	mu   sync.RWMutex
	rows map[heroKey]CaptiveRecord
}

func NewMemCaptiveStore() *MemCaptiveStore {
	return &MemCaptiveStore{rows: map[heroKey]CaptiveRecord{}}
}

func (m *MemCaptiveStore) PutCaptive(_ context.Context, serverID int32, heroID int64, rec CaptiveRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rows[heroKey{serverID, heroID}] = rec
	return nil
}

func (m *MemCaptiveStore) GetCaptive(_ context.Context, serverID int32, heroID int64) (*CaptiveRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rec, ok := m.rows[heroKey{serverID, heroID}]
	if !ok {
		return nil, nil
	}
	cp := rec
	return &cp, nil
}

func (m *MemCaptiveStore) DeleteCaptive(_ context.Context, serverID int32, heroID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rows, heroKey{serverID, heroID})
	return nil
}

// PGCaptiveStore persists captive metadata in PostgreSQL.
type PGCaptiveStore struct{ Pool *pgxpool.Pool }

func NewPGCaptiveStore(pool *pgxpool.Pool) *PGCaptiveStore { return &PGCaptiveStore{Pool: pool} }

func (p *PGCaptiveStore) ensure(ctx context.Context) error {
	_, err := p.Pool.Exec(ctx, playerHeroCaptiveDDL)
	return err
}

func (p *PGCaptiveStore) PutCaptive(ctx context.Context, serverID int32, heroID int64, rec CaptiveRecord) error {
	if err := p.ensure(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO player_hero_captive (server_id, hero_id, city_id, summon_item_cfg_id, summon_item_qty)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (server_id, hero_id) DO UPDATE SET
			city_id = EXCLUDED.city_id,
			summon_item_cfg_id = EXCLUDED.summon_item_cfg_id,
			summon_item_qty = EXCLUDED.summon_item_qty`,
		serverID, heroID, rec.CityID, rec.SummonItemCfgID, rec.SummonItemQty,
	)
	return err
}

func (p *PGCaptiveStore) GetCaptive(ctx context.Context, serverID int32, heroID int64) (*CaptiveRecord, error) {
	if err := p.ensure(ctx); err != nil {
		return nil, err
	}
	var rec CaptiveRecord
	err := p.Pool.QueryRow(ctx, `
		SELECT city_id, summon_item_cfg_id, summon_item_qty
		FROM player_hero_captive
		WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	).Scan(&rec.CityID, &rec.SummonItemCfgID, &rec.SummonItemQty)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (p *PGCaptiveStore) DeleteCaptive(ctx context.Context, serverID int32, heroID int64) error {
	if err := p.ensure(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		DELETE FROM player_hero_captive WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	)
	return err
}
