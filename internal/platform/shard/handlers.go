package shard

import (
	"context"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	commonpb "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"google.golang.org/protobuf/proto"
)

const (
	serverStatusMaintain = 0
	serverStatusStopped  = 3
	defaultPageSize      = 20
	maxPageSize          = 50
)

// Binder updates api session ↔ server_id after login or enter-server.
type Binder interface {
	BindSession(sessionID string, serverID int32, playerID int64, accountID int64)
}

// Handlers exposes选服与进服 gateway routes (platform assembly).
type Handlers struct {
	store   *Store
	account *account.Service
	binder  Binder
	now     func() time.Time
}

// NewHandlers wires shard list/enter routes.
func NewHandlers(store *Store, accountSvc *account.Service, binder Binder) *Handlers {
	return &Handlers{
		store:   store,
		account: accountSvc,
		binder:  binder,
		now:     time.Now,
	}
}

// GatewayHandlers returns route table entries for ListGameServers and EnterGameServer.
func (h *Handlers) GatewayHandlers() map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteListGameServers: h.handleListGameServers,
		RouteEnterGameServer: h.handleEnterGameServer,
	}
}

func (h *Handlers) handleListGameServers(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	var req accountv1.ListGameServersRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	page := req.GetPage()
	if page <= 0 {
		page = 1
	}
	pageSize := req.GetPageSize()
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	offset := int((page - 1) * pageSize)

	var accountID int64
	if sid := pkt.GetSessionId(); sid != "" && h.account.ValidSession(ctx, sid) {
		aid, _, err := h.store.SessionAccount(ctx, sid)
		if err == nil {
			accountID = aid
		}
	}

	rows, total, err := h.store.ListVisibleServers(ctx, accountID, offset, int(pageSize))
	if err != nil {
		return nil, err
	}
	resp := &accountv1.ListGameServersResponse{TotalCount: total}
	for _, row := range rows {
		var openedMs int64
		if row.OpenedAt != nil {
			openedMs = row.OpenedAt.UnixMilli()
		}
		resp.Servers = append(resp.Servers, &commonpb.GameServerInfo{
			Shard: &commonpb.ServerShard{
				ServerId:    row.ServerID,
				DisplayName: row.DisplayName,
				Status:      int32(row.Status),
			},
			OpenedAtMs:  openedMs,
			OnlineCount: row.OnlineCount,
			HasPlayer:   row.HasPlayer,
		})
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okPkt(pkt.GetTraceId(), data), nil
}

func (h *Handlers) handleEnterGameServer(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	sessionID := pkt.GetSessionId()
	if sessionID == "" || !h.account.ValidSession(ctx, sessionID) {
		return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "unauthorized"), nil
	}
	var req accountv1.EnterGameServerRequest
	if err := proto.Unmarshal(pkt.GetPayload(), &req); err != nil {
		return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	serverID := req.GetServerId()
	if serverID == 0 {
		return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id required"), nil
	}

	accountID, expiresAt, err := h.store.SessionAccount(ctx, sessionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session invalid"), nil
		}
		return nil, err
	}
	if !expiresAt.After(h.now()) {
		return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session expired"), nil
	}

	srv, err := h.store.GameServer(ctx, serverID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_ACCOUNT_SERVER_NOT_FOUND, "server not found"), nil
		}
		return nil, err
	}
	if srv.Status == serverStatusMaintain || srv.Status == serverStatusStopped {
		return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_ACCOUNT_SERVER_UNAVAILABLE, "server unavailable"), nil
	}

	player, err := h.store.PlayerOnServer(ctx, serverID, accountID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errPkt(pkt.GetTraceId(), commonv1.ErrorCode_ACCOUNT_NO_PLAYER, "no player on this server"), nil
		}
		return nil, err
	}
	wallet, err := h.store.Wallet(ctx, serverID, player.PlayerID)
	if err != nil {
		return nil, err
	}

	h.binder.BindSession(sessionID, serverID, player.PlayerID, accountID)

	resp := &accountv1.EnterGameServerResponse{
		SessionId:           sessionID,
		ServerId:            serverID,
		SessionExpiresAtMs:  expiresAt.UnixMilli(),
		Player: &commonpb.PlayerProfile{
			ServerId:    player.ServerID,
			PlayerId:    player.PlayerID,
			DisplayName: player.DisplayName,
			Level:       player.Level,
			Power:       player.Power,
		},
		Wallet: &commonpb.ResourceWallet{
			Food:  wallet.Food,
			Wood:  wallet.Wood,
			Iron:  wallet.Iron,
			Stone: wallet.Stone,
			Gold:  wallet.Gold,
		},
	}
	data, err := proto.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return okPkt(pkt.GetTraceId(), data), nil
}

func okPkt(trace string, data []byte) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: 0, TraceId: trace, Data: data}
}

func errPkt(trace string, code commonv1.ErrorCode, msg string) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: int32(code), Msg: msg, TraceId: trace}
}
