package hero

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

var ErrFamilyTransactionRequired = errors.New("hero: family transaction coordinator required")

func familyTxScope(tx pgx.Tx, p PlayerRef) error {
	if tx == nil {
		return ErrFamilyTransactionRequired
	}
	if p.ServerID <= 0 || p.PlayerID <= 0 {
		return ErrInvalidFamilyState
	}
	return nil
}

func familyStatusError(status int16) error {
	if status == StatusComing {
		return ErrHeroNotComing
	}
	return ErrHeroNotCaptive
}

func familyTxHero(tx pgx.Tx, p PlayerRef, heroID int64, status int16) error {
	if err := familyTxScope(tx, p); err != nil {
		return err
	}
	if heroID <= 0 || (status != StatusComing && status != StatusCaptive) {
		return ErrInvalidFamilyState
	}
	return nil
}

// SetFamilyHeroIdleInTx changes only status/loyalty on the same identity. It
// neither rewrites optional added points nor calls legacy SaveHero/runtime DDL.
// API must consume metadata and debit assets in this same tx, rollback on error.
func (p *PGStore) SetFamilyHeroIdleInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, from int16, loyalty int) error {
	if err := familyTxHero(tx, actor, heroID, from); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE player_hero SET status=$5, loyalty=$6
		WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 AND status=$4`,
		actor.ServerID, actor.PlayerID, heroID, from, StatusIdle, loyalty)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return familyStatusError(from)
	}
	return nil
}

// DeleteFamilyHeroInTx only removes a still-coming/captive owned identity and
// its legacy assignment row. It never removes metadata implicitly. Lock/recheck
// before assignment deletion ensures an already-accepted hero is untouched.
func (p *PGStore) DeleteFamilyHeroInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, from int16) error {
	if err := familyTxHero(tx, actor, heroID, from); err != nil {
		return err
	}
	var id int64
	err := tx.QueryRow(ctx, `SELECT hero_id FROM player_hero
		WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 AND status=$4 FOR UPDATE`,
		actor.ServerID, actor.PlayerID, heroID, from).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return familyStatusError(from)
	}
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM hero_assignment WHERE server_id=$1 AND hero_id=$2`, actor.ServerID, id); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM player_hero WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 AND status=$4`,
		actor.ServerID, actor.PlayerID, id, from)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return familyStatusError(from)
	}
	return nil
}
