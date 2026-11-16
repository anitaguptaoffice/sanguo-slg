package domestic

import (
	"context"
	"errors"
	"sync/atomic"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
)

var errPreparedCity = errors.New("domestic: prepared city unavailable")

// PreparedCity owns the DOM preparation gate and private staged state (default-off).
type PreparedCity struct {
	participant *FreshCityParticipant
	hub         *Hub
	city        *CityState
	catalog     map[int32]BuildingSpec
	gateHeld    bool
	closed      atomic.Bool
	walletOnce  atomic.Bool
	walletSnap  recruittx.Access
	stagedOnce  atomic.Bool
	publishOnce atomic.Bool
	identity    world.CityIdentity
	staged      *CityState
}

func (p *FreshCityParticipant) Prepare(ctx context.Context, initial *CityState) (*PreparedCity, error) {
	if p == nil || p.state == nil || ctx == nil || initial == nil {
		return nil, errPreparedCity
	}
	s := p.state
	if err := s.checkWiring(); err != nil {
		return nil, err
	}
	city, catalog, err := snapshotFreshTemplate(initial, s.catalog)
	if err != nil {
		return nil, err
	}
	if s.hub == nil {
		return nil, errPreparedCity
	}
	if err := s.hub.lockCreation(ctx); err != nil {
		return nil, err
	}
	if err := s.checkWiring(); err != nil {
		s.hub.mu.Unlock()
		return nil, err
	}
	return &PreparedCity{
		participant: p,
		hub:         s.hub,
		city:        city,
		catalog:     catalog,
		gateHeld:    true,
	}, nil
}

func (pc *PreparedCity) alive() bool {
	return pc != nil && pc.participant != nil && pc.participant.state != nil && !pc.closed.Load()
}

func (pc *PreparedCity) source() *freshDomesticSource {
	if pc == nil || pc.participant == nil {
		return nil
	}
	return pc.participant.state
}

func (pc *PreparedCity) Close() {
	if pc == nil || !pc.closed.CompareAndSwap(false, true) {
		return
	}
	if pc.gateHeld && pc.hub != nil {
		pc.hub.mu.Unlock()
		pc.gateHeld = false
	}
	pc.staged = nil
}

func (pc *PreparedCity) LockWallet(ctx context.Context, a *recruittx.Access) error {
	if !pc.alive() || a == nil || pc.walletOnce.Load() {
		return errPreparedCity
	}
	s := pc.source()
	if s == nil || s.retired.Load() || s.binding == nil {
		return errPreparedCity
	}
	if err := s.checkWiring(); err != nil {
		return err
	}
	snapshot := *a
	wallet := pgx.Identifier{s.profile.SchemaName, "player_wallet"}.Sanitize()
	var pinned bool
	err := snapshot.Scan(ctx, s.binding, `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_locks WHERE pid=pg_catalog.pg_backend_pid() AND granted AND relation=$1::pg_catalog.oid AND mode='RowExclusiveLock')`,
		[]any{s.profile.Objects["player_wallet"].OID}, &pinned)
	if err != nil {
		return s.failure(err)
	}
	if !pinned {
		return errPreparedCity
	}
	if err = snapshot.CheckSameTransaction(ctx, s.binding, &snapshot); err != nil {
		return err
	}
	now := pc.hub.now()
	_, err = snapshot.Exec(ctx, s.binding, "INSERT INTO "+wallet+"(server_id,player_id,food,wood,iron,stone,gold,updated_at) VALUES($1,$2,$3,$4,$5,$6,0,$7) ON CONFLICT DO NOTHING",
		s.profile.ServerID, pc.city.PlayerID, pc.city.Wallet.Food, pc.city.Wallet.Wood, pc.city.Wallet.Iron, pc.city.Wallet.Stone, now)
	if err != nil {
		return s.failure(err)
	}
	var food, wood, iron, stone int64
	err = snapshot.Scan(ctx, s.binding, "SELECT food,wood,iron,stone FROM "+wallet+" WHERE server_id=$1 AND player_id=$2 FOR UPDATE",
		[]any{s.profile.ServerID, pc.city.PlayerID}, &food, &wood, &iron, &stone)
	if err != nil {
		return s.failure(err)
	}
	if !freshResourcesValid(Resources{Food: food, Wood: wood, Iron: iron, Stone: stone}) {
		return errPreparedCity
	}
	if err = snapshot.CheckSameTransaction(ctx, s.binding, &snapshot); err != nil {
		return err
	}
	if !pc.walletOnce.CompareAndSwap(false, true) {
		return errPreparedCity
	}
	pc.walletSnap = snapshot
	return nil
}

func (pc *PreparedCity) Stage(ctx context.Context, a *recruittx.Access, city march.InitializedCity, at time.Time) (world.CityIdentity, error) {
	if !pc.alive() || a == nil || !pc.walletOnce.Load() || pc.stagedOnce.Load() {
		return world.CityIdentity{}, errPreparedCity
	}
	s := pc.source()
	if s == nil || s.retired.Load() {
		return world.CityIdentity{}, errPreparedCity
	}
	if err := pc.walletSnap.CheckSameTransaction(ctx, s.binding, a); err != nil {
		return world.CityIdentity{}, err
	}
	if err := s.checkWiring(); err != nil {
		return world.CityIdentity{}, err
	}
	var mask int
	ids := []uint32{s.profile.Objects["city_production_checkpoint"].OID, s.profile.Objects["city_building"].OID}
	err := a.Scan(ctx, s.binding, `SELECT COALESCE(pg_catalog.bit_or(1 OPERATOR(pg_catalog.<<) (n::pg_catalog.int4 OPERATOR(pg_catalog.-) 1))
 FILTER (WHERE l.mode OPERATOR(pg_catalog.=) 'RowExclusiveLock'),0)
 FROM pg_catalog.unnest($1::pg_catalog.oid[]) WITH ORDINALITY e(oid,n)
 LEFT JOIN pg_catalog.pg_locks l ON l.relation OPERATOR(pg_catalog.=) e.oid AND l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid() AND l.granted`,
		[]any{ids}, &mask)
	if err != nil {
		return world.CityIdentity{}, s.failure(err)
	}
	if mask != 3 {
		return world.CityIdentity{}, errPreparedCity
	}
	at, err = freshPreparedTime(at)
	if err != nil {
		return world.CityIdentity{}, err
	}
	identity, err := city.Consume(ctx, a)
	if err != nil {
		return world.CityIdentity{}, err
	}
	if identity.ServerID != s.profile.ServerID || identity.PlayerID != pc.city.PlayerID || identity.CityID <= 0 {
		return world.CityIdentity{}, errPreparedCity
	}
	schema := s.profile.SchemaName
	checkpoint := pgx.Identifier{schema, "city_production_checkpoint"}.Sanitize()
	building := pgx.Identifier{schema, "city_building"}.Sanitize()
	cityTable := pgx.Identifier{schema, "player_city"}.Sanitize()
	var owner int64
	err = a.Scan(ctx, s.binding, "SELECT player_id FROM "+cityTable+" WHERE server_id=$1 AND city_id=$2", []any{identity.ServerID, identity.CityID}, &owner)
	if err != nil {
		return world.CityIdentity{}, s.failure(err)
	}
	if owner != pc.city.PlayerID {
		return world.CityIdentity{}, ErrProductionOwnerMismatch
	}
	var exists bool
	err = a.Scan(ctx, s.binding, `SELECT EXISTS (SELECT 1 FROM `+building+` WHERE server_id=$1 AND city_id=$2
 UNION ALL SELECT 1 FROM `+checkpoint+` WHERE server_id=$1 AND city_id=$2)`, []any{identity.ServerID, identity.CityID}, &exists)
	if err != nil {
		return world.CityIdentity{}, s.failure(err)
	}
	if exists {
		return world.CityIdentity{}, ErrCityAlreadyRegistered
	}
	tag, err := a.Exec(ctx, s.binding, `INSERT INTO `+checkpoint+`(server_id,city_id,player_id,settled_at,settled_submicro_ns)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
		identity.ServerID, identity.CityID, pc.city.PlayerID, at.Truncate(time.Microsecond), at.Nanosecond()%1000)
	if err != nil {
		return world.CityIdentity{}, s.failure(err)
	}
	if tag.RowsAffected() != 1 {
		return world.CityIdentity{}, ErrCityAlreadyRegistered
	}
	for slot, inst := range pc.city.Buildings {
		tag, err = a.Exec(ctx, s.binding, `INSERT INTO `+building+`(server_id,city_id,slot_key,building_cfg_id,level) VALUES($1,$2,$3,$4,$5)`,
			identity.ServerID, identity.CityID, slot, inst.CfgID, inst.Level)
		if err != nil {
			return world.CityIdentity{}, s.failure(err)
		}
		if tag.RowsAffected() != 1 {
			return world.CityIdentity{}, ErrCityAlreadyRegistered
		}
	}
	work := cloneCity(pc.city)
	work.ID, work.PlayerID = identity.CityID, identity.PlayerID
	work.LastSettleAt, work.productionRemainder = at, [4]int64{}
	work.Wallet = Resources{} // Publish applies post-commit hydration policy.
	if !pc.stagedOnce.CompareAndSwap(false, true) {
		return world.CityIdentity{}, errPreparedCity
	}
	pc.identity, pc.staged = identity, work
	return identity, nil
}

func freshPreparedTime(at time.Time) (time.Time, error) {
	if at.IsZero() || at.Before(time.Unix(0, 0)) || at.After(time.Date(2262, 1, 1, 0, 0, 0, 0, time.UTC)) {
		return time.Time{}, errPreparedCity
	}
	return at.UTC().Truncate(time.Microsecond), nil
}

func (pc *PreparedCity) Publish() error {
	if !pc.alive() || !pc.stagedOnce.Load() || !pc.publishOnce.CompareAndSwap(false, true) || pc.staged == nil {
		return errPreparedCity
	}
	if !pc.gateHeld || pc.hub == nil {
		return errPreparedCity
	}
	work := cloneCity(pc.staged)
	settleProduction(work, pc.catalog, pc.hub.now())
	pc.hub.registerCityLocked(work)
	return nil
}
