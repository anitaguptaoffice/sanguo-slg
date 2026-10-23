package wsstress

import (
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
)

func testLog() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func startGatewayTestServer(maxConn int) (wsURL string, closeFn func()) {
	cfg := gateway.DefaultConfig()
	cfg.MaxConnections = maxConn
	srv := gateway.NewServer(testLog(), cfg, gateway.AccessControl{}, gateway.AllowAllSessions{}, gateway.NewRouter(nil))
	ts := httptest.NewServer(srv.Handler())
	return "ws" + strings.TrimPrefix(ts.URL, "http"), func() { ts.Close() }
}

func TestRunSmallConcurrency(t *testing.T) {
	wsURL, closeFn := startGatewayTestServer(100)
	defer closeFn()

	res, err := Run(Config{
		WSURL:            wsURL,
		Concurrency:      10,
		HandshakeTimeout: 5 * time.Second,
		DialParallelism:  5,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Failed != 0 || res.Concurrency != 10 {
		t.Fatalf("result: %+v", res)
	}
}

func TestStress3000Embedded(t *testing.T) {
	if testing.Short() {
		t.Skip("stress test skipped in -short mode")
	}
	wsURL, closeFn := startGatewayTestServer(4000)
	defer closeFn()

	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	cfg.WSURL = wsURL
	if cfg.Concurrency < DefaultConcurrency {
		cfg.Concurrency = DefaultConcurrency
	}

	res, err := Run(cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("embedded stress: concurrency=%d elapsed=%s", res.Concurrency, res.Elapsed)
}

func TestStress3000External(t *testing.T) {
	if testing.Short() {
		t.Skip("stress test skipped in -short mode")
	}
	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.WSURL == "" {
		t.Skip("set LOAD_WS_URL to run external gateway stress")
	}
	if cfg.Concurrency < DefaultConcurrency {
		t.Fatalf("external stress requires LOAD_CONCURRENCY >= %d (got %d)", DefaultConcurrency, cfg.Concurrency)
	}

	res, err := Run(cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("external stress: url=%s concurrency=%d elapsed=%s", cfg.WSURL, res.Concurrency, res.Elapsed)
}
