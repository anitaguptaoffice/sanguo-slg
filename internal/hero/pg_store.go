package hero

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// PGStore persists heroes per spec/db/005_hero.sql.
type PGStore struct{ Pool *pgxpool.Pool }

// NewPGStore wraps a PostgreSQL pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{Pool: pool} }

func (p *PGStore) SaveHero(ctx context.Context, h *Hero) error {
	created := h.CreatedAt
	if created.IsZero() {
		created = time.Now()
	}
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO player_hero (
			server_id, hero_id, player_id, template_cfg_id, display_name, level, exp, loyalty,
			force, intel, politics, command, status, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (server_id, hero_id) DO UPDATE SET
			player_id = EXCLUDED.player_id,
			template_cfg_id = EXCLUDED.template_cfg_id,
			display_name = EXCLUDED.display_name,
			level = EXCLUDED.level,
			exp = EXCLUDED.exp,
			loyalty = EXCLUDED.loyalty,
			force = EXCLUDED.force,
			intel = EXCLUDED.intel,
			politics = EXCLUDED.politics,
			command = EXCLUDED.command,
			status = EXCLUDED.status
	`, h.ServerID, h.HeroID, h.PlayerID, h.TemplateCfgID, nullString(h.DisplayName), h.Level, h.Exp, h.Loyalty,
		h.Force, h.Intel, h.Politics, h.Command, h.Status, created)
	return err
}

func (p *PGStore) GetHero(ctx context.Context, serverID int32, heroID int64) (*Hero, error) {
	var h Hero
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, hero_id, player_id, template_cfg_id, COALESCE(display_name,''), level, exp, loyalty,
		       force, intel, politics, command, status, created_at
		FROM player_hero
		WHERE server_id = $1 AND hero_id = $2
	`, serverID, heroID).Scan(
		&h.ServerID, &h.HeroID, &h.PlayerID, &h.TemplateCfgID, &h.DisplayName, &h.Level, &h.Exp, &h.Loyalty,
		&h.Force, &h.Intel, &h.Politics, &h.Command, &h.Status, &h.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}

func (p *PGStore) ListPlayerHeroes(ctx context.Context, serverID int32, playerID int64) ([]*Hero, error) {
	rows, err := p.Pool.Query(ctx, `
		SELECT server_id, hero_id, player_id, template_cfg_id, COALESCE(display_name,''), level, exp, loyalty,
		       force, intel, politics, command, status, created_at
		FROM player_hero
		WHERE server_id = $1 AND player_id = $2
		ORDER BY hero_id
	`, serverID, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Hero
	for rows.Next() {
		var h Hero
		if err := rows.Scan(
			&h.ServerID, &h.HeroID, &h.PlayerID, &h.TemplateCfgID, &h.DisplayName, &h.Level, &h.Exp, &h.Loyalty,
			&h.Force, &h.Intel, &h.Politics, &h.Command, &h.Status, &h.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, &h)
	}
	return out, rows.Err()
}

func (p *PGStore) MaxHeroID(ctx context.Context, serverID int32) (int64, error) {
	var max int64
	err := p.Pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(hero_id), 0) FROM player_hero WHERE server_id = $1
	`, serverID).Scan(&max)
	return max, err
}
