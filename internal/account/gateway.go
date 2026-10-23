package account

import (
	"context"
	"errors"

	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

const (
	RouteRegister       = "account.v1.Register"
	RouteLogin          = "account.v1.Login"
	RouteRefreshSession = "account.v1.RefreshSession"
)

// PublicRoutes are gateway routes that do not require session_id.
func PublicRoutes() map[string]bool {
	return map[string]bool{
		RouteRegister: true,
		RouteLogin:    true,
	}
}

// GatewayHandlers registers account routes on the WebSocket gateway.
func GatewayHandlers(svc *Service) map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteRegister:       svc.handleRegister,
		RouteLogin:          svc.handleLogin,
		RouteRefreshSession: svc.handleRefreshSession,
	}
}

// SessionValidator adapts Service for gateway.SessionValidator.
type SessionValidator struct{ Svc *Service }

func (v SessionValidator) Valid(ctx context.Context, sessionID string) bool {
	return v.Svc.ValidSession(ctx, sessionID)
}

func (s *Service) handleRegister(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	var req accountv1.RegisterRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	id, err := s.Register(ctx, req.GetLoginName(), req.GetPassword())
	if err != nil {
		if errors.Is(err, ErrLoginNameTaken) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "login name already exists"), nil
		}
		if errors.Is(err, ErrInvalidRequest) || err.Error() == "login_name and password required" {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error()), nil
		}
		return nil, err
	}
	data, err := proto.Marshal(&accountv1.RegisterResponse{AccountId: id})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Service) handleLogin(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	var req accountv1.LoginRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := s.Login(ctx, req.GetLoginName(), req.GetPassword(), req.GetServerId())
	if err != nil {
		return loginErr(pkt.GetTraceId(), err), nil
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Service) handleRefreshSession(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	var req accountv1.RefreshSessionRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	resp, err := s.RefreshSession(ctx, pkt.GetSessionId())
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session invalid or expired"), nil
		}
		return nil, err
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func loginErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, ErrLoginFailed):
		return errResp(trace, commonv1.ErrorCode_ACCOUNT_LOGIN_FAILED, "login failed")
	case errors.Is(err, ErrBanned):
		return errResp(trace, commonv1.ErrorCode_ACCOUNT_BANNED, "account banned")
	case errors.Is(err, ErrServerNotFound):
		return errResp(trace, commonv1.ErrorCode_ACCOUNT_SERVER_NOT_FOUND, "server not found")
	case errors.Is(err, ErrServerUnavailable):
		return errResp(trace, commonv1.ErrorCode_ACCOUNT_SERVER_UNAVAILABLE, "server unavailable")
	case errors.Is(err, ErrNoPlayer):
		return errResp(trace, commonv1.ErrorCode_ACCOUNT_NO_PLAYER, "no player on this server")
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}

func okResp(trace string, data []byte) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: 0, TraceId: trace, Data: data}
}

func errResp(trace string, code commonv1.ErrorCode, msg string) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: int32(code), Msg: msg, TraceId: trace}
}
