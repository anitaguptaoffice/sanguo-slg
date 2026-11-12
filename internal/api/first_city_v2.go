package api

import (
	"context"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

const (
	RouteDiscoverFirstCityIntent = "world.v2.DiscoverFirstCityIntent"
	RouteSubmitFirstCity         = "world.v2.SubmitFirstCity"
)

type FirstCityV2Realm func(PlayerContext) (realmID string, ok bool)

func (s *Server) EnableFirstCityV2Routes(realm FirstCityV2Realm) {
	s.firstCityV2Routes = true
	s.firstCityV2Realm = realm
}

func actorFromFirstCityScope(scope *worldv1.FirstCityScope) (*firstCityActor, bool) {
	if scope == nil {
		return nil, false
	}
	actor := &firstCityActor{
		realm: scope.GetRealmId(), shard: int64(scope.GetServerId()),
		player: scope.GetPlayerId(), account: scope.GetAccountId(),
	}
	if !validFirstCityActor(actor) {
		return nil, false
	}
	return actor, true
}

func derivedFirstCityScope(pc PlayerContext, realm string) *worldv1.FirstCityScope {
	return &worldv1.FirstCityScope{
		RealmId: realm, ServerId: pc.ServerID, PlayerId: pc.PlayerID, AccountId: pc.AccountID,
	}
}

func firstCityScopeMatches(expected, derived *worldv1.FirstCityScope) bool {
	if expected == nil || derived == nil {
		return false
	}
	return expected.GetRealmId() == derived.GetRealmId() &&
		expected.GetServerId() == derived.GetServerId() &&
		expected.GetPlayerId() == derived.GetPlayerId() &&
		expected.GetAccountId() == derived.GetAccountId()
}

func requestFromProposal(p *worldv1.FirstCityProposal) (*firstCityRequest, bool) {
	if p == nil || p.GetPredecessor() == nil {
		return nil, false
	}
	req := &firstCityRequest{command: p.GetCommandId()}
	switch v := p.GetPredecessor().GetValue().(type) {
	case *worldv1.FirstCityPredecessor_Empty:
		req.prior = &firstCityPrior{empty: v != nil}
	case *worldv1.FirstCityPredecessor_RejectedCommandId:
		if v == nil {
			return nil, false
		}
		id := v.RejectedCommandId
		req.prior = &firstCityPrior{rejected: &id}
	default:
		return nil, false
	}
	if name := p.Name; name != nil {
		req.name = name
	}
	if x := p.X; x != nil {
		v := int64(*x)
		req.x = &v
	}
	if y := p.Y; y != nil {
		v := int64(*y)
		req.y = &v
	}
	return req, true
}

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
	return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "first-city intake unavailable"), nil
}
