package obs

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const traceHeader = "X-Trace-ID"

type traceKey struct{}

// TraceIDFromContext returns the trace id attached to ctx, if any.
func TraceIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(traceKey{}).(string)
	return id, ok && id != ""
}

// WrapLogger adds trace_id from ctx to each log record.
func WrapLogger(log *slog.Logger) *slog.Logger {
	if log == nil {
		return slog.Default()
	}
	return slog.New(ctxHandler{log.Handler()})
}

type ctxHandler struct{ slog.Handler }

func (h ctxHandler) Handle(ctx context.Context, r slog.Record) error {
	if id, ok := TraceIDFromContext(ctx); ok {
		r.AddAttrs(slog.String("trace_id", id))
	}
	return h.Handler.Handle(ctx, r)
}
func (h ctxHandler) WithAttrs(a []slog.Attr) slog.Handler { return ctxHandler{h.Handler.WithAttrs(a)} }
func (h ctxHandler) WithGroup(n string) slog.Handler    { return ctxHandler{h.Handler.WithGroup(n)} }

// Wrap applies trace id, Prometheus metrics, and JSON access logs.
func Wrap(log *slog.Logger, next http.Handler) http.Handler {
	return WrapWithMetrics(log, DefaultMetrics(), next)
}

// WrapWithMetrics records into a specific registry (for tests).
func WrapWithMetrics(log *slog.Logger, m *Metrics, next http.Handler) http.Handler {
	access := WrapLogger(log)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(traceHeader)
		if id == "" {
			id = newTraceID()
		}
		w.Header().Set(traceHeader, id)
		r = r.WithContext(context.WithValue(r.Context(), traceKey{}, id))

		start := time.Now()
		rw := &statusWriter{w, http.StatusOK}
		next.ServeHTTP(rw, r)
		m.observe(r.Method, r.URL.Path, rw.code, time.Since(start).Seconds())

		access.InfoContext(r.Context(), "http request",
			"method", r.Method, "path", r.URL.Path, "status", rw.code,
			"duration_ms", time.Since(start).Milliseconds())
	})
}

// MetricsHandler exposes /metrics on the default registry.
func MetricsHandler() http.Handler { return DefaultMetrics() }

type statusWriter struct {
	http.ResponseWriter
	code int
}

func (w *statusWriter) WriteHeader(c int) { w.code = c; w.ResponseWriter.WriteHeader(c) }

func newTraceID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b[:])
}

type reqKey struct{ method, path, status string }

// Metrics is a minimal Prometheus text registry (no external deps).
type Metrics struct {
	mu      sync.Mutex
	counts  map[reqKey]uint64
	latency map[string]latAgg // key: method|path
	online  atomic.Uint64
	queue   atomic.Uint64
}

type latAgg struct{ sum float64; n uint64 }

var defaultMetrics = &Metrics{counts: map[reqKey]uint64{}, latency: map[string]latAgg{}}

func DefaultMetrics() *Metrics { return defaultMetrics }

func (m *Metrics) observe(method, path string, status int, sec float64) {
	m.mu.Lock()
	m.counts[reqKey{method, path, fmt.Sprint(status)}]++
	k := method + "|" + path
	a := m.latency[k]
	a.sum += sec
	a.n++
	m.latency[k] = a
	m.mu.Unlock()
}

func SetOnlineConnections(n float64) { defaultMetrics.online.Store(uint64(max(0, n))) }
func SetQueueLength(n float64)       { defaultMetrics.queue.Store(uint64(max(0, n))) }

func (m *Metrics) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	_, _ = w.Write([]byte(m.text()))
}

func (m *Metrics) text() string {
	var b strings.Builder
	line := func(name, labels string, v any) {
		if labels != "" {
			fmt.Fprintf(&b, "%s{%s} %v\n", name, labels, v)
			return
		}
		fmt.Fprintf(&b, "%s %v\n", name, v)
	}
	b.WriteString("# HELP sanguo_http_requests_total HTTP requests\n# TYPE sanguo_http_requests_total counter\n")
	m.mu.Lock()
	keys := make([]reqKey, 0, len(m.counts))
	for k := range m.counts {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i].method < keys[j].method })
	for _, k := range keys {
		line("sanguo_http_requests_total",
			fmt.Sprintf("method=\"%s\",path=\"%s\",status=\"%s\"", k.method, k.path, k.status), m.counts[k])
	}
	b.WriteString("# HELP sanguo_http_request_duration_seconds Request latency\n# TYPE sanguo_http_request_duration_seconds summary\n")
	lkeys := make([]string, 0, len(m.latency))
	for k := range m.latency {
		lkeys = append(lkeys, k)
	}
	sort.Strings(lkeys)
	for _, k := range lkeys {
		a := m.latency[k]
		parts := strings.SplitN(k, "|", 2)
		labels := fmt.Sprintf("method=\"%s\",path=\"%s\"", parts[0], parts[1])
		line("sanguo_http_request_duration_seconds_sum", labels, a.sum)
		line("sanguo_http_request_duration_seconds_count", labels, a.n)
	}
	m.mu.Unlock()
	b.WriteString("# HELP sanguo_online_connections Online clients\n# TYPE sanguo_online_connections gauge\n")
	fmt.Fprintf(&b, "sanguo_online_connections %d\n", m.online.Load())
	b.WriteString("# HELP sanguo_queue_length Queue depth\n# TYPE sanguo_queue_length gauge\n")
	fmt.Fprintf(&b, "sanguo_queue_length %d\n", m.queue.Load())
	return b.String()
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
