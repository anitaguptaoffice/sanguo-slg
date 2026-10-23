package assembly

import (
	"context"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

// M3 routes from CONTRACT-002; business logic lives in chat/guild/rank packages (later cards).
var m3Routes = []string{
	"chat.v1.SendChatMessage",
	"chat.v1.ListChatMessages",
	"guild.v1.CreateGuild",
	"guild.v1.JoinGuild",
	"guild.v1.LeaveGuild",
	"guild.v1.ListGuildMembers",
	"rank.v1.GetLeaderboard",
}

// M3 dispatches M3-domain WebSocket routes to registered domain handlers.
type M3 struct {
	byRoute map[string]gateway.RouteHandler
}

// NewM3 builds the assembly layer with stub handlers until CHAT/RANK/GUILD cards wire real logic.
func NewM3() *M3 {
	m := &M3{byRoute: make(map[string]gateway.RouteHandler)}
	for _, route := range m3Routes {
		m.byRoute[route] = stubHandler(route)
	}
	return m
}

// Register replaces the handler for one M3 route (used when a domain package is linked in).
func (m *M3) Register(route string, h gateway.RouteHandler) {
	if h == nil {
		return
	}
	m.byRoute[route] = h
}

// GatewayHandlers merges all M3 routes for the platform router.
func (m *M3) GatewayHandlers() map[string]gateway.RouteHandler {
	out := make(map[string]gateway.RouteHandler, len(m.byRoute))
	for k, v := range m.byRoute {
		out[k] = v
	}
	return out
}

func stubHandler(route string) gateway.RouteHandler {
	return func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		_ = ctx
		return &commonv1.ServerPacket{
			Code:    int32(commonv1.ErrorCode_COMMON_UNAVAILABLE),
			Msg:     fmt.Sprintf("%s: domain handler not wired (awaiting M3 domain card)", route),
			TraceId: pkt.GetTraceId(),
		}, nil
	}
}
