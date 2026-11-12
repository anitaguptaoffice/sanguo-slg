package api

import (
	"context"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestFirstCityV2MemGetAndContinue(t *testing.T) {
	s := testFirstCityV2Persisted(t)
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	scope := derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm)
	pkt := func(trace string, payload []byte) *commonv1.ClientPacket {
		return &commonv1.ClientPacket{TraceId: trace, SessionId: "sess-fc", ServerId: 1, Payload: payload}
	}
	cmd := "33333333-3333-4333-8333-333333333333"
	name, x, y := "城", int32(0), int32(499)
	prop := &worldv1.FirstCityProposal{
		CommandId: cmd,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name: &name, X: &x, Y: &y,
	}
	getReq, _ := marshal(&worldv1.GetFirstCityResultRequest{ExpectedScope: scope, CommandId: cmd})
	out, err := s.handleGetFirstCityResult(context.Background(), pkt("get-miss", getReq))
	if err != nil || out.GetCode() != 0 {
		t.Fatal(out, err)
	}
	var getBody worldv1.GetFirstCityResultResponse
	_ = unmarshal(out.GetData(), &getBody)
	if getBody.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_NOT_OBSERVED {
		t.Fatalf("get miss %+v", getBody.GetOutcome())
	}
	subReq, _ := marshal(&worldv1.SubmitFirstCityRequest{ExpectedScope: scope, Proposal: prop})
	if out, _ = s.handleSubmitFirstCity(context.Background(), pkt("sub", subReq)); out.GetCode() != 0 {
		t.Fatal(out)
	}
	out, _ = s.handleGetFirstCityResult(context.Background(), pkt("get-hit", getReq))
	_ = unmarshal(out.GetData(), &getBody)
	if getBody.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND ||
		getBody.GetOutcome().GetCommand().GetPending() == nil {
		t.Fatalf("get hit %+v", getBody.GetOutcome())
	}
	contReq, _ := marshal(&worldv1.ContinueFirstCityRequest{ExpectedScope: scope, Proposal: prop})
	out, _ = s.handleContinueFirstCity(context.Background(), pkt("cont", contReq))
	var contBody worldv1.ContinueFirstCityResponse
	_ = unmarshal(out.GetData(), &contBody)
	if contBody.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND ||
		contBody.GetOutcome().GetCommand().GetSucceeded() != nil {
		t.Fatalf("continue %+v", contBody.GetOutcome())
	}
}

func TestFirstCityV2ContinueNotObserved(t *testing.T) {
	s := testFirstCityV2Persisted(t)
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	scope := derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm)
	name, x, y := "城", int32(1), int32(1)
	prop := &worldv1.FirstCityProposal{
		CommandId: "44444444-4444-4444-8444-444444444444",
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name: &name, X: &x, Y: &y,
	}
	data, _ := marshal(&worldv1.ContinueFirstCityRequest{ExpectedScope: scope, Proposal: prop})
	out, _ := s.handleContinueFirstCity(context.Background(), &commonv1.ClientPacket{
		TraceId: "c", SessionId: "sess-fc", ServerId: 1, Payload: data,
	})
	var body worldv1.ContinueFirstCityResponse
	_ = unmarshal(out.GetData(), &body)
	if body.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_NOT_OBSERVED {
		t.Fatalf("%+v", body.GetOutcome())
	}
}

func TestFirstCityV2ResultUnavailableWithoutLedger(t *testing.T) {
	s := testFirstCityV2Server(t)
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	scope := derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm)
	get, _ := marshal(&worldv1.GetFirstCityResultRequest{ExpectedScope: scope, CommandId: "55555555-5555-4555-8555-555555555555"})
	out, _ := s.handleGetFirstCityResult(context.Background(), &commonv1.ClientPacket{
		SessionId: "sess-fc", ServerId: 1, TraceId: "g", Payload: get,
	})
	if out.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatal(out)
	}
}
