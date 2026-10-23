package gateway_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

func testLog() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func startTestServer(t *testing.T, access gateway.AccessControl, sessions gateway.SessionValidator) (url string, closeFn func()) {
	t.Helper()
	cfg := gateway.DefaultConfig()
	cfg.MaxConnections = 5000
	srv := gateway.NewServer(testLog(), cfg, access, sessions, gateway.NewRouter(nil))
	ts := httptest.NewServer(srv.Handler())
	return "ws" + strings.TrimPrefix(ts.URL, "http"), func() { ts.Close() }
}

func dialWS(t *testing.T, wsURL string) *websocket.Conn {
	t.Helper()
	c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	return c
}

func sendPacket(t *testing.T, c *websocket.Conn, pkt *commonv1.ClientPacket) *commonv1.ServerPacket {
	t.Helper()
	frame, err := proto.Marshal(pkt)
	if err != nil {
		t.Fatal(err)
	}
	if err := c.WriteMessage(websocket.BinaryMessage, frame); err != nil {
		t.Fatal(err)
	}
	_, data, err := c.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var resp commonv1.ServerPacket
	if err := proto.Unmarshal(data, &resp); err != nil {
		t.Fatal(err)
	}
	return &resp
}

func TestHandshakeAndPing(t *testing.T) {
	wsURL, closeFn := startTestServer(t, gateway.AccessControl{}, gateway.AllowAllSessions{})
	defer closeFn()
	c := dialWS(t, wsURL)
	defer c.Close()

	resp := sendPacket(t, c, &commonv1.ClientPacket{Route: gateway.RoutePing, TraceId: "t1"})
	if resp.Code != 0 || resp.TraceId != "t1" {
		t.Fatalf("ping: %+v", resp)
	}
}

func TestAuthRequired(t *testing.T) {
	wsURL, closeFn := startTestServer(t, gateway.AccessControl{}, gateway.MapSessions{IDs: map[string]struct{}{"sess-1": {}}})
	defer closeFn()
	c := dialWS(t, wsURL)
	defer c.Close()

	resp := sendPacket(t, c, &commonv1.ClientPacket{
		Route:   "world.v1.ListPlayerCities",
		TraceId: "t2",
	})
	if resp.Code != int32(commonv1.ErrorCode_COMMON_UNAUTHORIZED) {
		t.Fatalf("expected unauthorized, got %+v", resp)
	}

	resp = sendPacket(t, c, &commonv1.ClientPacket{
		Route:     "world.v1.ListPlayerCities",
		TraceId:   "t3",
		SessionId: "sess-1",
	})
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
		t.Fatalf("unknown route expected, got %+v", resp)
	}
}

func TestAccessDenyList(t *testing.T) {
	cfg := gateway.DefaultConfig()
	srv := gateway.NewServer(testLog(), cfg, gateway.AccessControl{Deny: []string{"127.0.0.1"}}, gateway.AllowAllSessions{}, gateway.NewRouter(nil))
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestReconnectReplacesSession(t *testing.T) {
	wsURL, closeFn := startTestServer(t, gateway.AccessControl{}, gateway.MapSessions{IDs: map[string]struct{}{"sess-r": {}}})
	defer closeFn()

	c1 := dialWS(t, wsURL)
	_ = sendPacket(t, c1, &commonv1.ClientPacket{
		Route:     "world.v1.ListPlayerCities",
		SessionId: "sess-r",
		TraceId:   "a",
	})

	c2 := dialWS(t, wsURL)
	_ = sendPacket(t, c2, &commonv1.ClientPacket{
		Route:     "world.v1.ListPlayerCities",
		SessionId: "sess-r",
		TraceId:   "b",
	})

	c1.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	_, _, err := c1.ReadMessage()
	if err == nil {
		t.Fatal("expected first connection to be closed after reconnect")
	}
	c2.Close()
}

func TestRateLimit(t *testing.T) {
	cfg := gateway.DefaultConfig()
	cfg.MessagesPerSecond = 5
	cfg.Burst = 2
	srv := gateway.NewServer(testLog(), cfg, gateway.AccessControl{}, gateway.AllowAllSessions{}, gateway.NewRouter(nil))
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")
	c := dialWS(t, wsURL)
	defer c.Close()

	var limited bool
	for i := 0; i < 50; i++ {
		resp := sendPacket(t, c, &commonv1.ClientPacket{Route: gateway.RoutePing, TraceId: "x"})
		if resp.Code == int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("expected rate limit response")
	}
}

func TestStress3000Connections(t *testing.T) {
	if testing.Short() {
		t.Skip("stress test skipped in -short mode")
	}
	cfg := gateway.DefaultConfig()
	cfg.MaxConnections = 4000
	srv := gateway.NewServer(testLog(), cfg, gateway.AccessControl{}, gateway.AllowAllSessions{}, gateway.NewRouter(nil))
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")

	const n = 3000
	var wg sync.WaitGroup
	errCh := make(chan error, n)
	sem := make(chan struct{}, 200)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
			if err != nil {
				errCh <- err
				return
			}
			frame, _ := proto.Marshal(&commonv1.ClientPacket{Route: gateway.RoutePing, TraceId: "s"})
			if err := c.WriteMessage(websocket.BinaryMessage, frame); err != nil {
				errCh <- err
				c.Close()
				return
			}
			if _, _, err := c.ReadMessage(); err != nil {
				errCh <- err
			}
			c.Close()
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		if err != nil {
			t.Fatalf("connection error: %v", err)
		}
	}
	deadline := time.Now().Add(2 * time.Second)
	for srv.ActiveConnections() != 0 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if srv.ActiveConnections() != 0 {
		t.Fatalf("leaked connections: %d", srv.ActiveConnections())
	}
}
