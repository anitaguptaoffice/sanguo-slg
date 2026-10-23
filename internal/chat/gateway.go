package chat

import (
	"context"
	"errors"

	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

const (
	RouteSendChatMessage  = "chat.v1.SendChatMessage"
	RouteListChatMessages = "chat.v1.ListChatMessages"

	// spec/proto/sanguo/common/v1/envelope.proto (61000–61999)
	errCodeChatChannelForbidden   commonv1.ErrorCode = 61001
	errCodeChatContentTooLong     commonv1.ErrorCode = 61002
	errCodeChatRateLimited        commonv1.ErrorCode = 61003
	errCodeChatRecipientNotFound  commonv1.ErrorCode = 61004
)

// SessionResolver maps gateway session_id to the active shard player.
type SessionResolver interface {
	ActorForSession(ctx context.Context, sessionID string) (Actor, error)
}

// GatewayHandlers registers chat routes on the WebSocket gateway.
func GatewayHandlers(svc *Service, sessions SessionResolver) map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteSendChatMessage: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleSend(ctx, pkt, svc, sessions)
		},
		RouteListChatMessages: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleList(ctx, pkt, svc, sessions)
		},
	}
}

func handleSend(ctx context.Context, pkt *commonv1.ClientPacket, svc *Service, sessions SessionResolver) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	actor, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
	if err != nil {
		return chatErr(trace, err), nil
	}
	var req chatv1.SendChatMessageRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := svc.Send(ctx, actor, &req)
	if err != nil {
		return chatErr(trace, err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(trace, data), nil
}

func handleList(ctx context.Context, pkt *commonv1.ClientPacket, svc *Service, sessions SessionResolver) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	actor, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
	if err != nil {
		return chatErr(trace, err), nil
	}
	var req chatv1.ListChatMessagesRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := svc.List(ctx, actor, &req)
	if err != nil {
		return chatErr(trace, err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(trace, data), nil
}

func chatErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, ErrUnauthorized):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session required")
	case errors.Is(err, ErrWrongServer):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch")
	case errors.Is(err, ErrInvalidChannel), errors.Is(err, ErrEmptyContent):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, ErrChannelForbidden), errors.Is(err, ErrGuildNotSupported):
		return errResp(trace, errCodeChatChannelForbidden, err.Error())
	case errors.Is(err, ErrContentTooLong):
		return errResp(trace, errCodeChatContentTooLong, "content too long")
	case errors.Is(err, ErrRateLimited):
		return errResp(trace, errCodeChatRateLimited, "rate limited")
	case errors.Is(err, ErrRecipientRequired), errors.Is(err, ErrCannotMessageSelf):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, ErrRecipientNotFound):
		return errResp(trace, errCodeChatRecipientNotFound, "recipient not found")
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}

func okResp(trace string, data []byte) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: 0, TraceId: trace, Data: data}
}

func errResp(trace string, code commonv1.ErrorCode, msg string) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{
		Code:    int32(code),
		Msg:     msg,
		TraceId: trace,
	}
}
