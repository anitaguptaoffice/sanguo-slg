package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
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

// Handler returns the root HTTP handler (health checks only).
func Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	return mux
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ServeHTTP starts the game HTTP server (health + WebSocket gateway).
func (a *App) ServeHTTP(ctx context.Context) (result error) {
	if err := a.validatePreparedFirstCityLocal(); err != nil {
		return err
	}
	runCtx, cancelRun := context.WithCancelCause(ctx)
	defer cancelRun(nil)
	var startup *localMarchStartup
	retainLease := false
	if a.Config.PreparedMarch {
		var err error
		startup, err = a.acquireLocalMarchStartup(runCtx)
		if err != nil {
			return err
		}
		watched := make(chan struct{})
		go func() {
			defer close(watched)
			if err := startup.watch(runCtx); err != nil {
				cancelRun(err)
			}
		}()
		defer func() {
			cancelRun(nil)
			err := waitPreparedShutdown(watched, 3*time.Second, "prepared march writer watcher did not join")
			if err == nil && !retainLease {
				err = startup.close()
			}
			if cause := context.Cause(runCtx); cause != nil && ctx.Err() == nil && !errors.Is(cause, context.Canceled) {
				err = errors.Join(err, cause)
			}
			result = errors.Join(result, err)
		}()
	}
	root, err := os.Getwd()
	if err != nil {
		return err
	}
	if err := a.PrepareGame(runCtx, root); err != nil {
		return err
	}
	apiSrv, err := a.newAPIServer(runCtx, startup)
	if err != nil {
		return err
	}
	srv := &http.Server{Addr: a.Config.HTTPAddr, Handler: a.HTTPHandler(runCtx, apiSrv)}
	var stopRecruit func() error
	var stopMarch func() error
	if a.Config.PreparedRecruit {
		srv.BaseContext = func(net.Listener) context.Context { return runCtx }
		stopRecruit = startPreparedRecruitWorker(runCtx, apiSrv.RunPreparedRecruitScheduler)
	}
	if a.Config.PreparedMarch {
		stopMarch = startPreparedWorker(runCtx, apiSrv.RunPreparedMarchScheduler, "prepared march")
	}
	go func() {
		<-runCtx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	a.Log.Info("server listening", "addr", a.Config.HTTPAddr, "ws", "/ws")
	err = srv.ListenAndServe()
	cancelRun(nil)
	if errors.Is(err, http.ErrServerClosed) {
		err = nil
	}
	if stopRecruit == nil {
		return err
	}
	// Join the worker before closing the pool. A stuck lease must not block
	// the process exit after the worker's own bounded cleanup.
	workerErr := stopRecruit()
	if stopMarch != nil {
		workerErr = errors.Join(workerErr, stopMarch())
	}
	if workerErr != nil {
		retainLease = true // The process owns the writer lock until termination.
		return errors.Join(err, workerErr)
	}
	closed := make(chan struct{})
	go func() {
		defer close(closed)
		a.DB.Close()
	}()
	poolErr := waitPreparedShutdown(closed, 5*time.Second, "prepared recruit database pool close timed out")
	retainLease = poolErr != nil
	return errors.Join(err, poolErr)
}

func startPreparedRecruitWorker(parent context.Context, run func(context.Context)) func() error {
	return startPreparedWorker(parent, run, "prepared recruit")
}

func startPreparedWorker(parent context.Context, run func(context.Context), name string) func() error {
	ctx, cancel := context.WithCancel(parent)
	done := make(chan struct{})
	go func() {
		defer close(done)
		run(ctx)
	}()
	return func() error {
		cancel()
		// Allow for transaction rollback and source drain within the worker.
		return waitPreparedShutdown(done, 15*time.Second, name+" worker shutdown timed out")
	}
}

func waitPreparedShutdown(done <-chan struct{}, timeout time.Duration, message string) error {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-done:
		return nil
	case <-timer.C:
		return errors.New(message)
	}
}

// RepoRoot finds the module root for migrations when tests run from subpackages.
func RepoRoot() string {
	wd, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		if _, err := os.Stat(filepath.Join(wd, "go.mod")); err == nil {
			return wd
		}
		parent := filepath.Dir(wd)
		if parent == wd {
			return "."
		}
		wd = parent
	}
}
