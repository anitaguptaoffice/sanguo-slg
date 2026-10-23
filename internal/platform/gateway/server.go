package gateway

import (
	"context"
	"log/slog"
	"net/http"
	"sync/atomic"

	"github.com/gorilla/websocket"
)

// Server is the WebSocket gateway HTTP handler.
type Server struct {
	log      *slog.Logger
	cfg      Config
	access   AccessControl
	sessions SessionValidator
	router   *Router
	hub      *hub
	upgrader websocket.Upgrader
}

// NewServer wires dependencies. sessions and router must be non-nil.
func NewServer(log *slog.Logger, cfg Config, access AccessControl, sessions SessionValidator, router *Router) *Server {
	if cfg.Path == "" {
		cfg.Path = "/ws"
	}
	if cfg.PublicRoutes == nil {
		cfg.PublicRoutes = DefaultConfig().PublicRoutes
	}
	return &Server{
		log:      log,
		cfg:      cfg,
		access:   access,
		sessions: sessions,
		router:   router,
		hub:      newHub(cfg.MaxConnections),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			CheckOrigin:     func(*http.Request) bool { return true },
		},
	}
}

// Register mounts the gateway on mux at cfg.Path.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc(s.cfg.Path, s.serveWS)
}

// Handler returns a standalone handler (for tests).
func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(s.serveWS)
}

// ActiveConnections returns the current connection count.
func (s *Server) ActiveConnections() int {
	return s.hub.connectionCount()
}

var connID atomic.Uint64

func (s *Server) serveWS(w http.ResponseWriter, r *http.Request) {
	if !s.access.allowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if !s.hub.tryAdd() {
		http.Error(w, "too many connections", http.StatusServiceUnavailable)
		return
	}
	ws, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.hub.remove()
		s.log.Debug("websocket upgrade failed", "err", err)
		return
	}
	id := connID.Add(1)
	c := &conn{
		ws:       ws,
		log:      s.log.With("conn", id),
		cfg:      s.cfg,
		limiter:  newTokenBucket(s.cfg.MessagesPerSecond, s.cfg.Burst),
		sessions: s.sessions,
		router:   s.router,
		public:   s.cfg.PublicRoutes,
		hub:      s.hub,
	}
	s.log.Debug("client connected", "conn", id, "remote", r.RemoteAddr)
	c.serve(r.Context())
	s.log.Debug("client disconnected", "conn", id)
}

// Mount is a convenience alias for Register on the default path.
func Mount(mux *http.ServeMux, log *slog.Logger, cfg Config, access AccessControl, sessions SessionValidator, router *Router) *Server {
	srv := NewServer(log, cfg, access, sessions, router)
	srv.Register(mux)
	return srv
}

// Serve starts a minimal HTTP server with only the gateway (integration tests).
func Serve(ctx context.Context, addr string, srv *Server) error {
	mux := http.NewServeMux()
	srv.Register(mux)
	httpSrv := &http.Server{Addr: addr, Handler: mux}
	go func() {
		<-ctx.Done()
		_ = httpSrv.Shutdown(context.Background())
	}()
	err := httpSrv.ListenAndServe()
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}
