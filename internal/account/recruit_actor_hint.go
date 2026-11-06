package account

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// AccountHint discovers a player/account association without row locks or writes.
// It requires both ACCOUNT pins and the captured source, but proves no authority.
// Lock must recheck account status and association in account-before-player order;
// a stale hint requires rollback/restart, never switching accounts after wallet.
func (g *RecruitActorGuard) AccountHint(ctx context.Context, a *recruittx.Access, playerID int64) (int64, error) {
	if !g.valid(ctx, a) || playerID <= 0 {
		return 0, ErrRecruitActorGuard
	}
	s, access := g.s, *a
	var held bool
	err := access.Scan(ctx, s.binding, `SELECT pg_catalog.count(DISTINCT relation) OPERATOR(pg_catalog.=) 2 FROM pg_catalog.pg_locks
 WHERE pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
 AND database OPERATOR(pg_catalog.=) (SELECT oid FROM pg_catalog.pg_database WHERE datname OPERATOR(pg_catalog.=) pg_catalog.current_database())
 AND locktype OPERATOR(pg_catalog.=) 'relation' AND mode OPERATOR(pg_catalog.=) 'RowShareLock' AND granted
 AND relation IN ($1,$2)`, []any{s.profile.Objects["account"].OID, s.profile.Objects["player"].OID}, &held)
	if err != nil {
		return 0, s.failure(err)
	}
	if !held {
		return 0, ErrRecruitActorGuard
	}
	if err = s.validate(ctx, &access); err != nil {
		return 0, err
	}
	var accountID int64
	err = access.Scan(ctx, s.binding, "SELECT account_id FROM "+pgx.Identifier{s.profile.SchemaName, "player"}.Sanitize()+
		" WHERE server_id OPERATOR(pg_catalog.=) $1 AND player_id OPERATOR(pg_catalog.=) $2",
		[]any{s.profile.ServerID, playerID}, &accountID)
	switch {
	case errors.Is(err, pgx.ErrNoRows), err == nil && accountID <= 0:
		return 0, ErrRecruitActorGuard
	case err != nil:
		return 0, s.failure(err)
	case s.retired.Load():
		return 0, ErrRecruitActorGuard
	}
	return accountID, nil
}
