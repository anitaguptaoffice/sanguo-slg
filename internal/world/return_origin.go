package world

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// ReturnOrigin is copied data, not authorization or proof of transaction origin.
type ReturnOrigin struct {
	ServerID         int32
	PlayerID, CityID int64
	X, Y             int32
}

// LockReturnOrigin reads owner and coordinates from the same locked city row.
// APP must pin first and retain its source lease and transaction through end;
// the fixed APP call graph, not this value, establishes authoritative provenance.
func (l *RecruitCityLocker) LockReturnOrigin(ctx context.Context, a *recruittx.Access, playerID, cityID int64) (ReturnOrigin, error) {
	if !l.valid(ctx, a) || playerID <= 0 || cityID <= 0 || l.source.profile.ServerID <= 0 {
		return ReturnOrigin{}, ErrRecruitCity
	}
	s := l.source
	access := *a
	var pinned bool
	if err := access.Scan(ctx, s.binding, `SELECT EXISTS(SELECT FROM pg_catalog.pg_locks
 WHERE pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid() AND granted AND
 relation OPERATOR(pg_catalog.=) $1::pg_catalog.oid AND mode OPERATOR(pg_catalog.=) 'RowShareLock')`,
		[]any{s.profile.Objects["player_city"].OID}, &pinned); err != nil {
		return ReturnOrigin{}, err
	}
	if !pinned {
		return ReturnOrigin{}, ErrFreshCitySource
	}
	if err := l.revalidate(ctx, &access); err != nil {
		return ReturnOrigin{}, err
	}
	origin := ReturnOrigin{ServerID: s.profile.ServerID, CityID: cityID}
	err := access.Scan(ctx, s.binding, "SELECT player_id,x,y FROM "+pgx.Identifier{s.profile.SchemaName, "player_city"}.Sanitize()+
		" WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE",
		[]any{s.profile.ServerID, cityID}, &origin.PlayerID, &origin.X, &origin.Y)
	if errors.Is(err, pgx.ErrNoRows) {
		return ReturnOrigin{}, ErrRecruitCity
	}
	if err != nil {
		return ReturnOrigin{}, err
	}
	if origin.PlayerID != playerID || origin.X < 0 || origin.Y < 0 || origin.X >= MapSize || origin.Y >= MapSize {
		return ReturnOrigin{}, ErrRecruitCity
	}
	return origin, nil
}
