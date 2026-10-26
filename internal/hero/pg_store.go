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
const heroPointAddColumnsDDL = `
ALTER TABLE player_hero ADD COLUMN IF NOT EXISTS force_add INT NOT NULL DEFAULT 0;
ALTER TABLE player_hero ADD COLUMN IF NOT EXISTS intel_add INT NOT NULL DEFAULT 0;
ALTER TABLE player_hero ADD COLUMN IF NOT EXISTS politics_add INT NOT NULL DEFAULT 0;
`

const heroLargessScheduleDDL = `
CREATE TABLE IF NOT EXISTS hero_largess_schedule (
    server_id       INT          NOT NULL,
    hero_id         BIGINT       NOT NULL,
    last_largess_at TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (server_id, hero_id)
);
COMMENT ON TABLE hero_largess_schedule IS '将领赏赐冷却；对齐 legacy mem_hero_schedule.last_largess';
`

const heroMarchForceDDL = `
CREATE TABLE IF NOT EXISTS hero_march_force (
    server_id       INT          NOT NULL,
    hero_id         BIGINT       NOT NULL,
    current_force   INT          NOT NULL,
    last_regen_at   TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (server_id, hero_id)
);
COMMENT ON TABLE hero_march_force IS '将领出征体力；对齐 legacy mem_hero_blood';
`

const heroExprSessionDDL = `
CREATE TABLE IF NOT EXISTS hero_expr_session (
    server_id   INT          NOT NULL,
    hero_id     BIGINT       NOT NULL,
    started_at  TIMESTAMPTZ  NOT NULL,
    ends_at     TIMESTAMPTZ  NOT NULL,
    hours       INT          NOT NULL,
    PRIMARY KEY (server_id, hero_id)
);
COMMENT ON TABLE hero_expr_session IS '将领历练进行中；对齐 legacy sys_hero_expr';
`

// PGStore persists heroes per spec/db/005_hero.sql.
type PGStore struct{ Pool *pgxpool.Pool }

// NewPGStore wraps a PostgreSQL pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{Pool: pool} }

func (p *PGStore) ensurePointAddColumns(ctx context.Context) error {
	_, err := p.Pool.Exec(ctx, heroPointAddColumnsDDL)
	return err
}

// SaveHero updates only an existing identity; owner/status transitions remain supported.
func (p *PGStore) SaveHero(ctx context.Context, h *Hero) error {
	if h == nil {
		return ErrHeroNotFound
	}
	if err := p.ensurePointAddColumns(ctx); err != nil {
		return err
	}
	tag, err := p.Pool.Exec(ctx, `
		UPDATE player_hero SET player_id=$3, template_cfg_id=$4, display_name=$5,
			level=$6, exp=$7, loyalty=$8, force=$9, intel=$10, politics=$11, command=$12,
			force_add=$13, intel_add=$14, politics_add=$15, status=$16
		WHERE server_id=$1 AND hero_id=$2`,
		h.ServerID, h.HeroID, h.PlayerID, h.TemplateCfgID, nullString(h.DisplayName), h.Level, h.Exp, h.Loyalty,
		h.Force, h.Intel, h.Politics, h.Command, h.ForceAdd, h.IntelAdd, h.PoliticsAdd, h.Status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrHeroNotFound
	}
	return nil
}

func (p *PGStore) GetHero(ctx context.Context, serverID int32, heroID int64) (*Hero, error) {
	if err := p.ensurePointAddColumns(ctx); err != nil {
		return nil, err
	}
	var h Hero
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, hero_id, player_id, template_cfg_id, COALESCE(display_name,''), level, exp, loyalty,
		       force, intel, politics, command, force_add, intel_add, politics_add, status, created_at
		FROM player_hero
		WHERE server_id = $1 AND hero_id = $2
	`, serverID, heroID).Scan(
		&h.ServerID, &h.HeroID, &h.PlayerID, &h.TemplateCfgID, &h.DisplayName, &h.Level, &h.Exp, &h.Loyalty,
		&h.Force, &h.Intel, &h.Politics, &h.Command, &h.ForceAdd, &h.IntelAdd, &h.PoliticsAdd, &h.Status, &h.CreatedAt,
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
	if err := p.ensurePointAddColumns(ctx); err != nil {
		return nil, err
	}
	rows, err := p.Pool.Query(ctx, `
		SELECT server_id, hero_id, player_id, template_cfg_id, COALESCE(display_name,''), level, exp, loyalty,
		       force, intel, politics, command, force_add, intel_add, politics_add, status, created_at
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
			&h.Force, &h.Intel, &h.Politics, &h.Command, &h.ForceAdd, &h.IntelAdd, &h.PoliticsAdd, &h.Status, &h.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, &h)
	}
	return out, rows.Err()
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

func (p *PGStore) DeleteHero(ctx context.Context, serverID int32, heroID int64) error {
	_, err := p.Pool.Exec(ctx, `
		DELETE FROM hero_assignment WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	)
	if err != nil {
		return err
	}
	_, err = p.Pool.Exec(ctx, `
		DELETE FROM player_hero WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	)
	return err
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

func (p *PGStore) ensureExprTable(ctx context.Context) error {
	_, err := p.Pool.Exec(ctx, heroExprSessionDDL)
	return err
}

func (p *PGStore) GetExprSession(ctx context.Context, serverID int32, heroID int64) (*ExprSession, error) {
	if err := p.ensureExprTable(ctx); err != nil {
		return nil, err
	}
	var sess ExprSession
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, hero_id, started_at, ends_at, hours
		FROM hero_expr_session WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	).Scan(&sess.ServerID, &sess.HeroID, &sess.StartedAt, &sess.EndsAt, &sess.Hours)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

func (p *PGStore) SaveExprSession(ctx context.Context, sess ExprSession) error {
	if err := p.ensureExprTable(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO hero_expr_session (server_id, hero_id, started_at, ends_at, hours)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (server_id, hero_id) DO UPDATE SET
			started_at = EXCLUDED.started_at,
			ends_at = EXCLUDED.ends_at,
			hours = EXCLUDED.hours`,
		sess.ServerID, sess.HeroID, sess.StartedAt, sess.EndsAt, sess.Hours,
	)
	return err
}

func (p *PGStore) DeleteExprSession(ctx context.Context, serverID int32, heroID int64) error {
	if err := p.ensureExprTable(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		DELETE FROM hero_expr_session WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	)
	return err
}

func (p *PGStore) ensureMarchForceTable(ctx context.Context) error {
	_, err := p.Pool.Exec(ctx, heroMarchForceDDL)
	return err
}

func (p *PGStore) GetMarchForceState(ctx context.Context, serverID int32, heroID int64) (*MarchForceState, error) {
	if err := p.ensureMarchForceTable(ctx); err != nil {
		return nil, err
	}
	var st MarchForceState
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, hero_id, current_force, last_regen_at
		FROM hero_march_force WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	).Scan(&st.ServerID, &st.HeroID, &st.Current, &st.LastRegenAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (p *PGStore) SaveMarchForceState(ctx context.Context, st MarchForceState) error {
	if err := p.ensureMarchForceTable(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO hero_march_force (server_id, hero_id, current_force, last_regen_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (server_id, hero_id) DO UPDATE SET
			current_force = EXCLUDED.current_force,
			last_regen_at = EXCLUDED.last_regen_at`,
		st.ServerID, st.HeroID, st.Current, st.LastRegenAt,
	)
	return err
}

func (p *PGStore) DeleteMarchForceState(ctx context.Context, serverID int32, heroID int64) error {
	if err := p.ensureMarchForceTable(ctx); err != nil {
		return err
	}
	_, err := p.Pool.Exec(ctx, `
		DELETE FROM hero_march_force WHERE server_id = $1 AND hero_id = $2`,
		serverID, heroID,
	)
	return err
}
