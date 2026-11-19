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

// settleFirstCityEffectPreparedPG folds PreparedCity placement and PG ledger terminal
// receipt into one recruit binding transaction when a PG ledger is installed.
func (s *Server) settleFirstCityEffectPreparedPG(ctx context.Context, scope *worldv1.FirstCityScope, pending *worldv1.FirstCityRecord, ledger *pgFirstCityLedger) *worldv1.FirstCityRecord {
	src := s.firstCityPrepared
	if src == nil || ledger == nil || pending == nil || pending.GetCanonical() == nil {
		return pending
	}
	txCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	proposal := pending.GetCanonical().GetProposal()
	pc := PlayerContext{AccountID: scope.GetAccountId(), ServerID: scope.GetServerId(), PlayerID: scope.GetPlayerId()}
	name := proposal.GetName()
	x, y := int(proposal.GetX()), int(proposal.GetY())

	owner, err := src.Binding.Begin(txCtx)
	if err != nil {
		s.log.ErrorContext(ctx, "first-city prepared begin failed", "error", err)
		return pending
	}
	committed := false
	defer func() {
		if !committed {
			_ = owner.Rollback(context.Background())
		}
	}()
	access := owner.Access()
	schema := src.Profile.SchemaName
	if err := firstCityPreparedTxnPath(txCtx, access, src.Binding, schema); err != nil {
		s.log.ErrorContext(ctx, "first-city prepared search_path failed", "error", err)
		return pending
	}
	if err := firstCityPreparedActorLocks(txCtx, access, src.Binding, schema); err != nil {
		s.log.ErrorContext(ctx, "first-city prepared actor locks failed", "error", err)
		return pending
	}
	if err := src.World.Pin(txCtx, access); err != nil {
		s.log.ErrorContext(ctx, "first-city prepared world pin failed", "error", err)
		return pending
	}
	if err := src.Mil.Pin(txCtx, access); err != nil {
		s.log.ErrorContext(ctx, "first-city prepared mil pin failed", "error", err)
		return pending
	}
	var status int
	if err := access.Scan(txCtx, src.Binding, "SELECT status FROM "+pgx.Identifier{schema, "account"}.Sanitize()+" WHERE account_id=$1 FOR SHARE",
		[]any{pc.AccountID}, &status); err != nil || status != 1 {
		s.log.ErrorContext(ctx, "first-city prepared account check failed", "error", err)
		return pending
	}
	var bound int64
	if err := access.Scan(txCtx, src.Binding, "SELECT account_id FROM "+pgx.Identifier{schema, "player"}.Sanitize()+
		" WHERE server_id=$1 AND player_id=$2 FOR SHARE", []any{pc.ServerID, pc.PlayerID}, &bound); err != nil || bound != pc.AccountID {
		s.log.ErrorContext(ctx, "first-city prepared player check failed", "error", err)
		return pending
	}
	initial := firstCityInitialState(pc.PlayerID)
	prep, err := src.Dom.Prepare(txCtx, initial)
	if err != nil {
		s.log.ErrorContext(ctx, "first-city prepared dom prepare failed", "error", err)
		return pending
	}
	defer prep.Close()
	if err := src.Dom.PinWallet(txCtx, access); err != nil {
		s.log.ErrorContext(ctx, "first-city prepared dom wallet pin failed", "error", err)
		return pending
	}
	if err := src.Dom.PinCityState(txCtx, access); err != nil {
		s.log.ErrorContext(ctx, "first-city prepared dom city pin failed", "error", err)
		return pending
	}
	if err := prep.LockWallet(txCtx, access); err != nil {
		s.log.ErrorContext(ctx, "first-city prepared lock wallet failed", "error", err)
		return pending
	}
	if name == "" {
		name = "MainCity"
	}
	proof, err := src.World.Insert(txCtx, access, world.City{
		ServerID: pc.ServerID, PlayerID: pc.PlayerID, Name: name,
		X: x, Y: y, IsCapital: true, WallLevel: 1, Morale: 100,
	})
	if err != nil {
		var reason worldv1.FirstCityRejectionReason
		switch {
		case errors.Is(err, world.ErrOccupied):
			reason = worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_COORDINATE_OCCUPIED
		case errors.Is(err, world.ErrBadTerrain), errors.Is(err, world.ErrOutOfBounds):
			reason = worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_TERRAIN
		default:
			s.log.ErrorContext(ctx, "first-city prepared world insert failed", "error", err)
			return pending
		}
		next, settleErr := s.completePreparedLedgerTxn(txCtx, owner, &committed, nil, scope, pending, ledger, 0, reason)
		if settleErr != nil {
			s.log.ErrorContext(ctx, "first-city prepared rejected settle failed", "error", settleErr)
			return pending
		}
		return next
	}
	now := time.Now
	if s.now != nil {
		now = s.now
	}
	at := now().UTC()
	init, err := src.Mil.Initialize(txCtx, access, proof, at)
	if err != nil {
		s.log.ErrorContext(ctx, "first-city prepared mil initialize failed", "error", err)
		return pending
	}
	identity, err := prep.Stage(txCtx, access, init, at)
	if err != nil {
		if errors.Is(err, domestic.ErrCityAlreadyRegistered) {
			next, settleErr := s.completePreparedLedgerTxn(txCtx, owner, &committed, prep, scope, pending, ledger, identity.CityID,
				worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED)
			if settleErr != nil {
				s.log.ErrorContext(ctx, "first-city prepared idempotent settle failed", "error", settleErr)
				return pending
			}
			return next
		}
		s.log.ErrorContext(ctx, "first-city prepared dom stage failed", "error", err)
		return pending
	}
	next, err := s.completePreparedLedgerTxn(txCtx, owner, &committed, prep, scope, pending, ledger, identity.CityID,
		worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED)
	if err != nil {
		s.log.ErrorContext(ctx, "first-city prepared ledger commit failed", "error", err)
		return pending
	}
	c := world.City{
		ServerID: pc.ServerID, PlayerID: pc.PlayerID, CityID: identity.CityID,
		Name: name, X: x, Y: y, IsCapital: true, WallLevel: 1, Morale: 100,
	}
	s.cacheCity(identity.CityID, s.citySnapshot(identity.CityID))
	s.registerNewCity(identity.CityID, c.X, c.Y)
	return next
}

func (s *Server) completePreparedLedgerTxn(
	ctx context.Context,
	owner *recruittx.Owner,
	committed *bool,
	prep *domestic.PreparedCity,
	scope *worldv1.FirstCityScope,
	pending *worldv1.FirstCityRecord,
	ledger *pgFirstCityLedger,
	cityID int64,
	reason worldv1.FirstCityRejectionReason,
) (*worldv1.FirstCityRecord, error) {
	next := &worldv1.FirstCityRecord{Canonical: pending.GetCanonical(), Template: pending.GetTemplate()}
	proposal := pending.GetCanonical().GetProposal()
	if reason == worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED {
		next.State = &worldv1.FirstCityRecord_Succeeded{Succeeded: &worldv1.FirstCitySuccess{
			CityId: cityID, ServerId: scope.GetServerId(), PlayerId: scope.GetPlayerId(),
			IsCapital: boolPtr(true), WallLevel: int32Ptr(1), Morale: int32Ptr(100),
		}}
	} else {
		next.State = &worldv1.FirstCityRecord_RejectedNoEffect{RejectedNoEffect: &worldv1.FirstCityRejection{Reason: reason}}
	}
	if err := owner.Undertx(ctx, func(call context.Context, tx pgx.Tx) error {
		return ledger.settleOnTx(call, tx, scope, proposal.GetCommandId(), next)
	}); err != nil {
		return pending, err
	}
	if err := owner.Commit(ctx); err != nil {
		return pending, err
	}
	*committed = true
	if prep != nil && reason == worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED {
		if err := prep.Publish(); err != nil {
			return pending, err
		}
	}
	return next, nil
}
