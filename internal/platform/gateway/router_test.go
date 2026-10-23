package gateway_test

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestDecodeEncodeRoundTrip(t *testing.T) {
	in := &commonv1.ClientPacket{Route: "account.v1.Login", TraceId: "abc", Payload: []byte{1, 2}}
	frame, err := gateway.EncodeServer(&commonv1.ServerPacket{Code: 0, TraceId: "abc"})
	if err != nil {
		t.Fatal(err)
	}
	if len(frame) == 0 {
		t.Fatal("empty frame")
	}
	out, err := gateway.DecodeClient([]byte{0x0a, 0x10, 'a', 'c', 'c', 'o', 'u', 'n', 't', '.', 'v', '1', '.', 'L', 'o', 'g', 'i', 'n'})
	if err != nil {
		t.Fatal(err)
	}
	if out.GetRoute() != in.GetRoute() {
		t.Fatalf("route %q", out.GetRoute())
	}
}

func TestRouterDispatch(t *testing.T) {
	r := gateway.NewRouter(map[string]gateway.RouteHandler{
		"demo.v1.Echo": func(_ context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return &commonv1.ServerPacket{Code: 0, Data: pkt.Payload, TraceId: pkt.TraceId}, nil
		},
	})
	resp := r.Dispatch(context.Background(), &commonv1.ClientPacket{Route: "demo.v1.Echo", Payload: []byte("hi"), TraceId: "1"})
	if resp.Code != 0 || string(resp.Data) != "hi" {
		t.Fatalf("%+v", resp)
	}
}
