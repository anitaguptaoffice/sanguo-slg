package assembly_test

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/assembly"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestM3RoutesRegistered(t *testing.T) {
	m3 := assembly.NewM3()
	handlers := m3.GatewayHandlers()
	if len(handlers) < 7 {
		t.Fatalf("expected m3 routes, got %d", len(handlers))
	}
	h := handlers["rank.v1.GetLeaderboard"]
	resp, err := h(context.Background(), &commonv1.ClientPacket{Route: "rank.v1.GetLeaderboard", TraceId: "t1"})
	if err != nil {
		t.Fatal(err)
	}
	if resp.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatalf("stub code: %d", resp.GetCode())
	}
}
