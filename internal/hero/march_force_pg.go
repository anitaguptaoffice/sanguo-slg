package hero

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// Kept outside Store so custom adapters retain their existing behavior.
type marchForceStore interface {
	marchForceForHero(context.Context, PlayerRef, int64, time.Time) (MarchForceView, error)
	restHero(context.Context, PlayerRef, int64, time.Time) (MarchForceView, error)
}

var _ marchForceStore = (*PGStore)(nil)

func (p *PGStore) marchForceForHero(ctx context.Context, actor PlayerRef, id int64, now time.Time) (MarchForceView, error) {
	return p.updateMarchForce(ctx, actor, id, now, false)
}

func (p *PGStore) restHero(ctx context.Context, actor PlayerRef, id int64, now time.Time) (MarchForceView, error) {
	return p.updateMarchForce(ctx, actor, id, now, true)
}

// updateMarchForce shares ClaimForMarch's hero-then-force lock order, including
// when no force row exists. The earlier Service hero snapshot is not authoritative.
func (p *PGStore) updateMarchForce(ctx context.Context, actor PlayerRef, id int64, now time.Time, rest bool) (MarchForceView, error) {
	// Pool-owned setup must finish before acquiring the transaction or hero lock.
	if err := p.ensureMarchForceTable(ctx); err != nil {
		return MarchForceView{}, err
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return MarchForceView{}, err
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
		return MarchForceView{}, ErrHeroNotFound
	}
	if err != nil {
		return MarchForceView{}, err
	}
	st := &MarchForceState{ServerID: actor.ServerID, HeroID: id}
	err = tx.QueryRow(ctx, `SELECT current_force, last_regen_at FROM hero_march_force
		WHERE server_id=$1 AND hero_id=$2 FOR UPDATE`, actor.ServerID, id).Scan(&st.Current, &st.LastRegenAt)
	if errors.Is(err, pgx.ErrNoRows) {
		st = nil
	} else if err != nil {
		return MarchForceView{}, err
	}
	max := MarchForceMax(h.Level)
	var updated MarchForceState
	if rest {
		// Preserve force-read errors ahead of the idle-status rejection.
		updated, err = RestMarchForceOnce(h, st, now)
		if err != nil {
			return MarchForceView{}, err
		}
	} else if st == nil {
		updated = MarchForceState{ServerID: actor.ServerID, HeroID: id, Current: max, LastRegenAt: now}
	} else {
		ApplyMarchForceRegen(st, max, h.Status, now)
		updated = *st
	}
	_, err = tx.Exec(ctx, `INSERT INTO hero_march_force (server_id, hero_id, current_force, last_regen_at)
		VALUES ($1,$2,$3,$4) ON CONFLICT (server_id, hero_id) DO UPDATE SET
		current_force=EXCLUDED.current_force, last_regen_at=EXCLUDED.last_regen_at`,
		actor.ServerID, id, updated.Current, updated.LastRegenAt)
	if err != nil {
		return MarchForceView{}, err
	}
	// Do not retry or fall back after an error, including an uncertain commit.
	if err := tx.Commit(ctx); err != nil {
		return MarchForceView{}, err
	}
	return MarchForceView{Current: updated.Current, Max: max}, nil
}
