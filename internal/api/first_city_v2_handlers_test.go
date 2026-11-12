package api

import (
	"context"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

const testFirstCityRealm = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

func testFirstCityV2Server(t *testing.T) *Server {
	t.Helper()
	s := NewServer(nil, nil, nil, nil, nil)
	s.EnableFirstCityV2Routes(func(pc PlayerContext) (string, bool) {
		if pc.PlayerID <= 0 || pc.AccountID <= 0 || pc.ServerID <= 0 {
			return "", false
		}
		return testFirstCityRealm, true
	})
	return s
}

func TestFirstCityV2RoutesDefaultOff(t *testing.T) {
	s := NewServer(nil, nil, nil, nil, nil)
	resp := s.GatewayRouter().Dispatch(context.Background(), &commonv1.ClientPacket{
		Route: RouteDiscoverFirstCityIntent, TraceId: "off",
	})
	if resp.GetCode() != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
		t.Fatalf("expected unknown route, got %+v", resp)
	}
}

func TestDiscoverFirstCityIntent(t *testing.T) {
	s := testFirstCityV2Server(t)
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	ctx := context.Background()
	out, err := s.handleDiscoverFirstCityIntent(ctx, &commonv1.ClientPacket{TraceId: "t1", SessionId: "sess-fc", ServerId: 1})
	if err != nil {
		t.Fatal(err)
	}
	if out.GetCode() != 0 {
		t.Fatalf("discover: %+v", out)
	}
	var resp worldv1.DiscoverFirstCityIntentResponse
	if err := proto.Unmarshal(out.GetData(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.GetScope().GetRealmId() != testFirstCityRealm || resp.GetScope().GetServerId() != 1 || resp.GetScope().GetPlayerId() != 9 {
		t.Fatalf("scope: %+v", resp.GetScope())
	}
	if resp.GetHead().GetEmpty() == nil {
		t.Fatal("expected empty head")
	}
}

func TestDiscoverFirstCityIntentUnavailable(t *testing.T) {
	s := testFirstCityV2Server(t)
	s.firstCityV2Realm = nil
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	out, err := s.handleDiscoverFirstCityIntent(context.Background(), &commonv1.ClientPacket{TraceId: "t2", SessionId: "sess-fc", ServerId: 1})
	if err != nil {
		t.Fatal(err)
	}
	if out.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatalf("discover unavailable: %+v", out)
	}
}

func TestSubmitFirstCityValidationUnavailable(t *testing.T) {
	s := testFirstCityV2Server(t)
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	ctx := context.Background()
	name, x, y := "都城", int32(12), int32(34)
	req := &worldv1.SubmitFirstCityRequest{
		ExpectedScope: derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm),
		Proposal: &worldv1.FirstCityProposal{
			CommandId:  "11111111-1111-4111-8111-111111111111",
			Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
			Name:       &name,
			X:          &x,
			Y:          &y,
		},
	}
	data, err := marshal(req)
	if err != nil {
		t.Fatal(err)
	}
	out, err := s.handleSubmitFirstCity(ctx, &commonv1.ClientPacket{TraceId: "t3", SessionId: "sess-fc", ServerId: 1, Payload: data})
	if err != nil {
		t.Fatal(err)
	}
	if out.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatalf("submit unavailable: %+v", out)
	}
}

func TestSubmitFirstCityScopeMismatch(t *testing.T) {
	s := testFirstCityV2Server(t)
	s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
	ctx := context.Background()
	badScope := derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 10, AccountID: 8}, testFirstCityRealm)
	name, x, y := "都城", int32(0), int32(0)
	req := &worldv1.SubmitFirstCityRequest{
		ExpectedScope: badScope,
		Proposal: &worldv1.FirstCityProposal{
			CommandId:  "22222222-2222-4222-8222-222222222222",
			Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
			Name:       &name,
			X:          &x,
			Y:          &y,
		},
	}
	data, err := marshal(req)
	if err != nil {
		t.Fatal(err)
	}
	out, err := s.handleSubmitFirstCity(ctx, &commonv1.ClientPacket{TraceId: "t4", SessionId: "sess-fc", ServerId: 1, Payload: data})
	if err != nil {
		t.Fatal(err)
	}
	if out.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAUTHORIZED) {
		t.Fatalf("scope mismatch: %+v", out)
	}
}
