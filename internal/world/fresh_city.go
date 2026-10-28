package world

import (
	"context"
	"errors"
	"sync/atomic"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrFreshCityProof = errors.New("world: invalid fresh city proof")

type CityIdentity struct {
	ServerID int32
	CityID   int64
	PlayerID int64
}
type FreshCity struct{ s *freshCityState }
type freshCityState struct {
	access   recruittx.Access
	binding  *recruittx.Binding
	identity CityIdentity
	consumed atomic.Bool
}

// Consume attests one uncommitted WORLD insert, not auth/MIL/DOM/commit; aliases share consumption.
func (p FreshCity) Consume(ctx context.Context, a *recruittx.Access) (CityIdentity, error) {
	if p.s == nil || ctx == nil || a == nil || p.s.identity.ServerID <= 0 || p.s.identity.CityID <= 0 || p.s.identity.PlayerID <= 0 {
		return CityIdentity{}, ErrFreshCityProof
	}
	copyAccess := *a
	if err := p.s.access.CheckSameTransaction(ctx, p.s.binding, &copyAccess); err != nil {
		return CityIdentity{}, err
	}
	if !p.s.consumed.CompareAndSwap(false, true) {
		return CityIdentity{}, ErrFreshCityProof
	}
	// End/cancellation can race the claim. Never reset a claimed proof on error.
	if err := p.s.access.CheckSameTransaction(ctx, p.s.binding, &copyAccess); err != nil {
		return CityIdentity{}, err
	}
	return p.s.identity, nil
}

// Insert requires APP's enrolled lease, prior authoritative actor/wallet locks
// and the fixed Pin order. The lock check below proves WORLD pins only, not
// authentication/order/external provenance. No live caller is enabled here.
// APP owns ending and publication; any error requires whole-command rollback.
func (p *FreshCityParticipant) Insert(ctx context.Context, a *recruittx.Access, c City) (FreshCity, error) {
	if p == nil || p.binding == nil || p.sequence == nil || p.sequence.retired.Load() || ctx == nil || a == nil {
		return FreshCity{}, ErrFreshCitySource
	}
	if c.ServerID != p.profile.ServerID || c.PlayerID <= 0 || c.CityID != 0 {
		return FreshCity{}, ErrInvalidCity
	}
	if c.X < 0 || c.Y < 0 || c.X >= MapSize || c.Y >= MapSize {
		return FreshCity{}, ErrOutOfBounds
	}
	copyAccess := *a
	var pins int
	if err := copyAccess.Scan(ctx, p.binding, `SELECT pg_catalog.count(*) FROM pg_catalog.pg_locks
 WHERE pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid() AND granted AND
 ((relation OPERATOR(pg_catalog.=) $1::pg_catalog.oid AND mode OPERATOR(pg_catalog.=) 'RowShareLock') OR
 (relation OPERATOR(pg_catalog.=) $2::pg_catalog.oid AND mode OPERATOR(pg_catalog.=) 'RowExclusiveLock'))`,
		[]any{p.profile.Objects["map_cell"].OID, p.profile.Objects["player_city"].OID}, &pins); err != nil {
		return FreshCity{}, err
	}
	if pins != 2 {
		return FreshCity{}, ErrFreshCitySource
	}
	stamp, err := validateFreshSource(ctx, &copyAccess, p.binding, p.profile)
	if err != nil {
		if errors.Is(err, ErrFreshCitySource) || errors.Is(err, errCitySequence) {
			p.sequence.retired.Store(true)
		}
		return FreshCity{}, err
	}
	if stamp != p.sequence.stamp {
		p.sequence.retired.Store(true)
		return FreshCity{}, ErrFreshCitySource
	}
	if _, err = copyAccess.Exec(ctx, p.binding, `SELECT pg_catalog.pg_advisory_xact_lock($1::pg_catalog.int4,$2::pg_catalog.int4)`, cityCreationLockNamespace, c.ServerID); err != nil {
		return FreshCity{}, err
	}
	mapTable := pgx.Identifier{p.profile.SchemaName, "map_cell"}.Sanitize()
	var cell Cell
	err = copyAccess.Scan(ctx, p.binding, "SELECT terrain,COALESCE(resource_type,0) FROM "+mapTable+" WHERE server_id=$1 AND x=$2 AND y=$3 FOR UPDATE", []any{c.ServerID, c.X, c.Y}, &cell.Terrain, &cell.ResourceType)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !cell.Buildable()) {
		return FreshCity{}, ErrBadTerrain
	}
	if err != nil {
		return FreshCity{}, err
	}
	c.CityID, err = p.sequence.next(ctx, &copyAccess)
	if err != nil {
		return FreshCity{}, err
	}
	cityTable := pgx.Identifier{p.profile.SchemaName, "player_city"}.Sanitize()
	tag, err := copyAccess.Exec(ctx, p.binding, "INSERT INTO "+cityTable+" (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", c.ServerID, c.CityID, c.PlayerID, c.Name, c.X, c.Y, c.IsCapital, c.WallLevel, c.Morale)
	if err != nil {
		var pe *pgconn.PgError
		if errors.As(err, &pe) && pe.Code == "23505" {
			if pe.ConstraintName == "player_city_server_id_x_y_key" {
				return FreshCity{}, ErrOccupied
			}
			if pe.ConstraintName == "player_city_pkey" {
				return FreshCity{}, ErrCityIDConflict
			}
		}
		return FreshCity{}, err
	}
	if tag.RowsAffected() != 1 {
		return FreshCity{}, ErrFreshCityProof
	}
	var got City
	err = copyAccess.Scan(ctx, p.binding, "SELECT server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale FROM "+cityTable+" WHERE server_id=$1 AND city_id=$2", []any{c.ServerID, c.CityID}, &got.ServerID, &got.CityID, &got.PlayerID, &got.Name, &got.X, &got.Y, &got.IsCapital, &got.WallLevel, &got.Morale)
	if err != nil {
		return FreshCity{}, err
	}
	if got != c {
		return FreshCity{}, ErrFreshCityProof
	}
	if err = copyAccess.CheckSameTransaction(ctx, p.binding, &copyAccess); err != nil {
		return FreshCity{}, err
	}
	return FreshCity{s: &freshCityState{access: copyAccess, binding: p.binding, identity: CityIdentity{got.ServerID, got.CityID, got.PlayerID}}}, nil
}
