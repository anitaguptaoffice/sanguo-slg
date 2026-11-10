package domestic

import (
	"context"
	"errors"
	"maps"
	"sync/atomic"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errFreshSource = errors.New("domestic: fresh source unavailable")
var errFreshPinOrder = errors.New("domestic: unsupported fresh relation pin order")

// FreshCityParticipant checks local consistency, not enrollment or business success.
// Copies share immutable wiring and irreversible retirement. APP owns admission/end.
type FreshCityParticipant struct{ state *freshDomesticSource }
type freshDomesticSource struct {
	binding *recruittx.Binding
	profile freshsource.Profile
	hub     *Hub
	store   *PGStore
	pool    *pgxpool.Pool
	catalog map[int32]BuildingSpec
	retired atomic.Bool
}

// NewFreshCityParticipant requires startup-immutable Hub wiring/catalog. APP must
// create b from its captured pool and check SupportsAtomicCityCreation(pool, shard).
// This port cannot inspect b's pool; its own Hub check is not that correspondence proof.
func NewFreshCityParticipant(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile, h *Hub) (*FreshCityParticipant, error) {
	if h == nil || h.store == nil || h.store.Pool == nil || h.serverID <= 0 || h.serverID != p.ServerID {
		return nil, errFreshSource
	}
	var access recruittx.Access
	if a != nil {
		access = *a
	}
	if err := access.CheckSameTransaction(ctx, b, &access); err != nil {
		return nil, err
	}
	profile, err := snapshotFreshSourceProfile(p)
	if err != nil {
		return nil, err
	}
	catalog, err := snapshotFreshCatalog(h.cat)
	if err != nil {
		return nil, err
	}
	s := &freshDomesticSource{
		binding: b, profile: profile, hub: h,
		store: h.store, pool: h.store.Pool, catalog: catalog,
	}
	if err = validateFreshSource(ctx, b, &access, profile); err != nil {
		return nil, err
	}
	if err = s.checkWiring(); err != nil {
		return nil, err
	}
	return &FreshCityParticipant{state: s}, nil
}

// Ordinary fields/maps remain startup-immutable. This is drift detection, not
// synchronization for concurrent UseStore, pool replacement or catalog mutation.
func (s *freshDomesticSource) checkWiring() error {
	if s.retired.Load() {
		return errFreshSource
	}
	if s.hub == nil || s.store == nil || s.pool == nil || s.hub.store != s.store ||
		s.store.Pool != s.pool || s.hub.serverID != s.profile.ServerID || s.profile.ServerID <= 0 ||
		s.hub.cat == nil || !maps.Equal(s.hub.cat, s.catalog) {
		s.retired.Store(true)
		return errFreshSource
	}
	return nil
}

func (s *freshDomesticSource) failure(err error) error {
	var pgerr *pgconn.PgError
	if errors.Is(err, errFreshSourceMetadata) || (errors.As(err, &pgerr) &&
		(pgerr.Code == "42P01" || pgerr.Code == "3F000" || pgerr.Code == "42809" || pgerr.Code == "42501")) {
		s.retired.Store(true)
	}
	return err
}

// PinWallet only obtains W. PinCityState requires W, then obtains C followed by B.
// Existing exact pins are revalidated, not one-shot consumed or reverse-repaired.
func (p *FreshCityParticipant) PinWallet(ctx context.Context, a *recruittx.Access) error {
	return p.pin(ctx, a, false)
}
func (p *FreshCityParticipant) PinCityState(ctx context.Context, a *recruittx.Access) error {
	return p.pin(ctx, a, true)
}

func (p *FreshCityParticipant) pin(ctx context.Context, a *recruittx.Access, city bool) error {
	if p == nil || p.state == nil || p.state.binding == nil {
		return errFreshSource
	}
	s := p.state
	var access recruittx.Access
	if a != nil {
		access = *a
	}
	if err := access.CheckSameTransaction(ctx, s.binding, &access); err != nil {
		return err
	}
	if err := s.checkWiring(); err != nil {
		return err
	}
	names := [...]string{"player_wallet", "city_production_checkpoint", "city_building"}
	ids := []uint32{s.profile.Objects[names[0]].OID, s.profile.Objects[names[1]].OID, s.profile.Objects[names[2]].OID}
	var mask int
	var unsupported bool
	if err := access.Scan(ctx, s.binding, freshPinMaskSQL, []any{s.profile.DatabaseOID, ids}, &mask, &unsupported); err != nil {
		return s.failure(err)
	}
	missing, err := freshPinMissing(mask, unsupported, city)
	if err != nil {
		return err
	}
	for i, name := range names {
		if missing&(1<<i) == 0 {
			continue
		}
		query := "LOCK TABLE ONLY " + pgx.Identifier{s.profile.SchemaName, name}.Sanitize() + " IN ROW EXCLUSIVE MODE"
		if _, err = access.Exec(ctx, s.binding, query); err != nil {
			return s.failure(err)
		}
	}
	if err = s.failure(validateFreshSource(ctx, s.binding, &access, s.profile)); err != nil {
		return err
	}
	return s.checkWiring()
}

// Only W/C/B prefix states are supported. Observations prove neither original
// chronology nor ACCOUNT/WORLD/MIL phases. APP serializes each command's methods.
func freshPinMissing(mask int, unsupported, city bool) (int, error) {
	if unsupported || (mask != 0 && mask != 1 && mask != 3 && mask != 7) || (city && mask == 0) {
		return 0, errFreshPinOrder
	}
	if city {
		return 7 &^ mask, nil
	}
	return 1 &^ mask, nil
}

// Incidental AccessShareLock does not count as a pin. Other modes are refused,
// rather than treated as exact RowExclusiveLock or as evidence of source drift.
const freshPinMaskSQL = `SELECT
 COALESCE(pg_catalog.bit_or(1 OPERATOR(pg_catalog.<<) (e.n::pg_catalog.int4 OPERATOR(pg_catalog.-) 1))
  FILTER (WHERE l.mode OPERATOR(pg_catalog.=) 'RowExclusiveLock'),0),
 COALESCE(pg_catalog.bool_or(l.mode OPERATOR(pg_catalog.<>) ALL(
  ARRAY['AccessShareLock','RowExclusiveLock']::pg_catalog.text[])),false)
FROM pg_catalog.unnest($2::pg_catalog.oid[]) WITH ORDINALITY e(oid,n)
JOIN pg_catalog.pg_locks l ON l.relation OPERATOR(pg_catalog.=) e.oid
WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
 AND l.database OPERATOR(pg_catalog.=) $1::pg_catalog.oid
 AND l.locktype OPERATOR(pg_catalog.=) 'relation' AND l.granted`
