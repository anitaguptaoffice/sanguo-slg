package account

import (
	"context"
	"testing"

	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

func TestGatewayLoginInvalidPayload(t *testing.T) {
	svc := NewService(nil)
	h := GatewayHandlers(svc)[RouteLogin]
	resp, err := h(context.Background(), &commonv1.ClientPacket{
		Route:   RouteLogin,
		TraceId: "t1",
		Payload: []byte{0xff},
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
		t.Fatalf("code=%d", resp.Code)
	}
}

func TestGatewayRegisterMarshalRoundTrip(t *testing.T) {
	req := &accountv1.RegisterRequest{LoginName: "u", Password: "p"}
	b, err := proto.Marshal(req)
	if err != nil {
		t.Fatal(err)
	}
	var out accountv1.RegisterRequest
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	if out.GetLoginName() != "u" {
		t.Fatal("round trip failed")
	}
}
