package api

import (
	"bytes"
	"context"
	"errors"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) firstCityValidatedIntent(ctx context.Context, pkt *commonv1.ClientPacket, expected *worldv1.FirstCityScope, proposal *worldv1.FirstCityProposal) (*worldv1.FirstCityScope, *firstCityRequest, *firstCityActor, *firstCityActor, *commonv1.ServerPacket) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return nil, nil, nil, nil, errPkt
	}
	derived, ok := s.derivedFirstCityScope(pc)
	if !ok {
		return nil, nil, nil, nil, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city unavailable")
	}
	if !firstCityScopeMatches(expected, derived) {
		return nil, nil, nil, nil, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "scope mismatch")
	}
	domainReq, ok := requestFromProposal(proposal)
	if !ok {
		return nil, nil, nil, nil, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid proposal")
	}
	derivedActor, ok := actorFromFirstCityScope(derived)
	if !ok {
		return nil, nil, nil, nil, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid scope")
	}
	expectedActor, ok := actorFromFirstCityScope(expected)
	if !ok {
		return nil, nil, nil, nil, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid scope")
	}
	if _, err := newFirstCityCanonical(derivedActor, expectedActor, domainReq); err != nil {
		return nil, nil, nil, nil, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid intent")
	}
	return derived, domainReq, derivedActor, expectedActor, nil
}

func (s *Server) attemptFirstCityGet(scope *worldv1.FirstCityScope, commandID string) (*worldv1.FirstCityOutcome, error) {
	if _, valid := firstCityUUID(commandID); !valid {
		return nil, errors.New("command")
	}
	head, err := s.firstCityV2Ledger.Head(scope)
	if err != nil {
		return nil, err
	}
	existing, ok, err := s.firstCityV2Ledger.Record(scope, commandID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_NOT_OBSERVED, commandID, nil, head), nil
	}
	return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND, commandID, existing, head), nil
}

func (s *Server) attemptFirstCityContinue(scope *worldv1.FirstCityScope, proposal *worldv1.FirstCityProposal, domainReq *firstCityRequest, derived, expected *firstCityActor) (*worldv1.FirstCityOutcome, error) {
	c1, err := newFirstCityCanonical(derived, expected, domainReq)
	if err != nil {
		return nil, err
	}
	id := proposal.GetCommandId()
	head, err := s.firstCityV2Ledger.Head(scope)
	if err != nil {
		return nil, err
	}
	existing, ok, err := s.firstCityV2Ledger.Record(scope, id)
	if err != nil {
		return nil, err
	}
	if !ok {
		return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_NOT_OBSERVED, id, nil, head), nil
	}
	existingC1, err := firstCityC1FromProto(existing.GetCanonical())
	if err != nil {
		return nil, err
	}
	if !bytes.Equal(c1.bytes(), existingC1) {
		return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_ID_CONTENT_CONFLICT, id, existing, head), nil
	}
	if existing.GetSucceeded() != nil || existing.GetRejectedNoEffect() != nil {
		return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND, id, existing, head), nil
	}
	if head.GetCommand() == nil || head.GetCommand().GetCanonical().GetProposal().GetCommandId() != id {
		return nil, errors.New("head mismatch")
	}
	return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND, id, existing, head), nil
}

func (s *Server) handleContinueFirstCity(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	var req worldv1.ContinueFirstCityRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	derived, domainReq, derivedActor, expectedActor, errPkt := s.firstCityValidatedIntent(ctx, pkt, req.GetExpectedScope(), req.GetProposal())
	if errPkt != nil {
		return errPkt, nil
	}
	if s.firstCityV2Ledger == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city continue unavailable"), nil
	}
	outcome, err := s.attemptFirstCityContinue(derived, req.GetProposal(), domainReq, derivedActor, expectedActor)
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city continue unavailable"), nil
	}
	data, err := marshal(&worldv1.ContinueFirstCityResponse{Outcome: outcome})
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "marshal failed"), nil
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleGetFirstCityResult(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.GetFirstCityResultRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	derived, ok := s.derivedFirstCityScope(pc)
	if !ok {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city lookup unavailable"), nil
	}
	if !firstCityScopeMatches(req.GetExpectedScope(), derived) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "scope mismatch"), nil
	}
	if s.firstCityV2Ledger == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city lookup unavailable"), nil
	}
	outcome, err := s.attemptFirstCityGet(derived, req.GetCommandId())
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city lookup unavailable"), nil
	}
	data, err := marshal(&worldv1.GetFirstCityResultResponse{Outcome: outcome})
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "marshal failed"), nil
	}
	return okResp(pkt.GetTraceId(), data), nil
}
