package account

import (
	"context"
	"errors"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"sync/atomic"
)

// ErrRecruitActorGuard marks an unusable or mismatched actor guard.
var ErrRecruitActorGuard = errors.New("account: recruit actor guard unavailable")

// Exact reviewed ACCOUNT inventory from spec/rules/MIL_RECRUIT_PORTS.md §1.
var freshActorGuardNames = [...]string{
	"account", "account_pkey", "uq_account_login_name", "account_account_id_seq",
	"account_session", "account_session_pkey", "idx_account_session_account",
	"player", "player_pkey", "uq_player_account_per_server", "idx_player_account",
}

// RecruitActorGuard is a dormant port; APP owns authentication, leases,
// transaction lifetime and lock ordering. Copies share retirement state.
type RecruitActorGuard struct{ s *recruitActorState }
type recruitActorState struct {
	binding *recruittx.Binding
	profile freshsource.Profile
	pinned  atomic.Pointer[recruittx.Access]
	retired atomic.Bool
}

// NewRecruitActorGuard validates exact Binding/source/shard expectations without owning Begin/end.
func NewRecruitActorGuard(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile) (*RecruitActorGuard, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || b == nil || a == nil || len(p.Objects) != len(freshActorGuardNames) {
		return nil, ErrRecruitActorGuard
	}
	seen := make(map[uint32]struct{}, len(freshActorGuardNames))
	for _, name := range freshActorGuardNames {
		object, ok := p.Objects[name]
		if _, duplicate := seen[object.OID]; !ok || duplicate {
			return nil, ErrRecruitActorGuard
		}
		seen[object.OID] = struct{}{}
	}
	access := *a
	if err = validateFreshActorIndexes(ctx, &access, b, p); err != nil {
		return nil, err
	}
	return &RecruitActorGuard{s: &recruitActorState{binding: b, profile: p}}, nil
}
func (g *RecruitActorGuard) valid(ctx context.Context, a *recruittx.Access) bool {
	return g != nil && g.s != nil && g.s.binding != nil && !g.s.retired.Load() && ctx != nil && a != nil
}

// failure retires only definite source/metadata drift, never transaction or caller errors.
func (s *recruitActorState) failure(err error) error {
	var pgErr *pgconn.PgError
	if errors.Is(err, ErrRecruitActorGuard) || errors.Is(err, errFreshActorTables) || errors.Is(err, errFreshActorFK) || errors.Is(err, errFreshActorIndexes) ||
		(errors.As(err, &pgErr) && (pgErr.Code == "42P01" || pgErr.Code == "3F000" || pgErr.Code == "42809" || pgErr.Code == "42501")) {
		s.retired.Store(true)
	}
	return err
}
func (s *recruitActorState) validate(ctx context.Context, a *recruittx.Access) error {
	return s.failure(validateFreshActorIndexes(ctx, a, s.binding, s.profile))
}

// Pin takes only account then player ROW SHARE pins, then revalidates.
func (g *RecruitActorGuard) Pin(ctx context.Context, a *recruittx.Access) error {
	if !g.valid(ctx, a) {
		return ErrRecruitActorGuard
	}
	s := g.s
	access := *a
	for _, table := range [...]string{"account", "player"} {
		if _, err := access.Exec(ctx, s.binding, "LOCK TABLE "+pgx.Identifier{s.profile.SchemaName, table}.Sanitize()+" IN ROW SHARE MODE"); err != nil {
			return s.failure(err)
		}
	}
	if err := s.validate(ctx, &access); err != nil {
		return err
	}
	if s.retired.Load() {
		return ErrRecruitActorGuard
	}
	s.pinned.Store(&access)
	return nil
}

// Lock requires prior Pin in this transaction, then locks account (status 1) and the captured-shard player row FOR SHARE.
func (g *RecruitActorGuard) Lock(ctx context.Context, a *recruittx.Access, accountID, playerID int64) error {
	if !g.valid(ctx, a) || accountID <= 0 || playerID <= 0 {
		return ErrRecruitActorGuard
	}
	s := g.s
	pin := s.pinned.Load()
	if pin == nil {
		return ErrRecruitActorGuard
	}
	access := *a
	if err := pin.CheckSameTransaction(ctx, s.binding, &access); err != nil {
		return err
	}
	if err := s.validate(ctx, &access); err != nil {
		return err
	}
	var status int16
	err := access.Scan(ctx, s.binding, "SELECT status FROM "+pgx.Identifier{s.profile.SchemaName, "account"}.Sanitize()+
		" WHERE account_id OPERATOR(pg_catalog.=) $1 FOR SHARE", []any{accountID}, &status)
	switch {
	case errors.Is(err, pgx.ErrNoRows), err == nil && status != 1:
		return ErrRecruitActorGuard
	case err != nil:
		return s.failure(err)
	}
	var owner int64
	err = access.Scan(ctx, s.binding, "SELECT account_id FROM "+pgx.Identifier{s.profile.SchemaName, "player"}.Sanitize()+
		" WHERE server_id OPERATOR(pg_catalog.=) $1 AND player_id OPERATOR(pg_catalog.=) $2 FOR SHARE",
		[]any{s.profile.ServerID, playerID}, &owner)
	switch {
	case errors.Is(err, pgx.ErrNoRows), err == nil && owner != accountID:
		return ErrRecruitActorGuard
	case err != nil:
		return s.failure(err)
	}
	return nil
}
