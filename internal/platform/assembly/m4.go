package assembly

import (
	"context"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

// M4 routes from CONTRACT-003 (quest / shop); handlers wired in internal/api.
var m4Routes = []string{
	"quest.v1.ListPlayerQuests",
	"quest.v1.AcceptQuest",
	"quest.v1.ReportQuestProgress",
	"quest.v1.ClaimQuestReward",
	"quest.v1.GetQuestChainStatus",
	"shop.v1.ListShopShelf",
	"shop.v1.PurchaseShopOffer",
}

// M4 dispatches M4 WebSocket routes until INTG-004 registers real handlers.
type M4 struct {
	byRoute map[string]gateway.RouteHandler
}

// NewM4 builds stub handlers replaced by api.Server.WireM4Content.
func NewM4() *M4 {
	m := &M4{byRoute: make(map[string]gateway.RouteHandler)}
	for _, route := range m4Routes {
		m.byRoute[route] = m4Stub(route)
	}
	return m
}

// Register replaces one route handler.
func (m *M4) Register(route string, h gateway.RouteHandler) {
	if h == nil {
		return
	}
	m.byRoute[route] = h
}

// GatewayHandlers merges M4 routes for the platform router.
func (m *M4) GatewayHandlers() map[string]gateway.RouteHandler {
	out := make(map[string]gateway.RouteHandler, len(m.byRoute))
	for k, v := range m.byRoute {
		out[k] = v
	}
	return out
}

func m4Stub(route string) gateway.RouteHandler {
	return func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		_ = ctx
		return &commonv1.ServerPacket{
			Code:    int32(commonv1.ErrorCode_COMMON_UNAVAILABLE),
			Msg:     fmt.Sprintf("%s: not wired (awaiting INTG-004)", route),
			TraceId: pkt.GetTraceId(),
		}, nil
	}
}
