package hero

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

func lionizeTxScope(tx pgx.Tx, actor PlayerRef, npcCfgID int32) error {
	if err := familyTxScope(tx, actor); err != nil {
		return err
	}
	if npcCfgID <= 0 {
		return ErrInvalidFamilyState
	}
	return nil
}

// GetLionizeInTx's unlocked mode is only for actor-wallet-protected planning;
// final execution re-reads with lock=true after item and ordered hero locks.
// An absent progress row is serialized by the caller's wallet, not this query.
func (p *PGLionizeStore) GetLionizeInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, npcCfgID int32, lock bool) (*LionizeRecord, error) {
	if err := lionizeTxScope(tx, actor, npcCfgID); err != nil {
		return nil, err
	}
	var rec LionizeRecord
	var last *time.Time
	err := tx.QueryRow(ctx, `SELECT m.friend,m.state,m.last_persuade_at FROM player_hero_lionize m
		WHERE m.server_id=$1 AND m.player_id=$2 AND m.npc_cfg_id=$3`+familyMetadataLock(lock),
		actor.ServerID, actor.PlayerID, npcCfgID).Scan(&rec.Friend, &rec.State, &last)
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

func nullableLionizeTime(at time.Time) any {
	if at.IsZero() {
		return nil
	}
	return at
}

// CompareAndSwapLionizeInTx only permits existing nonterminal transitions.
// nil expected means insert-only initial befriend, never an UPSERT. Exact prior
// friend/state/timestamp are compared; a stale writer cannot erase recruited.
// Caller uses the final locked row, plans/debits assets and creates any hire hero
// in this SAME transaction; a failed comparison requires rollback, not retry.
func (p *PGLionizeStore) CompareAndSwapLionizeInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, npcCfgID int32, expected *LionizeRecord, next LionizeRecord) error {
	if err := lionizeTxScope(tx, actor, npcCfgID); err != nil {
		return err
	}
	if expected == nil {
		if next.State != LionizeStateBefriended {
			return ErrInvalidFamilyState
		}
		tag, err := tx.Exec(ctx, `INSERT INTO player_hero_lionize(server_id,player_id,npc_cfg_id,friend,state,last_persuade_at)
			VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(server_id,player_id,npc_cfg_id) DO NOTHING`,
			actor.ServerID, actor.PlayerID, npcCfgID, next.Friend, next.State, nullableLionizeTime(next.LastPersuadeAt))
		return familyExactlyOne(tag, err, ErrInvalidFamilyState)
	}
	if expected.State == LionizeStateRecruited {
		return ErrLionizeAlreadyDone
	}
	if (expected.State != LionizeStateNone && expected.State != LionizeStateBefriended) ||
		(next.State != LionizeStateBefriended && !(expected.State == LionizeStateBefriended && next.State == LionizeStateRecruited)) {
		return ErrInvalidFamilyState
	}
	tag, err := tx.Exec(ctx, `UPDATE player_hero_lionize SET friend=$4,state=$5,last_persuade_at=$6
		WHERE server_id=$1 AND player_id=$2 AND npc_cfg_id=$3 AND friend=$7 AND state=$8
		AND last_persuade_at IS NOT DISTINCT FROM $9`, actor.ServerID, actor.PlayerID, npcCfgID,
		next.Friend, next.State, nullableLionizeTime(next.LastPersuadeAt), expected.Friend, expected.State, nullableLionizeTime(expected.LastPersuadeAt))
	return familyExactlyOne(tag, err, ErrInvalidFamilyState)
}

// ListLionizeInTx is a no-DDL actor-scoped read; it preserves all persisted NPC
// rows. PlanPersuadeTargets applies the existing four-target presentation roster.
func (p *PGLionizeStore) ListLionizeInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef) (map[int32]LionizeRecord, error) {
	if err := familyTxScope(tx, actor); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `SELECT npc_cfg_id,friend,state,last_persuade_at FROM player_hero_lionize
		WHERE server_id=$1 AND player_id=$2 ORDER BY npc_cfg_id`, actor.ServerID, actor.PlayerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int32]LionizeRecord{}
	for rows.Next() {
		var npc int32
		var rec LionizeRecord
		var last *time.Time
		if err := rows.Scan(&npc, &rec.Friend, &rec.State, &last); err != nil {
			return nil, err
		}
		if last != nil {
			rec.LastPersuadeAt = *last
		}
		out[npc] = rec
	}
	return out, rows.Err()
}
