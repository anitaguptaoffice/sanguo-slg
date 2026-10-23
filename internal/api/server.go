package api

import (
	"context"
	"log/slog"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	RouteCreateCity           = "world.v1.CreateCity"
	RouteListPlayerCities     = "world.v1.ListPlayerCities"
	RouteStartBuildingUpgrade = "domestic.v1.StartBuildingUpgrade"
	RouteGetCityState         = "domestic.v1.GetCityState"
	defaultServerID           = 1
)

// Server wires account, world, and domestic behind the WebSocket gateway.
type Server struct {
	log      *slog.Logger
	account  *account.Service
	players  *PlayerStore
	world    *world.Service
	domestic *domestic.Hub
	sessions *SessionRegistry
	cities   map[int64]*domestic.CityState
}

// AccountService exposes the account domain service for gateway session validation.
func (s *Server) AccountService() *account.Service {
	return s.account
}

// NewServer builds cross-domain handlers.
func NewServer(log *slog.Logger, pool *pgxpool.Pool, worldSvc *world.Service, domesticHub *domestic.Hub) *Server {
	if log == nil {
		log = slog.Default()
	}
	return &Server{
		log:      log,
		account:  account.NewService(account.NewStore(pool)),
		players:  &PlayerStore{Pool: pool},
		world:    worldSvc,
		domestic: domesticHub,
		sessions: NewSessionRegistry(),
		cities:   make(map[int64]*domestic.CityState),
	}
}

// GatewayRouter returns a merged route table for the platform gateway.
func (s *Server) GatewayRouter() *gateway.Router {
	handlers := map[string]gateway.RouteHandler{}
	for route, h := range account.GatewayHandlers(s.account) {
		if route == account.RouteLogin {
			handlers[route] = s.wrapLogin(h)
			continue
		}
		handlers[route] = h
	}
	handlers[RouteCreateCity] = s.handleCreateCity
	handlers[RouteListPlayerCities] = s.handleListPlayerCities
	handlers[RouteStartBuildingUpgrade] = s.handleStartBuildingUpgrade
	handlers[RouteGetCityState] = s.handleGetCityState
	return gateway.NewRouter(handlers)
}

// PublicRoutes merges account public routes with gateway defaults.
func (s *Server) PublicRoutes() map[string]bool {
	out := map[string]bool{gateway.RoutePing: true}
	for k, v := range account.PublicRoutes() {
		out[k] = v
	}
	return out
}

func (s *Server) wrapLogin(inner gateway.RouteHandler) gateway.RouteHandler {
	return func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		var req accountv1.LoginRequest
		if err := unmarshal(pkt.GetPayload(), &req); err != nil {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
		}
		serverID := req.GetServerId()
		if serverID == 0 {
			serverID = defaultServerID
		}

		respPkt, err := inner(ctx, pkt)
		if err != nil {
			return nil, err
		}
		if respPkt.GetCode() == int32(commonv1.ErrorCode_ACCOUNT_NO_PLAYER) {
			aid, err := s.players.AccountIDByCredentials(ctx, req.GetLoginName(), req.GetPassword())
			if err != nil {
				return respPkt, nil
			}
			if _, err := s.players.EnsurePlayer(ctx, serverID, aid, req.GetLoginName()); err != nil {
				return nil, err
			}
			respPkt, err = inner(ctx, pkt)
			if err != nil {
				return nil, err
			}
		}
		if respPkt.GetCode() == 0 {
			s.bindFromLoginResponse(respPkt, serverID)
		}
		return respPkt, nil
	}
}

func (s *Server) bindFromLoginResponse(respPkt *commonv1.ServerPacket, serverID int32) {
	var resp accountv1.LoginResponse
	if err := unmarshal(respPkt.GetData(), &resp); err != nil {
		return
	}
	if resp.GetSessionId() == "" || resp.GetPlayer() == nil {
		return
	}
	s.sessions.Bind(resp.GetSessionId(), PlayerContext{
		ServerID: serverID,
		PlayerID: resp.GetPlayer().GetPlayerId(),
	})
}

func (s *Server) playerCtx(ctx context.Context, pkt *commonv1.ClientPacket) (PlayerContext, *commonv1.ServerPacket) {
	pc, ok := s.sessions.Get(pkt.GetSessionId())
	if !ok {
		aid, err := s.players.AccountIDForSession(ctx, pkt.GetSessionId())
		if err != nil || aid == 0 {
			return PlayerContext{}, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session not bound")
		}
		// lazy bind: first shard player on default server
		pid, err := s.players.EnsurePlayer(ctx, defaultServerID, aid, "")
		if err != nil {
			return PlayerContext{}, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
		}
		pc = PlayerContext{AccountID: aid, ServerID: defaultServerID, PlayerID: pid}
		s.sessions.Bind(pkt.GetSessionId(), pc)
	}
	return pc, nil
}

// RunDomesticScheduler ticks build queues until ctx is cancelled.
func (s *Server) RunDomesticScheduler(ctx context.Context) {
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.domestic.Tick()
		}
	}
}
