package guild

import (
	"context"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/assembly"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

const (
	RouteSendChatMessage  = chat.RouteSendChatMessage
	RouteListChatMessages = chat.RouteListChatMessages

	errCodeChatChannelForbidden  commonv1.ErrorCode = 61001
	errCodeChatContentTooLong    commonv1.ErrorCode = 61002
	errCodeChatRateLimited       commonv1.ErrorCode = 61003
	errCodeChatRecipientNotFound commonv1.ErrorCode = 61004
	errCodeChatGuildRequired     commonv1.ErrorCode = 61005
	errCodeChatPlayerMuted       commonv1.ErrorCode = 61006
)

// ChatSessionResolver maps gateway session_id to the active shard player for chat routes.
type ChatSessionResolver interface {
	ActorForSession(ctx context.Context, sessionID string) (chat.Actor, error)
}

// ChatGatewayHandlers registers chat routes with guild-channel membership enforcement.
func ChatGatewayHandlers(coord *ChatCoordinator, sessions ChatSessionResolver) map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteSendChatMessage: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleChatSend(ctx, pkt, coord, sessions)
		},
		RouteListChatMessages: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleChatList(ctx, pkt, coord, sessions)
		},
	}
}

// RegisterM3Chat replaces assembly chat handlers with guild-aware chat routes.
func RegisterM3Chat(m *assembly.M3, coord *ChatCoordinator, sessions ChatSessionResolver) {
	if m == nil || coord == nil {
		return
	}
	for route, h := range ChatGatewayHandlers(coord, sessions) {
		m.Register(route, h)
	}
}

func handleChatSend(ctx context.Context, pkt *commonv1.ClientPacket, coord *ChatCoordinator, sessions ChatSessionResolver) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	actor, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
	if err != nil {
		return guildChatErr(trace, err), nil
	}
	var req chatv1.SendChatMessageRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return chatErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := coord.Send(ctx, actor, &req)
	if err != nil {
		return guildChatErr(trace, err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return chatOkResp(trace, data), nil
}

func handleChatList(ctx context.Context, pkt *commonv1.ClientPacket, coord *ChatCoordinator, sessions ChatSessionResolver) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	actor, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
	if err != nil {
		return guildChatErr(trace, err), nil
	}
	var req chatv1.ListChatMessagesRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return chatErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := coord.List(ctx, actor, &req)
	if err != nil {
		return guildChatErr(trace, err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return chatOkResp(trace, data), nil
}

func guildChatErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, chat.ErrUnauthorized):
		return chatErrResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session required")
	case errors.Is(err, chat.ErrWrongServer):
		return chatErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch")
	case errors.Is(err, chat.ErrInvalidChannel), errors.Is(err, chat.ErrEmptyContent):
		return chatErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, ErrGuildRequired):
		return chatErrResp(trace, errCodeChatGuildRequired, err.Error())
	case errors.Is(err, chat.ErrChannelForbidden), errors.Is(err, chat.ErrGuildNotSupported):
		return chatErrResp(trace, errCodeChatChannelForbidden, err.Error())
	case errors.Is(err, chat.ErrContentTooLong):
		return chatErrResp(trace, errCodeChatContentTooLong, "content too long")
	case errors.Is(err, chat.ErrRateLimited):
		return chatErrResp(trace, errCodeChatRateLimited, "rate limited")
	case errors.Is(err, chat.ErrPlayerMuted):
		return chatErrResp(trace, errCodeChatPlayerMuted, "player muted")
	case errors.Is(err, chat.ErrRecipientRequired), errors.Is(err, chat.ErrCannotMessageSelf):
		return chatErrResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, chat.ErrRecipientNotFound):
		return chatErrResp(trace, errCodeChatRecipientNotFound, "recipient not found")
	default:
		return chatErrResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}

func chatOkResp(trace string, data []byte) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: 0, TraceId: trace, Data: data}
}

func chatErrResp(trace string, code commonv1.ErrorCode, msg string) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{
		Code:    int32(code),
		Msg:     msg,
		TraceId: trace,
	}
}
