// Package obs provides trace-aware slog helpers, HTTP middleware, and Prometheus text metrics.
//
// Runtime integration (outside this package): wrap the root handler with obs.Wrap and
// register mux.Handle("/metrics", obs.MetricsHandler()).
package obs
