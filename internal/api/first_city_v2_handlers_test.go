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
		return testFirstCityRealm, pc.PlayerID > 0 && pc.AccountID > 0 && pc.ServerID > 0
	})
	return s
}

func TestFirstCityV2Handlers(t *testing.T) {
	t.Run("default-off", func(t *testing.T) {
		router := NewServer(nil, nil, nil, nil, nil).GatewayRouter()
		for _, route := range []string{
			RouteDiscoverFirstCityIntent, RouteSubmitFirstCity,
			RouteContinueFirstCity, RouteGetFirstCityResult,
		} {
			resp := router.Dispatch(context.Background(), &commonv1.ClientPacket{Route: route, TraceId: "off"})
			if resp.GetCode() != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
				t.Fatalf("route %s %+v", route, resp)
			}
		}
	})
	bind := func(s *Server) func(trace string, payload []byte) *commonv1.ClientPacket {
		s.sessions.Bind("sess-fc", PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8})
		return func(trace string, payload []byte) *commonv1.ClientPacket {
			return &commonv1.ClientPacket{TraceId: trace, SessionId: "sess-fc", ServerId: 1, Payload: payload}
		}
	}
	t.Run("discover", func(t *testing.T) {
		s := testFirstCityV2Server(t)
		pkt := bind(s)
		out, err := s.handleDiscoverFirstCityIntent(context.Background(), pkt("t1", nil))
		if err != nil || out.GetCode() != 0 {
			t.Fatalf("discover: err=%v code=%d", err, out.GetCode())
		}
		var resp worldv1.DiscoverFirstCityIntentResponse
		if err := proto.Unmarshal(out.GetData(), &resp); err != nil {
			t.Fatal(err)
		}
		if resp.GetScope().GetRealmId() != testFirstCityRealm || resp.GetHead().GetEmpty() == nil {
			t.Fatalf("scope/head realm=%s empty=%v", resp.GetScope().GetRealmId(), resp.GetHead().GetEmpty() != nil)
		}
	})
	t.Run("discover-unavailable", func(t *testing.T) {
		s := testFirstCityV2Server(t)
		s.firstCityV2Realm = nil
		pkt := bind(s)
		out, err := s.handleDiscoverFirstCityIntent(context.Background(), pkt("t2", nil))
		if err != nil || out.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
			t.Fatalf("discover %+v", out)
		}
	})
	t.Run("submit-valid-unavailable", func(t *testing.T) {
		s := testFirstCityV2Server(t)
		pkt := bind(s)
		name, x, y := "都城", int32(12), int32(34)
		req := &worldv1.SubmitFirstCityRequest{
			ExpectedScope: derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 9, AccountID: 8}, testFirstCityRealm),
			Proposal: &worldv1.FirstCityProposal{
				CommandId: "11111111-1111-4111-8111-111111111111",
				Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
				Name: &name, X: &x, Y: &y,
			},
		}
		data, _ := marshal(req)
		out, err := s.handleSubmitFirstCity(context.Background(), pkt("t3", data))
		if err != nil || out.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
			t.Fatalf("submit %+v", out)
		}
	})
	t.Run("submit-scope-mismatch", func(t *testing.T) {
		s := testFirstCityV2Server(t)
		pkt := bind(s)
		name, x, y := "都城", int32(0), int32(0)
		req := &worldv1.SubmitFirstCityRequest{
			ExpectedScope: derivedFirstCityScope(PlayerContext{ServerID: 1, PlayerID: 10, AccountID: 8}, testFirstCityRealm),
			Proposal: &worldv1.FirstCityProposal{
				CommandId: "22222222-2222-4222-8222-222222222222",
				Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
				Name: &name, X: &x, Y: &y,
			},
		}
		data, _ := marshal(req)
		out, err := s.handleSubmitFirstCity(context.Background(), pkt("t4", data))
		if err != nil || out.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAUTHORIZED) {
			t.Fatalf("mismatch %+v", out)
		}
	})
}
