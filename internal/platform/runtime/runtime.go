package runtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/config"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/logging"
	redisstore "github.com/anitaguptaoffice/sanguo-slg/internal/platform/redis"
	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
)

// App wires platform dependencies for server and GM entrypoints.
type App struct {
	Config config.Config
	Log    *slog.Logger
	DB     *pgxpool.Pool
	Redis  *goredis.Client
}

// Boot loads config, logging, and storage clients.
func Boot(ctx context.Context) (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}
	log := logging.New(cfg.LogLevel)

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	rdb, err := redisstore.Open(ctx, cfg.RedisAddr)
	if err != nil {
		pool.Close()
		return nil, err
	}
	return &App{Config: cfg, Log: log, DB: pool, Redis: rdb}, nil
}

// Close releases external resources.
func (a *App) Close() {
	if a.Redis != nil {
		_ = a.Redis.Close()
	}
	if a.DB != nil {
		a.DB.Close()
	}
}

// Handler returns the root HTTP handler (health checks only for now).
func Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	return mux
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ServeHTTP starts a minimal health server until the context is cancelled.
func (a *App) ServeHTTP(ctx context.Context) error {
	srv := &http.Server{Addr: a.Config.HTTPAddr, Handler: Handler()}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	a.Log.Info("server listening", "addr", a.Config.HTTPAddr)
	err := srv.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}
