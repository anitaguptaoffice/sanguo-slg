package api

import (
	"context"
	"errors"
	"time"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
)

type firstCityPreparedCreationEffect struct {
	srv *Server
}

func (e firstCityPreparedCreationEffect) Create(ctx context.Context, scope *worldv1.FirstCityScope, proposal *worldv1.FirstCityProposal) (int64, worldv1.FirstCityRejectionReason, error) {
	if e.srv == nil || scope == nil || proposal == nil {
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED, errCityCreationUnavailable
	}
	cityID, err := e.srv.createFirstCityViaPreparedCity(ctx, PlayerContext{
		AccountID: scope.GetAccountId(),
		ServerID:  scope.GetServerId(),
		PlayerID:  scope.GetPlayerId(),
	}, proposal.GetName(), int(proposal.GetX()), int(proposal.GetY()))
	switch {
	case err == nil:
		return cityID, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED, nil
	case errors.Is(err, world.ErrOccupied):
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_COORDINATE_OCCUPIED, nil
	case errors.Is(err, world.ErrBadTerrain), errors.Is(err, world.ErrOutOfBounds):
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_TERRAIN, nil
	default:
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED, err
	}
}

func firstCityPreparedActorLocks(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, schema string) error {
	q := func(name string) string { return pgx.Identifier{schema, name}.Sanitize() }
	if _, err := a.Exec(ctx, b, "LOCK TABLE "+q("account")+","+q("player")+" IN ROW SHARE MODE"); err != nil {
		return err
	}
	_, err := a.Exec(ctx, b, "LOCK TABLE "+q("player_wallet")+" IN ROW EXCLUSIVE MODE")
	return err
}

func (s *Server) createFirstCityViaPreparedCity(ctx context.Context, pc PlayerContext, name string, x, y int) (int64, error) {
	src := s.firstCityPrepared
	if src == nil || src.Binding == nil || src.Dom == nil || src.World == nil || src.Mil == nil {
		return 0, errCityCreationUnavailable
	}
	if s.domestic == nil || !s.domestic.SupportsAtomicCityCreation(s.players.Pool, pc.ServerID) {
		return 0, errCityCreationUnavailable
	}
	owner, err := src.Binding.Begin(ctx)
	if err != nil {
		return 0, err
	}
	committed := false
	defer func() {
		if !committed {
			_ = owner.Rollback(context.Background())
		}
	}()
	access := owner.Access()
	schema := src.Profile.SchemaName
	if err := firstCityPreparedActorLocks(ctx, access, src.Binding, schema); err != nil {
		return 0, err
	}
	if err := src.World.Pin(ctx, access); err != nil {
		return 0, err
	}
	if err := src.Mil.Pin(ctx, access); err != nil {
		return 0, err
	}
	var status int
	if err := access.Scan(ctx, src.Binding, "SELECT status FROM "+pgx.Identifier{schema, "account"}.Sanitize()+" WHERE account_id=$1 FOR SHARE",
		[]any{pc.AccountID}, &status); err != nil || status != 1 {
		return 0, errCityCreationUnavailable
	}
	var bound int64
	if err := access.Scan(ctx, src.Binding, "SELECT account_id FROM "+pgx.Identifier{schema, "player"}.Sanitize()+
		" WHERE server_id=$1 AND player_id=$2 FOR SHARE", []any{pc.ServerID, pc.PlayerID}, &bound); err != nil || bound != pc.AccountID {
		return 0, errCityCreationUnavailable
	}
	initial := firstCityInitialState(pc.PlayerID)
	prep, err := src.Dom.Prepare(ctx, initial)
	if err != nil {
		return 0, err
	}
	defer prep.Close()
	if err := src.Dom.PinWallet(ctx, access); err != nil {
		return 0, err
	}
	if err := src.Dom.PinCityState(ctx, access); err != nil {
		return 0, err
	}
	if err := prep.LockWallet(ctx, access); err != nil {
		return 0, err
	}
	if name == "" {
		name = "MainCity"
	}
	proof, err := src.World.Insert(ctx, access, world.City{
		ServerID: pc.ServerID, PlayerID: pc.PlayerID, Name: name,
		X: x, Y: y, IsCapital: true, WallLevel: 1, Morale: 100,
	})
	if err != nil {
		return 0, err
	}
	now := time.Now
	if s.now != nil {
		now = s.now
	}
	at := now().UTC()
	init, err := src.Mil.Initialize(ctx, access, proof, at)
	if err != nil {
		return 0, err
	}
	identity, err := prep.Stage(ctx, access, init, at)
	if err != nil {
		if errors.Is(err, domestic.ErrCityAlreadyRegistered) {
			return identity.CityID, nil
		}
		return 0, err
	}
	if err := owner.Commit(ctx); err != nil {
		return 0, err
	}
	committed = true
	if err := prep.Publish(); err != nil {
		return 0, err
	}
	c := world.City{
		ServerID: pc.ServerID, PlayerID: pc.PlayerID, CityID: identity.CityID,
		Name: name, X: x, Y: y, IsCapital: true, WallLevel: 1, Morale: 100,
	}
	s.cacheCity(identity.CityID, s.citySnapshot(identity.CityID))
	s.registerNewCity(identity.CityID, c.X, c.Y)
	return identity.CityID, nil
}