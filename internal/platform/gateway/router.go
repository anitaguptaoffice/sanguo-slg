package gateway

import (
	"context"

	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

// RouteHandler handles one business route; gateway does not interpret payload.
type RouteHandler func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error)

// Router dispatches by ClientPacket.route.
type Router struct {
	handlers map[string]RouteHandler
}

// NewRouter builds a route table.
func NewRouter(handlers map[string]RouteHandler) *Router {
	if handlers == nil {
		handlers = map[string]RouteHandler{}
	}
	return &Router{handlers: handlers}
}

// Dispatch returns a handler response or a standard gateway error packet.
func (r *Router) Dispatch(ctx context.Context, pkt *commonv1.ClientPacket) *commonv1.ServerPacket {
	trace := pkt.GetTraceId()
	if pkt.GetRoute() == RoutePing {
		return okPacket(trace, nil)
	}
	h, ok := r.handlers[pkt.GetRoute()]
	if !ok {
		return errPacket(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "unknown route")
	}
	resp, err := h(ctx, pkt)
	if err != nil {
		return errPacket(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
	if resp == nil {
		return okPacket(trace, nil)
	}
	if resp.TraceId == "" {
		resp.TraceId = trace
	}
	return resp
}

func okPacket(trace string, data []byte) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: 0, TraceId: trace, Data: data}
}

func errPacket(trace string, code commonv1.ErrorCode, msg string) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{
		Code:    int32(code),
		Msg:     msg,
		TraceId: trace,
	}
}

// DecodeClient unmarshals a binary WebSocket frame into ClientPacket.
func DecodeClient(frame []byte) (*commonv1.ClientPacket, error) {
	var pkt commonv1.ClientPacket
	if err := proto.Unmarshal(frame, &pkt); err != nil {
		return nil, err
	}
	return &pkt, nil
}

// EncodeServer serializes ServerPacket for the wire.
func EncodeServer(pkt *commonv1.ServerPacket) ([]byte, error) {
	return proto.Marshal(pkt)
}
