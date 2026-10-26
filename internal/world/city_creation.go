package world

import (
	"context"
	"errors"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrInvalidCity               = errors.New("world: invalid new city")
	ErrCityOwnerMissing          = errors.New("world: city owner missing in shard")
	ErrCityIDConflict            = errors.New("world: city id conflict")
	ErrCityCreationTxUnsupported = errors.New("world: transactional city creation unavailable")
)

// CityCreatorInTx is the optional durable creation capability of a Store.
// Participants may use only the supplied transaction, never its lifecycle.
type CityCreatorInTx interface {
	CreateCityInTx(context.Context, pgx.Tx, City) (City, error)
}

// CreateCityInTx validates and stages a new world row; the caller owns commit.
// CityID must be zero. Do not publish the returned city until commit succeeds.
func (svc *Service) CreateCityInTx(ctx context.Context, tx pgx.Tx, request City) (City, error) {
	if svc == nil {
		return City{}, ErrCityCreationTxUnsupported
	}
	store, ok := svc.Store.(CityCreatorInTx)
	if !ok {
		return City{}, ErrCityCreationTxUnsupported
	}
	return store.CreateCityInTx(ctx, tx, request)
}

// "CITY" is a WORLD-specific namespace in PostgreSQL's two-int advisory space.
// The second key is server_id. All composed city creators use this lock before
// MAX+1 and retain it until the transaction owner commits or rolls back.
const cityCreationLockNamespace int32 = 0x43495459

// CreateCityInTx uses no Pool, Loader, or transaction lifecycle calls. The caller
// must acquire its Hub and wallet locks before entering this participant.
func (p *PGStore) CreateCityInTx(ctx context.Context, tx pgx.Tx, c City) (City, error) {
	if tx == nil || c.ServerID <= 0 || c.PlayerID <= 0 || c.CityID != 0 {
		return City{}, ErrInvalidCity
	}
	if c.X < 0 || c.Y < 0 || c.X >= MapSize || c.Y >= MapSize {
		return City{}, ErrOutOfBounds
	}
	if err := ctx.Err(); err != nil {
		return City{}, err
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer,$2::integer)`, cityCreationLockNamespace, c.ServerID); err != nil {
		return City{}, err
	}
	var owner int64
	err := tx.QueryRow(ctx, `SELECT player_id FROM player WHERE server_id=$1 AND player_id=$2 FOR SHARE`, c.ServerID, c.PlayerID).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return City{}, ErrCityOwnerMissing
	}
	if err != nil {
		return City{}, err
	}
	var cell Cell
	err = tx.QueryRow(ctx, `SELECT terrain,COALESCE(resource_type,0) FROM map_cell WHERE server_id=$1 AND x=$2 AND y=$3 FOR SHARE`, c.ServerID, c.X, c.Y).Scan(&cell.Terrain, &cell.ResourceType)
	if errors.Is(err, pgx.ErrNoRows) {
		return City{}, ErrBadTerrain
	}
	if err != nil {
		return City{}, err
	}
	if !cell.Buildable() {
		return City{}, ErrBadTerrain
	}
	var maxID int64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(city_id),0) FROM player_city WHERE server_id=$1`, c.ServerID).Scan(&maxID); err != nil {
		return City{}, err
	}
	if maxID < 0 || maxID == math.MaxInt64 {
		return City{}, ErrInvalidCity
	}
	c.CityID = maxID + 1
	_, err = tx.Exec(ctx, `INSERT INTO player_city
 (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		c.ServerID, c.CityID, c.PlayerID, c.Name, c.X, c.Y, c.IsCapital, c.WallLevel, c.Morale)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			switch pgErr.ConstraintName {
			case "player_city_server_id_x_y_key":
				return City{}, ErrOccupied
			case "player_city_pkey":
				return City{}, ErrCityIDConflict
			}
		}
		return City{}, err
	}
	return c, nil
}
