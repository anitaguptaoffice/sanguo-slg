package hero

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// Kept outside Store so existing custom adapters retain their own behavior.
type marchClaimStore interface {
	claimForMarch(context.Context, PlayerRef, int64, time.Time) error
}

// claimForMarch owns only the HERO status/force transaction, not MIL creation.
func (p *PGStore) claimForMarch(ctx context.Context, actor PlayerRef, id int64, now time.Time) error {
	// Service already checked eligibility. Never run pool-owned DDL while a
	// transaction holds the hero lock; recheck eligibility under that lock below.
	if err := p.ensureMarchForceTable(ctx); err != nil {
		return err
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	h := &Hero{ServerID: actor.ServerID, PlayerID: actor.PlayerID, HeroID: id}
	err = tx.QueryRow(ctx, `SELECT level, status FROM player_hero
		WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 FOR UPDATE`,
		actor.ServerID, actor.PlayerID, id).Scan(&h.Level, &h.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrHeroNotFound
	}
	if err != nil {
		return err
	}
	if err := MustClearOfficeBeforeMarch(h); err != nil {
		return err
	}
	if h.Status != StatusIdle {
		return ErrHeroNotIdle
	}
	st := &MarchForceState{ServerID: actor.ServerID, HeroID: id}
	err = tx.QueryRow(ctx, `SELECT current_force, last_regen_at FROM hero_march_force
		WHERE server_id=$1 AND hero_id=$2 FOR UPDATE`, actor.ServerID, id).Scan(&st.Current, &st.LastRegenAt)
	if errors.Is(err, pgx.ErrNoRows) {
		st = nil
	} else if err != nil {
		return err
	}
	updated, err := ConsumeMarchForceOnce(h, st, now)
	if err != nil {
		// Existing low-force rejection does not persist partial regeneration.
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO hero_march_force (server_id, hero_id, current_force, last_regen_at)
		VALUES ($1,$2,$3,$4) ON CONFLICT (server_id, hero_id) DO UPDATE SET
		current_force=EXCLUDED.current_force, last_regen_at=EXCLUDED.last_regen_at`,
		actor.ServerID, id, updated.Current, updated.LastRegenAt)
	if err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE player_hero SET status=$4
		WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 AND status=$5`,
		actor.ServerID, actor.PlayerID, id, StatusMarch, StatusIdle)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrHeroNotIdle
	}
	// An uncertain commit is returned unchanged; callers must not retry blindly.
	return tx.Commit(ctx)
}
