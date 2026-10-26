package world

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

var (
	ErrInvalidCityOwnership     = errors.New("world: invalid city ownership request")
	ErrCityNotOwned             = errors.New("world: city not owned")
	ErrCityOwnershipUnavailable = errors.New("world: transactional city ownership unavailable")
)

// CityOwnerLockerInTx is an optional durable Store capability. The caller must
// already hold the actor and wallet locks and must end the transaction on error.
type CityOwnerLockerInTx interface {
	LockCityOwnerInTx(context.Context, pgx.Tx, int32, int64, int64) error
}

// LockCityOwnerInTx delegates without touching Loader or the world cache.
func (svc *Service) LockCityOwnerInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID, playerID int64) error {
	if svc == nil {
		return ErrCityOwnershipUnavailable
	}
	store, ok := svc.Store.(CityOwnerLockerInTx)
	if !ok {
		return ErrCityOwnershipUnavailable
	}
	return store.LockCityOwnerInTx(ctx, tx, serverID, cityID, playerID)
}

// LockCityOwnerInTx verifies authoritative ownership and retains the row lock
// until the caller commits or rolls back. FOR UPDATE also blocks ordinary owner
// changes (FOR KEY SHARE would not). Only the supplied transaction is used;
// this participant never mutates rows or owns transaction lifecycle.
func (p *PGStore) LockCityOwnerInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID, playerID int64) error {
	if p == nil {
		return ErrCityOwnershipUnavailable
	}
	if tx == nil || serverID <= 0 || cityID <= 0 || playerID <= 0 {
		return ErrInvalidCityOwnership
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	var owner int64
	err := tx.QueryRow(ctx, `SELECT player_id FROM player_city WHERE server_id=$1 AND city_id=$2 FOR UPDATE`, serverID, cityID).Scan(&owner)
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && owner != playerID) {
		return ErrCityNotOwned
	}
	if err != nil {
		return ErrCityOwnershipUnavailable
	}
	return nil
}
