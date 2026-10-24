package hero

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const playerHeroLionizeDDL = `
CREATE TABLE IF NOT EXISTS player_hero_lionize (
    server_id         INT          NOT NULL,
    player_id         BIGINT       NOT NULL,
    npc_cfg_id        INT          NOT NULL,
    friend            INT          NOT NULL DEFAULT 0,
    state             SMALLINT     NOT NULL DEFAULT 0,
    last_persuade_at  TIMESTAMPTZ,
    PRIMARY KEY (server_id, player_id, npc_cfg_id)
);
COMMENT ON TABLE player_hero_lionize IS '名将结交/游说；对齐 legacy sys_lionize (uid,npcid,friend,state)';
`

// LionizeRecord is per-player progress toward a famous NPC.
type LionizeRecord struct {
	Friend         int32
	State          int16
	LastPersuadeAt time.Time
}

// LionizeStore persists persuade/lionize progress.
type LionizeStore interface {
	Get(ctx context.Context, serverID int32, playerID int64, npcCfgID int32) (*LionizeRecord, error)
	Put(ctx context.Context, serverID int32, playerID int64, npcCfgID int32, rec LionizeRecord) error
	List(ctx context.Context, serverID int32, playerID int64) (map[int32]LionizeRecord, error)
}

// MemLionizeStore is an in-memory lionize store.
type MemLionizeStore struct {
	mu   sync.RWMutex
	rows map[string]LionizeRecord
}

func NewMemLionizeStore() *MemLionizeStore {
	return &MemLionizeStore{rows: map[string]LionizeRecord{}}
}

func (m *MemLionizeStore) key(serverID int32, playerID int64, npcCfgID int32) string {
	return fmt.Sprintf("%d:%d:%d", serverID, playerID, npcCfgID)
}

func (m *MemLionizeStore) Get(_ context.Context, serverID int32, playerID int64, npcCfgID int32) (*LionizeRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rec, ok := m.rows[m.key(serverID, playerID, npcCfgID)]
	if !ok {
		return nil, nil
	}
	cp := rec
	return &cp, nil
}

func (m *MemLionizeStore) Put(_ context.Context, serverID int32, playerID int64, npcCfgID int32, rec LionizeRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rows[m.key(serverID, playerID, npcCfgID)] = rec
	return nil
}

func (m *MemLionizeStore) List(_ context.Context, serverID int32, playerID int64) (map[int32]LionizeRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := map[int32]LionizeRecord{}
	prefix := fmt.Sprintf("%d:%d:", serverID, playerID)
	for k, rec := range m.rows {
		if len(k) > len(prefix) && k[:len(prefix)] == prefix {
			var npcID int32
			if _, err := fmt.Sscanf(k[len(prefix):], "%d", &npcID); err == nil {
				out[npcID] = rec
			}
		}
	}
	return out, nil
}

// PGLionizeStore persists lionize rows in PostgreSQL.
type PGLionizeStore struct{ Pool *pgxpool.Pool }

func NewPGLionizeStore(pool *pgxpool.Pool) *PGLionizeStore { return &PGLionizeStore{Pool: pool} }

func (p *PGLionizeStore) ensure(ctx context.Context) error {
	_, err := p.Pool.Exec(ctx, playerHeroLionizeDDL)
	return err
}

func (p *PGLionizeStore) Get(ctx context.Context, serverID int32, playerID int64, npcCfgID int32) (*LionizeRecord, error) {
	if err := p.ensure(ctx); err != nil {
		return nil, err
	}
	var rec LionizeRecord
	var last *time.Time
	err := p.Pool.QueryRow(ctx, `
		SELECT friend, state, last_persuade_at
		FROM player_hero_lionize
		WHERE server_id = $1 AND player_id = $2 AND npc_cfg_id = $3`,
		serverID, playerID, npcCfgID,
	).Scan(&rec.Friend, &rec.State, &last)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if last != nil {
		rec.LastPersuadeAt = *last
	}
	return &rec, nil
}

func (p *PGLionizeStore) Put(ctx context.Context, serverID int32, playerID int64, npcCfgID int32, rec LionizeRecord) error {
	if err := p.ensure(ctx); err != nil {
		return err
	}
	var last interface{}
	if !rec.LastPersuadeAt.IsZero() {
		last = rec.LastPersuadeAt
	}
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO player_hero_lionize (server_id, player_id, npc_cfg_id, friend, state, last_persuade_at)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (server_id, player_id, npc_cfg_id) DO UPDATE SET
			friend = EXCLUDED.friend,
			state = EXCLUDED.state,
			last_persuade_at = EXCLUDED.last_persuade_at`,
		serverID, playerID, npcCfgID, rec.Friend, rec.State, last,
	)
	return err
}

func (p *PGLionizeStore) List(ctx context.Context, serverID int32, playerID int64) (map[int32]LionizeRecord, error) {
	if err := p.ensure(ctx); err != nil {
		return nil, err
	}
	rows, err := p.Pool.Query(ctx, `
		SELECT npc_cfg_id, friend, state, last_persuade_at
		FROM player_hero_lionize
		WHERE server_id = $1 AND player_id = $2`,
		serverID, playerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int32]LionizeRecord{}
	for rows.Next() {
		var npcID int32
		var rec LionizeRecord
		var last *time.Time
		if err := rows.Scan(&npcID, &rec.Friend, &rec.State, &last); err != nil {
			return nil, err
		}
		if last != nil {
			rec.LastPersuadeAt = *last
		}
		out[npcID] = rec
	}
	return out, rows.Err()
}
