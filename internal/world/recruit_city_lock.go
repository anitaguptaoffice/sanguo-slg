package world

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrRecruitCity indicates an absent, mismatched or invalid city authorization.
var ErrRecruitCity = errors.New("world: recruit city unavailable")

// RecruitCityLocker is dormant: APP owns the prior actor/wallet locks, source
// enrollment and external exclusions, transaction lifetime, and publication.
// Copies share the irreversible retirement state in source.
type RecruitCityLocker struct{ source *FreshCityParticipant }

func NewRecruitCityLocker(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile) (*RecruitCityLocker, error) {
	s, err := NewFreshCityParticipant(ctx, b, a, p)
	if err != nil {
		return nil, err
	}
	return &RecruitCityLocker{source: s}, nil
}

func (l *RecruitCityLocker) valid(ctx context.Context, a *recruittx.Access) bool {
	return l != nil && l.source != nil && l.source.binding != nil && l.source.sequence != nil && !l.source.sequence.retired.Load() && ctx != nil && a != nil
}

func (l *RecruitCityLocker) revalidate(ctx context.Context, a *recruittx.Access) error {
	s := l.source
	stamp, err := validateFreshSource(ctx, a, s.binding, s.profile)
	if err == nil && stamp != s.sequence.stamp {
		err = ErrFreshCitySource
	}
	if errors.Is(err, ErrFreshCitySource) || errors.Is(err, errCitySequence) {
		s.sequence.retired.Store(true)
	}
	if err == nil && s.sequence.retired.Load() {
		return ErrFreshCitySource
	}
	return err
}

// Pin takes only the WORLD Recruit player_city relation pin. It is not proof
// of earlier ranks, source provenance, or an external writer/DDL fence.
func (l *RecruitCityLocker) Pin(ctx context.Context, a *recruittx.Access) error {
	if !l.valid(ctx, a) {
		return ErrFreshCitySource
	}
	s := l.source
	access := *a
	_, err := access.Exec(ctx, s.binding, "LOCK TABLE "+pgx.Identifier{s.profile.SchemaName, "player_city"}.Sanitize()+" IN ROW SHARE MODE")
	if err != nil {
		var pe *pgconn.PgError
		if errors.As(err, &pe) && (pe.Code == "42P01" || pe.Code == "3F000" || pe.Code == "42809" || pe.Code == "42501") {
			s.sequence.retired.Store(true)
		}
		return err
	}
	return l.revalidate(ctx, &access)
}

// Lock holds the actual city row through APP's transaction end. It does not
// infer actor/wallet ordering or authorize a successful commit by itself.
func (l *RecruitCityLocker) Lock(ctx context.Context, a *recruittx.Access, playerID, cityID int64) error {
	if !l.valid(ctx, a) || playerID <= 0 || cityID <= 0 || l.source.profile.ServerID <= 0 {
		return ErrRecruitCity
	}
	s := l.source
	access := *a
	var pinned bool
	if err := access.Scan(ctx, s.binding, `SELECT EXISTS(SELECT FROM pg_catalog.pg_locks
 WHERE pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid() AND granted AND
 relation OPERATOR(pg_catalog.=) $1::pg_catalog.oid AND mode OPERATOR(pg_catalog.=) 'RowShareLock')`,
		[]any{s.profile.Objects["player_city"].OID}, &pinned); err != nil {
		return err
	}
	if !pinned {
		return ErrFreshCitySource
	}
	if err := l.revalidate(ctx, &access); err != nil {
		return err
	}
	var owner int64
	err := access.Scan(ctx, s.binding, "SELECT player_id FROM "+pgx.Identifier{s.profile.SchemaName, "player_city"}.Sanitize()+
		" WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE", []any{s.profile.ServerID, cityID}, &owner)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && owner != playerID) {
		return ErrRecruitCity
	}
	return err
}
