package obs

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestObsHTTP(t *testing.T) {
	var logs strings.Builder
	log := slog.New(slog.NewJSONHandler(&logs, nil))
	mux := http.NewServeMux()
	mux.HandleFunc("/ping", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(204) })

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set(traceHeader, "tid-1")
	Wrap(log, mux).ServeHTTP(httptest.NewRecorder(), req)

	if !strings.Contains(logs.String(), "tid-1") {
		t.Fatalf("log: %s", logs.String())
	}
	body := DefaultMetrics().text()
	if !strings.Contains(body, `status="204"`) || !strings.Contains(body, "sanguo_http_request_duration_seconds_count") {
		t.Fatalf("metrics:\n%s", body)
	}
}

func TestWrapLogger(t *testing.T) {
	var buf strings.Builder
	log := WrapLogger(slog.New(slog.NewJSONHandler(&buf, nil)))
	log.InfoContext(context.WithValue(context.Background(), traceKey{}, "z"), "x")
	var m map[string]string
	if err := json.Unmarshal([]byte(strings.TrimSpace(buf.String())), &m); err != nil || m["trace_id"] != "z" {
		t.Fatalf("payload %v err %v", buf.String(), err)
	}
}

func TestEmitGameplayEvent(t *testing.T) {
	var buf strings.Builder
	log := slog.New(slog.NewJSONHandler(&buf, nil))
	EmitGameplayEvent(log, "tr-9", EventLogin, PlayerRef{ServerID: 1, PlayerID: 42})
	if !strings.Contains(buf.String(), "login") || !strings.Contains(buf.String(), "tr-9") {
		t.Fatalf("log: %s", buf.String())
	}
	body := DefaultMetrics().text()
	if !strings.Contains(body, `sanguo_gameplay_events_total{event="login"}`) {
		t.Fatalf("metrics:\n%s", body)
	}
}

func TestGaugesAndMetricsHandler(t *testing.T) {
	SetOnlineConnections(7)
	SetQueueLength(2)
	rec := httptest.NewRecorder()
	MetricsHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if !strings.Contains(rec.Body.String(), "sanguo_online_connections 7") {
		t.Fatal(rec.Body.String())
	}
}
