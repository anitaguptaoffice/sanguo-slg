package api

import "testing"

func TestFirstCityC1DecodeRoundTrip(t *testing.T) {
	actor, request := firstCityFixture()
	encoded := requireFirstCity(t, actor, request)
	b := encoded.bytes()
	scope, proposal, err := firstCityScopeAndProposalFromC1(b)
	if err != nil {
		t.Fatalf("%v len=%d full=%x", err, len(b), b)
	}
	if scope.GetRealmId() != actor.realm || scope.GetServerId() != int32(actor.shard) ||
		scope.GetPlayerId() != actor.player || scope.GetAccountId() != actor.account {
		t.Fatalf("scope = %+v", scope)
	}
	if proposal.GetCommandId() != request.command || proposal.GetName() != *request.name {
		t.Fatalf("proposal = %+v cmd=%q name=%q", proposal, proposal.GetCommandId(), proposal.GetName())
	}
}
