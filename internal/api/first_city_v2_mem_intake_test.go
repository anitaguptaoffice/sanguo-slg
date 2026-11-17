package api

import (
	"context"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

type testFirstCityIntake struct{ ref *worldv1.FirstCityTemplateRef }

func (t testFirstCityIntake) SelectTemplate(context.Context, *worldv1.FirstCityScope) (*worldv1.FirstCityTemplateRef, error) {
	if t.ref == nil {
		return nil, errFirstCityDerivedScope
	}
	return t.ref, nil
}

func testFirstCityV2Persisted(t *testing.T) *Server {
	t.Helper()
	s := testFirstCityV2Server(t)
	s.WireFirstCityV2Ledger(NewMemFirstCityLedger(), testFirstCityIntake{ref: &worldv1.FirstCityTemplateRef{
		TemplateVersion: "dom-first-city-1", RulesVersion: "first-city-rules-1", CatalogVersion: "dom-default-1",
		ContentEncodingVersion: 1, ContentSha256: make([]byte, 32),
	}})
	return s
}

func TestFirstCityV2MemIntakePending(t *testing.T) {
	s := testFirstCityV2Persisted(t)
	bind := func(s *Server) func(trace string, payload []byte) *commonv1.ClientPacket {
		s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
		return func(trace string, payload []byte) *commonv1.ClientPacket {
			return &commonv1.ClientPacket{TraceId: trace, SessionId: "sess-fc", ServerId: 1, Payload: payload}
		}
	}
	pkt := bind(s)
	name, x, y := "都城", int32(12), int32(34)
	cmd := "11111111-1111-4111-8111-111111111111"
	req := &worldv1.SubmitFirstCityRequest{
		ExpectedScope: derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm),
		Proposal: &worldv1.FirstCityProposal{
			CommandId: cmd,
			Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
			Name: &name, X: &x, Y: &y,
		},
	}
	data, _ := marshal(req)
	out, err := s.handleSubmitFirstCity(context.Background(), pkt("submit", data))
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("submit %+v err=%v", out, err)
	}
	var sub worldv1.SubmitFirstCityResponse
	if err := unmarshal(out.GetData(), &sub); err != nil {
		t.Fatal(err)
	}
	if sub.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND ||
		sub.GetOutcome().GetCommand().GetPending() == nil {
		t.Fatalf("outcome %+v", sub.GetOutcome())
	}
	disc, err := s.handleDiscoverFirstCityIntent(context.Background(), pkt("disc", nil))
	if err != nil || disc.GetCode() != 0 {
		t.Fatal(disc, err)
	}
	var discBody worldv1.DiscoverFirstCityIntentResponse
	if err := unmarshal(disc.GetData(), &discBody); err != nil {
		t.Fatal(err)
	}
	if discBody.GetHead().GetCommand() == nil || discBody.GetHead().GetCommand().GetCanonical().GetProposal().GetCommandId() != cmd {
		t.Fatal("discover head")
	}
	out2, _ := s.handleSubmitFirstCity(context.Background(), pkt("replay", data))
	var sub2 worldv1.SubmitFirstCityResponse
	_ = unmarshal(out2.GetData(), &sub2)
	if sub2.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND {
		t.Fatalf("replay %+v", sub2.GetOutcome())
	}
}

func TestFirstCityV2MemIntakeContentConflict(t *testing.T) {
	s := testFirstCityV2Persisted(t)
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	name, x, y := "都城", int32(0), int32(0)
	base := &worldv1.SubmitFirstCityRequest{
		ExpectedScope: derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm),
		Proposal: &worldv1.FirstCityProposal{
			CommandId: "22222222-2222-4222-8222-222222222222",
			Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
			Name: &name, X: &x, Y: &y,
		},
	}
	d0, _ := marshal(base)
	pkt := &commonv1.ClientPacket{TraceId: "a", SessionId: "sess-fc", ServerId: 1, Payload: d0}
	if out, _ := s.handleSubmitFirstCity(context.Background(), pkt); out.GetCode() != 0 {
		t.Fatal(out)
	}
	badY := int32(1)
	base.Proposal.Y = &badY
	d1, _ := marshal(base)
	pkt.Payload = d1
	out, _ := s.handleSubmitFirstCity(context.Background(), pkt)
	if out.GetCode() != 0 {
		t.Fatal(out)
	}
	var sub worldv1.SubmitFirstCityResponse
	_ = unmarshal(out.GetData(), &sub)
	if sub.GetOutcome().GetKind() != worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_ID_CONTENT_CONFLICT {
		t.Fatalf("conflict %+v", sub.GetOutcome())
	}
}
