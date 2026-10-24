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

// heroLargessScheduleDDL extends player_hero until contract adds hero_largess_schedule.
const heroLargessScheduleDDL = `
CREATE TABLE IF NOT EXISTS hero_largess_schedule (
    server_id       INT          NOT NULL,
    hero_id         BIGINT       NOT NULL,
    last_largess_at TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (server_id, hero_id)
);
COMMENT ON TABLE hero_largess_schedule IS '将领赏赐冷却；对齐 legacy mem_hero_schedule.last_largess';
`

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

func (p *PGStore) SaveAssignment(ctx context.Context, a *Assignment) error {
	at := a.AssignedAt
	if at.IsZero() {
		at = time.Now()
	}
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO hero_assignment (server_id, hero_id, assign_type, target_id, assigned_at)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (server_id, hero_id) DO UPDATE SET
			assign_type = EXCLUDED.assign_type,
			target_id = EXCLUDED.target_id,
			assigned_at = EXCLUDED.assigned_at
	`, a.ServerID, a.HeroID, a.AssignType, a.TargetID, at)
	return err
}

func (p *PGStore) DeleteAssignmentByHero(ctx context.Context, serverID int32, heroID int64) error {
	_, err := p.Pool.Exec(ctx, `
		DELETE FROM hero_assignment WHERE server_id = $1 AND hero_id = $2
	`, serverID, heroID)
	return err
}

func (p *PGStore) FindCityChief(ctx context.Context, serverID int32, cityID int64) (*Assignment, error) {
	var a Assignment
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, hero_id, assign_type, target_id, assigned_at
		FROM hero_assignment
		WHERE server_id = $1 AND assign_type = $2 AND target_id = $3
		LIMIT 1
	`, serverID, AssignTypeCity, cityID).Scan(
		&a.ServerID, &a.HeroID, &a.AssignType, &a.TargetID, &a.AssignedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (p *PGStore) GetAssignmentByHero(ctx context.Context, serverID int32, heroID int64) (*Assignment, error) {
	var a Assignment
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, hero_id, assign_type, target_id, assigned_at
		FROM hero_assignment
		WHERE server_id = $1 AND hero_id = $2
	`, serverID, heroID).Scan(
		&a.ServerID, &a.HeroID, &a.AssignType, &a.TargetID, &a.AssignedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (p *PGStore) ensureLargessTable(ctx context.Context) error {
	_, err := p.Pool.Exec(ctx, heroLargessScheduleDDL)
	return err
}

func (p *PGStore) LastLargessAt(ctx context.Context, serverID int32, heroID int64) (time.Time, error) {
	if err := p.ensureLargessTable(ctx); err != nil {
		return time.Time{}, err
	}
	var at time.Time
	err := p.Pool.QueryRow(ctx, `
		SELECT last_largess_at FROM hero_largess_schedule
		WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	).Scan(&at)
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, err
	}
	return at, nil
}

func (p *PGStore) SetLastLargessAt(ctx context.Context, serverID int32, heroID int64, at time.Time) error {
	if err := p.ensureLargessTable(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO hero_largess_schedule (server_id, hero_id, last_largess_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (server_id, hero_id) DO UPDATE SET last_largess_at = EXCLUDED.last_largess_at`,
		serverID, heroID, at,
	)
	return err
}
