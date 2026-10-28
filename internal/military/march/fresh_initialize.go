package march

import (
	"context"
	"errors"
	"sync/atomic"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
)

var ErrInitializedCityProof = errors.New("march: invalid initialized city proof")

type InitializedCity struct{ s *initializedCityState }
type initializedCityState struct {
	access   recruittx.Access
	binding  *recruittx.Binding
	identity world.CityIdentity
	consumed atomic.Bool
}

// Consume attests uncommitted MIL writes/readback, not DOM, admission or commit.
func (p InitializedCity) Consume(ctx context.Context, a *recruittx.Access) (world.CityIdentity, error) {
	if p.s == nil || ctx == nil || a == nil || p.s.identity.ServerID <= 0 || p.s.identity.CityID <= 0 || p.s.identity.PlayerID <= 0 {
		return world.CityIdentity{}, ErrInitializedCityProof
	}
	copyAccess := *a
	if err := p.s.access.CheckSameTransaction(ctx, p.s.binding, &copyAccess); err != nil {
		return world.CityIdentity{}, err
	}
	if !p.s.consumed.CompareAndSwap(false, true) {
		return world.CityIdentity{}, ErrInitializedCityProof
	}
	if err := p.s.access.CheckSameTransaction(ctx, p.s.binding, &copyAccess); err != nil {
		return world.CityIdentity{}, err
	}
	return p.s.identity, nil
}

// Initialize accepts only actual WORLD issuance. APP must already hold the same
// enrolled source generation/lease and actor/wallet/WORLD locks. Pin observations
// below are not proof of those prerequisites. Any error requires whole-tx rollback.
// Origin-only history cannot be assigned to a city; complete external audit and
// retained-safe WORLD ID allocation remain mandatory, never inferred from absence.
func (p *FreshCityParticipant) Initialize(ctx context.Context, a *recruittx.Access, city world.FreshCity, at time.Time) (InitializedCity, error) {
	if p == nil || p.state == nil || ctx == nil || a == nil || p.state.retired.Load() {
		return InitializedCity{}, ErrFreshCitySource
	}
	s := p.state
	copyAccess := *a
	at, err := canonicalRecruitTime(at)
	if err != nil {
		return InitializedCity{}, err
	}
	ids := []uint32{s.profile.Objects["mil_city_origin"].OID, s.profile.Objects["city_troop"].OID, s.profile.Objects["work_queue"].OID, s.profile.Objects["mil_recruit_origin"].OID, s.profile.Objects["mil_recruit_receipt"].OID}
	var pins int
	err = copyAccess.Scan(ctx, s.binding, `SELECT pg_catalog.count(*) FROM pg_catalog.unnest($1::pg_catalog.oid[]) WITH ORDINALITY e(oid,n)
 WHERE EXISTS(SELECT FROM pg_catalog.pg_locks l WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
 AND l.granted AND l.relation OPERATOR(pg_catalog.=) e.oid AND l.mode OPERATOR(pg_catalog.=)
 CASE WHEN e.n OPERATOR(pg_catalog.<=) 3 THEN 'RowExclusiveLock' ELSE 'AccessShareLock' END)`, []any{ids}, &pins)
	if err != nil {
		return InitializedCity{}, err
	}
	if pins != 5 {
		return InitializedCity{}, ErrFreshCitySource
	}
	if err = s.failure(s.validate(ctx, &copyAccess)); err != nil {
		return InitializedCity{}, err
	}
	identity, err := city.Consume(ctx, &copyAccess)
	if err != nil {
		return InitializedCity{}, err
	}
	if identity.ServerID != s.profile.ServerID {
		return InitializedCity{}, ErrInitializedCityProof
	}
	q := func(table string) string { return pgx.Identifier{s.profile.SchemaName, table}.Sanitize() }
	var exists bool
	err = copyAccess.Scan(ctx, s.binding, "SELECT EXISTS(SELECT FROM "+q("mil_city_origin")+" WHERE server_id=$1 AND city_id=$2) OR EXISTS(SELECT FROM "+q("city_troop")+" WHERE server_id=$1 AND city_id=$2) OR EXISTS(SELECT FROM "+q("work_queue")+" WHERE server_id=$1 AND city_id=$2) OR EXISTS(SELECT FROM "+q("mil_recruit_receipt")+" WHERE server_id=$1 AND city_id=$2)", []any{identity.ServerID, identity.CityID}, &exists)
	if err != nil {
		return InitializedCity{}, err
	}
	if exists {
		return InitializedCity{}, ErrInitializedCityProof
	}
	tag, err := copyAccess.Exec(ctx, s.binding, "INSERT INTO "+q("mil_city_origin")+"(server_id,city_id,owner_player_id,cohort_id,format_version,created_at) VALUES($1,$2,$3,$4,1,$5)", identity.ServerID, identity.CityID, identity.PlayerID, s.profile.Cohort[:], at)
	if err != nil {
		return InitializedCity{}, err
	}
	if tag.RowsAffected() != 1 {
		return InitializedCity{}, ErrInitializedCityProof
	}
	for unit := int32(1); unit <= 4; unit++ {
		tag, err = copyAccess.Exec(ctx, s.binding, "INSERT INTO "+q("city_troop")+"(server_id,city_id,unit_cfg_id,count,wounded) VALUES($1,$2,$3,0,0)", identity.ServerID, identity.CityID, unit)
		if err != nil {
			return InitializedCity{}, err
		}
		if tag.RowsAffected() != 1 {
			return InitializedCity{}, ErrInitializedCityProof
		}
	}
	var marker, stock bool
	err = copyAccess.Scan(ctx, s.binding, "SELECT count(*)=1 AND bool_and(owner_player_id=$3 AND cohort_id=$4 AND format_version=1 AND created_at=$5) FROM "+q("mil_city_origin")+" WHERE server_id=$1 AND city_id=$2", []any{identity.ServerID, identity.CityID, identity.PlayerID, s.profile.Cohort[:], at}, &marker)
	if err != nil {
		return InitializedCity{}, err
	}
	err = copyAccess.Scan(ctx, s.binding, "SELECT count(*)=4 AND bool_and(unit_cfg_id BETWEEN 1 AND 4 AND count=0 AND wounded=0) FROM "+q("city_troop")+" WHERE server_id=$1 AND city_id=$2", []any{identity.ServerID, identity.CityID}, &stock)
	if err != nil {
		return InitializedCity{}, err
	}
	if !marker || !stock {
		return InitializedCity{}, ErrInitializedCityProof
	}
	if err = copyAccess.CheckSameTransaction(ctx, s.binding, &copyAccess); err != nil {
		return InitializedCity{}, err
	}
	return InitializedCity{s: &initializedCityState{access: copyAccess, binding: s.binding, identity: identity}}, nil
}
