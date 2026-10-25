package api

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/assembly"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/anitaguptaoffice/sanguo-slg/internal/rank"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/obs"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/shard"
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

type clockFunc func() time.Time

// Server wires account, world, and domestic behind the WebSocket gateway.
type Server struct {
	citiesMu sync.RWMutex
	log      *slog.Logger
	account  *account.Service
	players  *PlayerStore
	world    *world.Service
	domestic   *domestic.Hub
	military   *march.Hub
	reports    *report.Service
	sessions   *SessionRegistry
	gm         *GmService
	shard         *shard.Handlers
	m3            *assembly.M3
	m4            *assembly.M4
	rankSvc       *rank.Service
	rankSch       *rank.Scheduler
	questSvc      *quest.Service
	shopSvc       *shop.Service
	contentSvc    *content.Service
	mailSvc       *mail.Service
	heroSvc       *hero.Service
	questChainIDs []int32
	cities        map[int64]*domestic.CityState
	cityCoords    map[int64]cityCoord
	playerMarches map[int64][]playerMarchRef
	marchHeroByID map[int64]marchHeroBinding
	nextArmyID    int64
	now           clockFunc
	smokeSyncClock *SmokeSyncClock
}

// AccountService exposes the account domain service for gateway session validation.
func (s *Server) AccountService() *account.Service {
	return s.account
}

// Gm returns the GM operator service sharing this server's session registry.
func (s *Server) Gm() *GmService {
	if s.gm == nil {
		s.gm = NewGmService(s.log, s.players.Pool, s.sessions, nil)
	}
	return s.gm
}

// NewServer builds cross-domain handlers.
func NewServer(log *slog.Logger, pool *pgxpool.Pool, worldSvc *world.Service, domesticHub *domestic.Hub, militaryHub *march.Hub) *Server {
	if log == nil {
		log = slog.Default()
	}
	srv := &Server{
		log:        log,
		account:    account.NewService(account.NewStore(pool)),
		players:    &PlayerStore{Pool: pool},
		world:      worldSvc,
		domestic:   domesticHub,
		military:   militaryHub,
		sessions:   NewSessionRegistry(),
		m3:         assembly.NewM3(),
		m4:         assembly.NewM4(),
		cities:     make(map[int64]*domestic.CityState),
		cityCoords: make(map[int64]cityCoord),
		now:        time.Now,
	}
	shardStore := &shard.Store{Pool: pool}
	srv.shard = shard.NewHandlers(shardStore, srv.account, srv)
	srv.wireM3(pool)
	srv.wireMarchHeroLifecycle()
	return srv
}

// BindSession implements shard.Binder after login or enter-server.
func (s *Server) BindSession(sessionID string, serverID int32, playerID int64, accountID int64) {
	s.sessions.Bind(sessionID, PlayerContext{
		AccountID: accountID,
		ServerID:  serverID,
		PlayerID:  playerID,
	})
	if playerID != 0 {
		s.hydratePlayerCities(context.Background(), PlayerContext{
			AccountID: accountID,
			ServerID:  serverID,
			PlayerID:  playerID,
		})
	}
}

// SetClock overrides the integration clock (tests).
func (s *Server) SetClock(now clockFunc) {
	if now != nil {
		s.now = now
		if s.heroSvc != nil {
			s.heroSvc.SetClock(now)
		}
	}
}

// AttachBattleReports enables Get/List battle report gateway routes.
func (s *Server) AttachBattleReports(svc *report.Service) {
	s.reports = svc
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
	handlers[RouteRecruitTroop] = s.handleRecruitTroop
	handlers[RouteStartMarch] = s.handleStartMarch
	handlers[RouteListMarches] = s.handleListMarches
	handlers[RouteGetBattleReport] = s.wrapGameplayOnSuccess(obs.EventBattleReportReady, s.handleGetBattleReport)
	handlers[RouteListBattleReports] = s.handleListBattleReports
	for route, h := range s.shard.GatewayHandlers() {
		handlers[route] = h
	}
	for route, h := range s.m3.GatewayHandlers() {
		handlers[route] = h
	}
	for route, h := range s.m4.GatewayHandlers() {
		handlers[route] = h
	}
	return gateway.NewRouter(handlers)
}

// PublicRoutes merges account public routes with gateway defaults.
func (s *Server) PublicRoutes() map[string]bool {
	out := map[string]bool{gateway.RoutePing: true}
	for k, v := range account.PublicRoutes() {
		out[k] = v
	}
	out[shard.RouteListGameServers] = true
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
			s.bindFromLoginResponse(ctx, respPkt, serverID)
			var resp accountv1.LoginResponse
			if err := unmarshal(respPkt.GetData(), &resp); err == nil && resp.GetPlayer() != nil {
				obs.EmitGameplayEvent(s.log, pkt.GetTraceId(), obs.EventLogin, obs.PlayerRef{
					ServerID: serverID,
					PlayerID: resp.GetPlayer().GetPlayerId(),
				})
			}
		}
		return respPkt, nil
	}
}

func (s *Server) wrapGameplayOnSuccess(event string, inner gateway.RouteHandler) gateway.RouteHandler {
	return func(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
		resp, err := inner(ctx, pkt)
		if err != nil || resp == nil || resp.GetCode() != 0 {
			return resp, err
		}
		pc, ok := s.sessions.Get(pkt.GetSessionId())
		if !ok {
			return resp, nil
		}
		obs.EmitGameplayEvent(s.log, pkt.GetTraceId(), event, obs.PlayerRef{
			ServerID: pc.ServerID,
			PlayerID: pc.PlayerID,
		})
		return resp, nil
	}
}

func (s *Server) bindFromLoginResponse(ctx context.Context, respPkt *commonv1.ServerPacket, serverID int32) {
	var resp accountv1.LoginResponse
	if err := unmarshal(respPkt.GetData(), &resp); err != nil {
		return
	}
	if resp.GetSessionId() == "" || resp.GetPlayer() == nil {
		return
	}
	pc := PlayerContext{
		ServerID: serverID,
		PlayerID: resp.GetPlayer().GetPlayerId(),
	}
	if aid, err := s.players.AccountIDForSession(ctx, resp.GetSessionId()); err == nil {
		pc.AccountID = aid
	}
	s.sessions.Bind(resp.GetSessionId(), pc)
	s.hydratePlayerCities(ctx, pc)
}

func (s *Server) playerCtx(ctx context.Context, pkt *commonv1.ClientPacket) (PlayerContext, *commonv1.ServerPacket) {
	pc, ok := s.sessions.Get(pkt.GetSessionId())
	if !ok {
		return PlayerContext{}, errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "session not bound to a server")
	}
	if errPkt := s.verifyShard(pkt, pc); errPkt != nil {
		return PlayerContext{}, errPkt
	}
	return pc, nil
}

func (s *Server) verifyShard(pkt *commonv1.ClientPacket, pc PlayerContext) *commonv1.ServerPacket {
	if pc.ServerID == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "server not selected")
	}
	if sid := pkt.GetServerId(); sid != 0 && sid != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch")
	}
	return nil
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

// RunMilitaryScheduler ticks march/recruit queues until ctx is cancelled.
func (s *Server) RunMilitaryScheduler(ctx context.Context) {
	if s.military == nil {
		return
	}
	s.military.RunScheduler(ctx)
}
