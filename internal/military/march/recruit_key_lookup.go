package march

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

var (
	// ErrRecruitConflict reports an accepted same-key intent with different evidence.
	ErrRecruitConflict = errors.New("march: recruit intent conflict")
	// ErrRecruitUnavailable reports missing or inconsistent evidence and unusable
	// participants/accesses. It never means the key was proven absent.
	ErrRecruitUnavailable = errors.New("march: recruit evidence unavailable")
)

// RecruitCommandID is the exact 16 nonzero command bytes. It is never trimmed,
// hex-normalized or narrowed; a zero value is invalid.
type RecruitCommandID [16]byte

// RecruitScope is the copied authenticated shard/actor and operation-1 key.
type RecruitScope struct {
	ServerID  int32
	PlayerID  int64
	CommandID RecruitCommandID
}

// RecruitIntent is copied typed admission input. Version keeps the full uint32.
type RecruitIntent struct {
	Version   uint32
	CityID    int64
	UnitCfgID int32
	Count     int32
}

// Find reads the scoped origin joined to its receipt as one unlocked hint
// statement. It takes no business locks, checks no readiness and writes nothing.
// An origin without its receipt and duplicate matches are unavailable.
func (p *RecruitParticipant) Find(ctx context.Context, a *recruittx.Access, scope RecruitScope) (int64, bool, error) {
	s, err := p.recruitLookup(ctx, a, scope)
	if err != nil {
		return 0, false, err
	}
	var origins, receipts, queueID int64
	err = a.Scan(ctx, s.binding, recruitHintQuery(s, `pg_catalog.count(*), COALESCE(pg_catalog.min(o.queue_id),0), pg_catalog.count(r.queue_id)`),
		[]any{scope.ServerID, scope.PlayerID, scope.CommandID[:]}, &origins, &queueID, &receipts)
	if err != nil {
		return 0, false, errors.Join(ErrRecruitUnavailable, s.failure(err))
	}
	if origins == 0 {
		return 0, false, nil
	}
	if origins != 1 || receipts != 1 {
		return 0, false, ErrRecruitUnavailable
	}
	return queueID, true, nil
}

// ReverseAbsent runs its own unlocked statement and reports true only when the
// exact scoped origin and its matching receipt are both absent. Any surviving
// origin, with or without its receipt, is unavailable rather than absent.
func (p *RecruitParticipant) ReverseAbsent(ctx context.Context, a *recruittx.Access, scope RecruitScope) (bool, error) {
	s, err := p.recruitLookup(ctx, a, scope)
	if err != nil {
		return false, err
	}
	var origins, receipts int64
	err = a.Scan(ctx, s.binding, recruitHintQuery(s, `pg_catalog.count(*), pg_catalog.count(r.queue_id)`),
		[]any{scope.ServerID, scope.PlayerID, scope.CommandID[:]}, &origins, &receipts)
	if err != nil {
		return false, errors.Join(ErrRecruitUnavailable, s.failure(err))
	}
	if origins != 0 || receipts != 0 {
		return false, ErrRecruitUnavailable
	}
	return true, nil
}

func (p *RecruitParticipant) recruitLookup(ctx context.Context, a *recruittx.Access, scope RecruitScope) (*freshMilitarySource, error) {
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil || p.source.retired.Load() {
		return nil, ErrRecruitUnavailable
	}
	if scope.ServerID <= 0 || scope.ServerID != p.source.profile.ServerID || scope.PlayerID <= 0 || scope.CommandID == (RecruitCommandID{}) {
		return nil, ErrRecruitUnavailable
	}
	return p.source, nil
}

func recruitHintQuery(s *freshMilitarySource, columns string) string {
	return `SELECT ` + columns + ` FROM ` + pgx.Identifier{s.profile.SchemaName, "mil_recruit_origin"}.Sanitize() +
		` o LEFT JOIN ` + pgx.Identifier{s.profile.SchemaName, "mil_recruit_receipt"}.Sanitize() +
		` r ON r.server_id OPERATOR(pg_catalog.=) o.server_id AND r.queue_id OPERATOR(pg_catalog.=) o.queue_id` +
		` WHERE o.server_id OPERATOR(pg_catalog.=) $1 AND o.player_id OPERATOR(pg_catalog.=) $2` +
		` AND o.operation OPERATOR(pg_catalog.=) 1 AND o.command_id OPERATOR(pg_catalog.=) $3`
}
