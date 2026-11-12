package api

import (
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
)

func actorFromFirstCityScope(scope *worldv1.FirstCityScope) (*firstCityActor, bool) {
	if scope == nil {
		return nil, false
	}
	actor := &firstCityActor{
		realm:   scope.GetRealmId(),
		shard:   int64(scope.GetServerId()),
		player:  scope.GetPlayerId(),
		account: scope.GetAccountId(),
	}
	if !validFirstCityActor(actor) {
		return nil, false
	}
	return actor, true
}

func derivedFirstCityScope(pc PlayerContext, realm string) *worldv1.FirstCityScope {
	return &worldv1.FirstCityScope{
		RealmId:   realm,
		ServerId:  pc.ServerID,
		PlayerId:  pc.PlayerID,
		AccountId: pc.AccountID,
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
