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

func TestFirstCityV2ContinueContentConflict(t *testing.T) {
	s := testFirstCityV2Persisted(t)
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	scope := derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm)
	cmd := "66666666-6666-4666-8666-666666666666"
	name, x, y := "城", int32(0), int32(0)
	prop := &worldv1.FirstCityProposal{
		CommandId: cmd,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name: &name, X: &x, Y: &y,
	}
	sub, _ := marshal(&worldv1.SubmitFirstCityRequest{ExpectedScope: scope, Proposal: prop})
	pkt := &commonv1.ClientPacket{TraceId: "s", SessionId: "sess-fc", ServerId: 1, Payload: sub}
	if out, _ := s.handleSubmitFirstCity(context.Background(), pkt); out.GetCode() != 0 {
		t.Fatal(out)
	}
	y = 1
	prop.Y = &y
	cont, _ := marshal(&worldv1.ContinueFirstCityRequest{ExpectedScope: scope, Proposal: prop})
	pkt.Payload = cont
	out, _ := s.handleContinueFirstCity(context.Background(), pkt)
	var body worldv1.ContinueFirstCityResponse
	_ = unmarshal(out.GetData(), &body)
	if body.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_ID_CONTENT_CONFLICT {
		t.Fatalf("continue conflict %+v", body.GetOutcome())
	}
}

func TestFirstCityV2ContinueTerminalCommand(t *testing.T) {
	scope := derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm)
	tpl := &worldv1.FirstCityTemplateRef{
		TemplateVersion: "dom-first-city-1", RulesVersion: "first-city-rules-1", CatalogVersion: "dom-default-1",
		ContentEncodingVersion: 1, ContentSha256: make([]byte, 32),
	}
	for name, terminal := range map[string]func(string, *worldv1.FirstCityProposal) *worldv1.FirstCityRecord{
		"rejected": func(id string, prop *worldv1.FirstCityProposal) *worldv1.FirstCityRecord {
			canon, _ := firstCityCanonicalMessage(scope, prop)
			return &worldv1.FirstCityRecord{
				Canonical: canon, Template: tpl,
				State: &worldv1.FirstCityRecord_RejectedNoEffect{
					RejectedNoEffect: &worldv1.FirstCityRejection{Reason: worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_TERRAIN},
				},
			}
		},
		"succeeded": func(id string, prop *worldv1.FirstCityProposal) *worldv1.FirstCityRecord {
			canon, _ := firstCityCanonicalMessage(scope, prop)
			capital, wall, morale := true, int32(1), int32(100)
			return &worldv1.FirstCityRecord{
				Canonical: canon, Template: tpl,
				State: &worldv1.FirstCityRecord_Succeeded{Succeeded: &worldv1.FirstCitySuccess{
					CityId: 42, ServerId: 1, PlayerId: 9, IsCapital: &capital, WallLevel: &wall, Morale: &morale,
				}},
			}
		},
	} {
		t.Run(name, func(t *testing.T) {
			s := testFirstCityV2Persisted(t)
			s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
			cmd := map[string]string{"rejected": "77777777-7777-4777-8777-777777777777", "succeeded": "88888888-8888-4888-8888-888888888888"}[name]
			n, x, y := "城", int32(3), int32(4)
			prop := &worldv1.FirstCityProposal{
				CommandId: cmd,
				Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
				Name: &n, X: &x, Y: &y,
			}
			ledger := s.firstCityV2Ledger.(*memFirstCityLedger)
			ledger.installTestRecord(scope, terminal(cmd, prop))
			cont, _ := marshal(&worldv1.ContinueFirstCityRequest{ExpectedScope: scope, Proposal: prop})
			out, _ := s.handleContinueFirstCity(context.Background(), &commonv1.ClientPacket{
				TraceId: name, SessionId: "sess-fc", ServerId: 1, Payload: cont,
			})
			var body worldv1.ContinueFirstCityResponse
			_ = unmarshal(out.GetData(), &body)
			if body.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND {
				t.Fatalf("kind %+v", body.GetOutcome())
			}
			rec := body.GetOutcome().GetCommand()
			if name == "rejected" {
				if rec.GetRejectedNoEffect() == nil || rec.GetPending() != nil || rec.GetSucceeded() != nil {
					t.Fatal("expected rejected terminal")
				}
			} else if rec.GetSucceeded() == nil || rec.GetPending() != nil {
				t.Fatal("expected succeeded terminal")
			}
		})
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
	name, x, y := "城", int32(0), int32(0)
	prop := &worldv1.FirstCityProposal{
		CommandId: "99999999-9999-4999-8999-999999999999",
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name: &name, X: &x, Y: &y,
	}
	cont, _ := marshal(&worldv1.ContinueFirstCityRequest{ExpectedScope: scope, Proposal: prop})
	out, _ = s.handleContinueFirstCity(context.Background(), &commonv1.ClientPacket{
		SessionId: "sess-fc", ServerId: 1, TraceId: "c", Payload: cont,
	})
	if out.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatal(out)
	}
}
