package domestic

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrProductionCheckpointMissing = errors.New("domestic: production checkpoint missing; migration required")
	ErrProductionOwnerMismatch     = errors.New("domestic: production city owner mismatch")
	ErrCityAlreadyRegistered       = errors.New("domestic: city already has domestic state")
	ErrNewCityRegistrationRequired = errors.New("domestic: durable creation requires RegisterNewCity")
)

// Caller holds the wallet row lock. No path seeds from player_wallet.updated_at.
func loadProductionCheckpoint(ctx context.Context, tx pgx.Tx, sid int32, c *CityState, create bool, now time.Time) error {
	var owner int64
	err := tx.QueryRow(ctx, `SELECT c.player_id FROM player_city c
 JOIN player p ON p.server_id=c.server_id AND p.player_id=c.player_id
 WHERE c.server_id=$1 AND c.city_id=$2 FOR SHARE OF c,p`, sid, c.ID).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && owner != c.PlayerID) {
		return ErrProductionOwnerMismatch
	}
	if err != nil {
		return err
	}
	if create {
		var exists bool
		err = tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM city_building WHERE server_id=$1 AND city_id=$2
 UNION ALL SELECT 1 FROM work_queue WHERE server_id=$1 AND city_id=$2 AND queue_type=1)`, sid, c.ID).Scan(&exists)
		if err != nil {
			return err
		}
		if exists {
			return ErrCityAlreadyRegistered
		}
		tag, err := tx.Exec(ctx, `INSERT INTO city_production_checkpoint (server_id,city_id,player_id,settled_at,settled_submicro_ns)
 VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, sid, c.ID, c.PlayerID, now.Truncate(time.Microsecond), now.Nanosecond()%1000)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return ErrCityAlreadyRegistered
		}
	}
	var submicro int16
	r := &c.productionRemainder
	err = tx.QueryRow(ctx, `SELECT player_id,settled_at,settled_submicro_ns,food_remainder,wood_remainder,stone_remainder,iron_remainder
 FROM city_production_checkpoint WHERE server_id=$1 AND city_id=$2 FOR UPDATE`, sid, c.ID).
		Scan(&owner, &c.LastSettleAt, &submicro, &r[0], &r[1], &r[2], &r[3])
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrProductionCheckpointMissing
	}
	if err != nil {
		return err
	}
	if owner != c.PlayerID {
		return ErrProductionOwnerMismatch
	}
	c.LastSettleAt = c.LastSettleAt.Add(time.Duration(submicro))
	return nil
}

func saveProductionCheckpoint(ctx context.Context, tx pgx.Tx, sid int32, c *CityState) error {
	r, at := c.productionRemainder, c.LastSettleAt
	tag, err := tx.Exec(ctx, `UPDATE city_production_checkpoint SET settled_at=$4,settled_submicro_ns=$5,
 food_remainder=$6,wood_remainder=$7,stone_remainder=$8,iron_remainder=$9 WHERE server_id=$1 AND city_id=$2 AND player_id=$3`,
		sid, c.ID, c.PlayerID, at.Truncate(time.Microsecond), at.Nanosecond()%1000, r[0], r[1], r[2], r[3])
	if err == nil && tag.RowsAffected() != 1 {
		return ErrProductionCheckpointMissing
	}
	return err
}
