package api

import (
	"context"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

func (s *Server) derivedFirstCityScope(pc PlayerContext) (*worldv1.FirstCityScope, bool) {
	if s == nil || s.firstCityV2Realm == nil {
		return nil, false
	}
	realm, ok := s.firstCityV2Realm(pc)
	if !ok {
		return nil, false
	}
	return derivedFirstCityScope(pc, realm), true
}

func (s *Server) handleDiscoverFirstCityIntent(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.DiscoverFirstCityIntentRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if len(pkt.GetPayload()) != 0 && !proto.Equal(&req, &worldv1.DiscoverFirstCityIntentRequest{}) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	scope, ok := s.derivedFirstCityScope(pc)
	if !ok {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city discovery unavailable"), nil
	}
	resp := &worldv1.DiscoverFirstCityIntentResponse{
		Scope: scope,
		Head:  &worldv1.FirstCityHead{Value: &worldv1.FirstCityHead_Empty{Empty: &worldv1.FirstCityEmpty{}}},
	}
	data, err := marshal(resp)
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "marshal failed"), nil
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSubmitFirstCity(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.SubmitFirstCityRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	derived, ok := s.derivedFirstCityScope(pc)
	if !ok {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city intake unavailable"), nil
	}
	if !firstCityScopeMatches(req.GetExpectedScope(), derived) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "scope mismatch"), nil
	}
	domainReq, ok := requestFromProposal(req.GetProposal())
	if !ok {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid proposal"), nil
	}
	derivedActor, _ := actorFromFirstCityScope(derived)
	expectedActor, ok := actorFromFirstCityScope(req.GetExpectedScope())
	if !ok {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid scope"), nil
	}
	if _, err := newFirstCityCanonical(derivedActor, expectedActor, domainReq); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid intent"), nil
	}
	// Valid representation only; ledger, template intake and execution remain unimplemented.
	return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city intake unavailable"), nil
}
