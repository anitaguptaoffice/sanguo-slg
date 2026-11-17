package api

import (
	"context"
	"errors"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

// errFirstCityEffectRejected reports an effect that refused the intent with a typed reason.
var errFirstCityEffectRejected = errors.New("api: first-city effect rejected") //nolint:unused // reserved for effect rejection wiring

// FirstCityV2Effect materializes one accepted first-city intent into a real city.
// It runs after durable PENDING intake and must be idempotent per command id: a
// repeat of the same canonical intent may return the already created city.
type FirstCityV2Effect interface {
	// Create returns the created city id, or one typed rejection reason.
	// A non-nil error means the outcome is unknown and the record must stay PENDING.
	Create(ctx context.Context, scope *worldv1.FirstCityScope, proposal *worldv1.FirstCityProposal) (int64, worldv1.FirstCityRejectionReason, error)
}

// WireFirstCityV2Effect installs the creation effect. A nil effect keeps Submit
// fail-closed at COMMON_UNAVAILABLE.
func (s *Server) WireFirstCityV2Effect(effect FirstCityV2Effect) {
	s.firstCityV2Effect = effect
}

// FirstCityCreationEffect builds the effect that places the city through the same
// DOM/WORLD atomic creation path as world.v1.CreateCity, or PreparedCity when wired.
func (s *Server) FirstCityCreationEffect() FirstCityV2Effect {
	if s.firstCityPrepared != nil {
		return firstCityPreparedCreationEffect{srv: s}
	}
	return firstCityCreationEffect{srv: s}
}

type firstCityCreationEffect struct {
	srv *Server
}

func (e firstCityCreationEffect) Create(ctx context.Context, scope *worldv1.FirstCityScope, proposal *worldv1.FirstCityProposal) (int64, worldv1.FirstCityRejectionReason, error) {
	if e.srv == nil || scope == nil || proposal == nil {
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED, errCityCreationUnavailable
	}
	city, err := e.srv.createPlayerCity(ctx, PlayerContext{
		AccountID: scope.GetAccountId(),
		ServerID:  scope.GetServerId(),
		PlayerID:  scope.GetPlayerId(),
	}, proposal.GetName(), int(proposal.GetX()), int(proposal.GetY()))
	switch {
	case err == nil:
		return city.CityID, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED, nil
	case errors.Is(err, world.ErrOccupied):
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_COORDINATE_OCCUPIED, nil
	case errors.Is(err, world.ErrBadTerrain), errors.Is(err, world.ErrOutOfBounds):
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_TERRAIN, nil
	default:
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED, err
	}
}

// settleFirstCityEffect folds the effect result into the durable record and returns
// the authoritative record for the response. Unknown outcomes keep PENDING.
func (s *Server) settleFirstCityEffect(ctx context.Context, scope *worldv1.FirstCityScope, pending *worldv1.FirstCityRecord) *worldv1.FirstCityRecord {
	if s.firstCityV2Effect == nil || pending == nil || pending.GetCanonical() == nil {
		return pending
	}
	if s.firstCityPrepared != nil {
		if ledger, ok := s.firstCityV2Ledger.(*pgFirstCityLedger); ok {
			return s.settleFirstCityEffectPreparedPG(ctx, scope, pending, ledger)
		}
	}
	proposal := pending.GetCanonical().GetProposal()
	cityID, reason, err := s.firstCityV2Effect.Create(ctx, scope, proposal)
	if err != nil {
		s.log.ErrorContext(ctx, "first-city effect failed", "server_id", scope.GetServerId(),
			"player_id", scope.GetPlayerId(), "error", err)
		return pending
	}
	next := &worldv1.FirstCityRecord{Canonical: pending.GetCanonical(), Template: pending.GetTemplate()}
	if reason == worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED {
		next.State = &worldv1.FirstCityRecord_Succeeded{Succeeded: &worldv1.FirstCitySuccess{
			CityId: cityID, ServerId: scope.GetServerId(), PlayerId: scope.GetPlayerId(),
			IsCapital: boolPtr(true), WallLevel: int32Ptr(1), Morale: int32Ptr(100),
		}}
	} else {
		next.State = &worldv1.FirstCityRecord_RejectedNoEffect{RejectedNoEffect: &worldv1.FirstCityRejection{Reason: reason}}
	}
	commandID := proposal.GetCommandId()
	if err := s.firstCityV2Ledger.Settle(ctx, scope, commandID, next); err != nil {
		s.log.ErrorContext(ctx, "first-city settle failed", "server_id", scope.GetServerId(),
			"player_id", scope.GetPlayerId(), "error", err)
		return pending
	}
	return next
}

func boolPtr(v bool) *bool    { return &v }
func int32Ptr(v int32) *int32 { return &v }
