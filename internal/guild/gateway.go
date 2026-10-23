package guild

import (
	"context"
	"errors"

	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/assembly"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

const (
	RouteCreateGuild      = "guild.v1.CreateGuild"
	RouteJoinGuild        = "guild.v1.JoinGuild"
	RouteLeaveGuild       = "guild.v1.LeaveGuild"
	RouteListGuildMembers = "guild.v1.ListGuildMembers"
)

// SessionResolver maps gateway session_id to the active shard player.
type SessionResolver interface {
	ActorForSession(ctx context.Context, sessionID string) (Actor, error)
}

// GatewayHandlers registers guild routes on the WebSocket gateway.
func GatewayHandlers(svc *Service, sessions SessionResolver) map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteCreateGuild: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleCreate(ctx, pkt, svc, sessions)
		},
		RouteJoinGuild: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleJoin(ctx, pkt, svc, sessions)
		},
		RouteLeaveGuild: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleLeave(ctx, pkt, svc, sessions)
		},
		RouteListGuildMembers: func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
			return handleListMembers(ctx, pkt, svc, sessions)
		},
	}
}

// RegisterM3 replaces assembly stub handlers for all guild.v1 routes.
func RegisterM3(m *assembly.M3, svc *Service, sessions SessionResolver) {
	if m == nil || svc == nil {
		return
	}
	for route, h := range GatewayHandlers(svc, sessions) {
		m.Register(route, h)
	}
}

func handleCreate(ctx context.Context, pkt *commonv1.ClientPacket, svc *Service, sessions SessionResolver) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	actor, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
	if err != nil {
		return guildErr(trace, err), nil
	}
	var req guildv1.CreateGuildRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := svc.CreateGuild(ctx, actor, &req)
	if err != nil {
		return guildErr(trace, err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(trace, data), nil
}

func handleJoin(ctx context.Context, pkt *commonv1.ClientPacket, svc *Service, sessions SessionResolver) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	actor, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
	if err != nil {
		return guildErr(trace, err), nil
	}
	var req guildv1.JoinGuildRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := svc.JoinGuild(ctx, actor, &req)
	if err != nil {
		return guildErr(trace, err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(trace, data), nil
}

func handleLeave(ctx context.Context, pkt *commonv1.ClientPacket, svc *Service, sessions SessionResolver) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	actor, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
	if err != nil {
		return guildErr(trace, err), nil
	}
	var req guildv1.LeaveGuildRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := svc.LeaveGuild(ctx, actor, &req)
	if err != nil {
		return guildErr(trace, err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(trace, data), nil
}

func handleListMembers(ctx context.Context, pkt *commonv1.ClientPacket, svc *Service, sessions SessionResolver) (*commonv1.ServerPacket, error) {
	trace := pkt.GetTraceId()
	actor, err := sessions.ActorForSession(ctx, pkt.GetSessionId())
	if err != nil {
		return guildErr(trace, err), nil
	}
	var req guildv1.ListGuildMembersRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := svc.ListGuildMembers(ctx, actor, &req)
	if err != nil {
		return guildErr(trace, err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(trace, data), nil
}

func guildErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, ErrUnauthorized):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session required")
	case errors.Is(err, ErrWrongServer):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch")
	case errors.Is(err, ErrNotFound):
		return errResp(trace, commonv1.ErrorCode_GUILD_NOT_FOUND, "guild not found")
	case errors.Is(err, ErrAlreadyMember):
		return errResp(trace, commonv1.ErrorCode_GUILD_ALREADY_MEMBER, "already in a guild")
	case errors.Is(err, ErrNotMember):
		return errResp(trace, commonv1.ErrorCode_GUILD_NOT_MEMBER, "not a guild member")
	case errors.Is(err, ErrNameInvalid):
		return errResp(trace, commonv1.ErrorCode_GUILD_NAME_INVALID, "guild name invalid")
	case errors.Is(err, ErrNameTaken):
		return errResp(trace, commonv1.ErrorCode_GUILD_NAME_TAKEN, "guild name taken")
	case errors.Is(err, ErrFull):
		return errResp(trace, commonv1.ErrorCode_GUILD_FULL, "guild full")
	case errors.Is(err, ErrLeaderCannotLeave), errors.Is(err, ErrPermissionDenied):
		return errResp(trace, commonv1.ErrorCode_GUILD_LEADER_CANNOT_LEAVE, err.Error())
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
